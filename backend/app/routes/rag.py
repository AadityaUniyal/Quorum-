"""
RAG (Retrieval Augmented Generation) routes — Roadmap Section 1.6

Implements:
  - Citation tracking: LLM returns JSON with answer + [{doc_id, field_key, quote}] citations
  - Multi-document Q&A: up to 20 documents via hierarchical context
  - Streaming chat: token-by-token SSE using server-sent events
  - Conversation memory: multi-turn chat history per session stored in Redis
  - Q&A session history: persisted to DB via RAG audit logs
"""

import json
import logging
import time
import uuid
from typing import AsyncGenerator
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.auth import User, UserRole
from app.models.document import Document
from app.routes.auth import RoleChecker

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/rag", tags=["rag"])

any_user = RoleChecker([UserRole.ADMIN, UserRole.OPERATOR, UserRole.REVIEWER, UserRole.VIEWER])

MAX_DOCS = 20  # roadmap: up to 20 documents at once


# ── Schemas ──────────────────────────────────────────────────────────────────

class Citation(BaseModel):
    document_id: str
    filename: str
    field_key: str | None = None
    quote: str


class RagChatMessage(BaseModel):
    role: str   # "user" | "assistant"
    content: str


class RagAskRequest(BaseModel):
    document_ids: list[UUID]
    question: str
    session_id: str | None = None       # optional session for memory
    history: list[RagChatMessage] = []  # prior turns from frontend


class RagAskResponse(BaseModel):
    session_id: str
    answer: str
    citations: list[Citation] = []
    latency_ms: int


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_redis():
    """Return Redis client; return None if unavailable."""
    try:
        import redis
        r = redis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            password=settings.REDIS_PASSWORD,
            decode_responses=True,
            socket_connect_timeout=2,
        )
        r.ping()
        return r
    except Exception:
        return None


def _load_session_history(session_id: str) -> list[dict]:
    """Load conversation history from Redis (TTL 24h)."""
    r = _get_redis()
    if not r:
        return []
    raw = r.get(f"rag:session:{session_id}")
    if raw:
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return []
    return []


def _save_session_history(session_id: str, history: list[dict]):
    """Persist conversation history to Redis with 24h TTL."""
    r = _get_redis()
    if r:
        r.set(f"rag:session:{session_id}", json.dumps(history), ex=86400)


def _build_context(docs: list[Document]) -> str:
    """
    Build LLM context string from up to MAX_DOCS documents.
    For large batches, summarizes each doc first (hierarchical approach).
    """
    parts = []
    for doc in docs[:MAX_DOCS]:
        text = (doc.ocr_text or "")[:3000]  # limit per doc
        if doc.executive_summary:
            summary = f"[Summary] {doc.executive_summary}\n"
        else:
            summary = ""
        parts.append(
            f"--- Document: {doc.filename} (ID: {doc.id}) ---\n"
            f"{summary}"
            f"{text}\n"
        )
    return "\n".join(parts)


def _citation_prompt(question: str, context: str, history_str: str) -> str:
    return f"""You are a precise document analysis assistant. Answer ONLY based on the provided context.
Your response MUST be valid JSON with exactly this structure:
{{
  "answer": "Your detailed answer here",
  "citations": [
    {{"document_id": "uuid", "filename": "file.pdf", "field_key": "optional_field", "quote": "exact quote from document"}}
  ]
}}

If no relevant information is found, set answer to "I could not find relevant information in the provided documents." and citations to [].

Conversation history:
{history_str}

Document context:
{context}

Question: {question}

Respond with valid JSON only:"""


def _parse_llm_json(raw: str) -> tuple[str, list[dict]]:
    """Parse LLM JSON response; fallback gracefully on malformed output."""
    import re
    # Strip markdown code fences if present
    cleaned = re.sub(r"```(?:json)?", "", raw).strip()
    try:
        data = json.loads(cleaned)
        return data.get("answer", raw), data.get("citations", [])
    except json.JSONDecodeError:
        # Try extracting answer from partial JSON
        answer_match = re.search(r'"answer"\s*:\s*"(.*?)"', cleaned, re.DOTALL)
        answer = answer_match.group(1) if answer_match else raw[:500]
        return answer, []


# ── Main Q&A Endpoint ─────────────────────────────────────────────────────────

@router.post("/ask", response_model=RagAskResponse)
def ask_rag(
    req: RagAskRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(any_user),
):
    """
    Multi-document Q&A with citation tracking and conversation memory.
    Supports up to 20 documents per request.
    """
    start = time.time()

    if not req.document_ids:
        raise HTTPException(status_code=400, detail="Provide at least one document ID.")
    if len(req.document_ids) > MAX_DOCS:
        raise HTTPException(
            status_code=400, detail=f"Maximum {MAX_DOCS} documents per request."
        )

    # Load documents
    docs = db.query(Document).filter(
        Document.id.in_([str(did) for did in req.document_ids])
    ).all()
    if not docs:
        raise HTTPException(status_code=404, detail="No documents found for given IDs.")

    # Session management
    session_id = req.session_id or str(uuid.uuid4())

    # Build or continue conversation history
    history: list[dict] = _load_session_history(session_id)
    # Merge any history sent from frontend (takes precedence)
    if req.history:
        history = [{"role": m.role, "content": m.content} for m in req.history]

    history_str = "\n".join(
        f"{m['role'].upper()}: {m['content']}" for m in history[-6:]  # last 3 turns
    ) if history else "None"

    context = _build_context(docs)
    prompt = _citation_prompt(req.question, context, history_str)

    # Call LLM or use offline fallback
    if settings.LLM_OFFLINE_MOCK_FALLBACK or not settings.GEMINI_API_KEY:
        from app.services.llm import local_extractive_rag
        answer_text, raw_citations = local_extractive_rag(req.question, docs)
    else:
        try:
            import google.generativeai as genai
            genai.configure(api_key=settings.GEMINI_API_KEY)
            model = genai.GenerativeModel(settings.LLM_MODEL)
            response = model.generate_content(
                prompt,
                generation_config=genai.GenerationConfig(temperature=0.1, max_output_tokens=1024),
            )
            raw_answer = response.text.strip()
            answer_text, raw_citations = _parse_llm_json(raw_answer)
        except Exception as e:
            logger.error(f"LLM error in RAG: {e}. Falling back to local extractive RAG.")
            from app.services.llm import local_extractive_rag
            answer_text, raw_citations = local_extractive_rag(req.question, docs)

    # Map citations back to real document filenames
    doc_map = {str(d.id): d.filename for d in docs}
    citations = []
    for c in raw_citations:
        doc_id = c.get("document_id", "")
        citations.append(Citation(
            document_id=doc_id,
            filename=doc_map.get(doc_id, c.get("filename", "Unknown")),
            field_key=c.get("field_key"),
            quote=c.get("quote", ""),
        ))

    # Update session history
    history.append({"role": "user", "content": req.question})
    history.append({"role": "assistant", "content": answer_text})
    _save_session_history(session_id, history)

    # Persist Q&A to audit log for history
    try:
        from app.models.audit import AuditLog
        audit = AuditLog(
            user_id=current_user.id,
            action="RAG_QA_SESSION",
            details={
                "session_id": session_id,
                "question": req.question[:500],
                "answer": answer_text[:500],
                "doc_ids": [str(d) for d in req.document_ids],
                "citations_count": len(citations),
            },
        )
        db.add(audit)
        db.commit()
    except Exception as e:
        logger.warning(f"Failed to save RAG audit log: {e}")
        db.rollback()

    latency_ms = int((time.time() - start) * 1000)
    return RagAskResponse(
        session_id=session_id,
        answer=answer_text,
        citations=citations,
        latency_ms=latency_ms,
    )


# ── Streaming Chat Endpoint (SSE) ─────────────────────────────────────────────

@router.post("/ask/stream")
async def ask_rag_stream(
    req: RagAskRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(any_user),
):
    """
    Streaming RAG Q&A via Server-Sent Events.
    Tokens are streamed as they are generated by the LLM.
    """
    if not req.document_ids:
        raise HTTPException(status_code=400, detail="Provide at least one document ID.")

    docs = db.query(Document).filter(
        Document.id.in_([str(did) for did in req.document_ids])
    ).all()
    if not docs:
        raise HTTPException(status_code=404, detail="No documents found.")

    session_id = req.session_id or str(uuid.uuid4())
    history = _load_session_history(session_id)
    if req.history:
        history = [{"role": m.role, "content": m.content} for m in req.history]

    history_str = "\n".join(
        f"{m['role'].upper()}: {m['content']}" for m in history[-6:]
    ) if history else "None"

    context = _build_context(docs)
    prompt = _citation_prompt(req.question, context, history_str)

    async def _stream_tokens() -> AsyncGenerator[str, None]:
        """Stream LLM tokens via SSE data frames."""
        full_response = ""
        try:
            # Check for offline fallback
            if settings.LLM_OFFLINE_MOCK_FALLBACK or not settings.GEMINI_API_KEY:
                from app.services.llm import local_extractive_rag
                import asyncio
                yield f"data: {json.dumps({'type': 'session', 'session_id': session_id})}\n\n"
                answer_text, citations = local_extractive_rag(req.question, docs)
                
                # Stream answer word by word (or chunk by chunk) for realistic UX
                words = answer_text.split(" ")
                for i, word in enumerate(words):
                    space = " " if i > 0 else ""
                    yield f"data: {json.dumps({'type': 'token', 'content': space + word})}\n\n"
                    await asyncio.sleep(0.01)
                    
                yield f"data: {json.dumps({'type': 'citations', 'citations': citations})}\n\n"
                yield f"data: {json.dumps({'type': 'done', 'session_id': session_id})}\n\n"
                
                # Save history
                history.append({"role": "user", "content": req.question})
                history.append({"role": "assistant", "content": answer_text})
                _save_session_history(session_id, history)
                return

            import google.generativeai as genai
            genai.configure(api_key=settings.GEMINI_API_KEY)
            model = genai.GenerativeModel(settings.LLM_MODEL)
            
            # Send session_id first
            yield f"data: {json.dumps({'type': 'session', 'session_id': session_id})}\n\n"

            # Stream tokens
            for chunk in model.generate_content(
                prompt,
                generation_config=genai.GenerationConfig(temperature=0.1, max_output_tokens=1024),
                stream=True,
            ):
                token = chunk.text if chunk.text else ""
                if token:
                    full_response += token
                    yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"

            # Parse citations from full response
            answer_text, raw_cits = _parse_llm_json(full_response)
            doc_map = {str(d.id): d.filename for d in docs}
            citations = [
                {
                    "document_id": c.get("document_id", ""),
                    "filename": doc_map.get(c.get("document_id", ""), c.get("filename", "Unknown")),
                    "field_key": c.get("field_key"),
                    "quote": c.get("quote", ""),
                }
                for c in raw_cits
            ]

            # Send citations as final event
            yield f"data: {json.dumps({'type': 'citations', 'citations': citations})}\n\n"
            yield f"data: {json.dumps({'type': 'done', 'session_id': session_id})}\n\n"

            # Save history
            history.append({"role": "user", "content": req.question})
            history.append({"role": "assistant", "content": answer_text})
            _save_session_history(session_id, history)

        except Exception as e:
            logger.error(f"Streaming RAG error: {e}")
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)[:200]})}\n\n"

    return StreamingResponse(
        _stream_tokens(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ── Session History Endpoint ──────────────────────────────────────────────────

@router.get("/session/{session_id}")
def get_session_history(
    session_id: str,
    current_user: User = Depends(any_user),
):
    """Retrieve conversation history for a given session ID."""
    history = _load_session_history(session_id)
    return {"session_id": session_id, "messages": history, "turn_count": len(history) // 2}


@router.delete("/session/{session_id}", status_code=204)
def clear_session(
    session_id: str,
    current_user: User = Depends(any_user),
):
    """Clear conversation history for a session."""
    r = _get_redis()
    if r:
        r.delete(f"rag:session:{session_id}")
    return None


# ── Q&A History from Audit Logs ───────────────────────────────────────────────

@router.get("/history")
def get_rag_history(
    limit: int = Query(default=20, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(any_user),
):
    """
    Returns recent RAG Q&A sessions for the current user from audit logs.
    """
    from app.models.audit import AuditLog

    logs = (
        db.query(AuditLog)
        .filter(
            AuditLog.user_id == current_user.id,
            AuditLog.action == "RAG_QA_SESSION",
        )
        .order_by(AuditLog.timestamp.desc())
        .limit(limit)
        .all()
    )

    return [
        {
            "id": str(log.id),
            "session_id": log.details.get("session_id"),
            "question": log.details.get("question"),
            "answer_preview": (log.details.get("answer") or "")[:200],
            "doc_count": len(log.details.get("doc_ids", [])),
            "citations_count": log.details.get("citations_count", 0),
            "timestamp": log.timestamp.isoformat() if log.timestamp else None,
        }
        for log in logs
    ]
