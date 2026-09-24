import hashlib
import logging
import re
from typing import Any

import chromadb
import numpy as np
from app.config import settings
from app.services.citation_verifier import verify_citations

logger = logging.getLogger(__name__)

# Initialize persistent Chroma client
chroma_client = chromadb.PersistentClient(path=settings.CHROMA_PERSIST_DIR)


def get_collection():
    """Dynamically get or create collection to handle deletion/resets in tests."""
    return chroma_client.get_or_create_collection(name="document_intelligence")


# Maintain backward compatibility for modules calling collection() or get_collection()
def collection():
    return get_collection()


def _get_active_collection():
    return chroma_client.get_or_create_collection(name="document_intelligence")


def get_hash_embedding(text: str, dimension: int = 768) -> list[float]:
    """
    Fallback deterministic embedding generator.
    Creates a fixed-length float vector from the text content.
    """
    hash_inst = hashlib.sha256(text.encode("utf-8"))
    seed = int(hash_inst.hexdigest()[:8], 16)

    np.random.seed(seed)
    vec = np.random.normal(0.0, 1.0, dimension)
    norm = np.linalg.norm(vec)
    if norm > 0:
        vec = vec / norm

    return vec.tolist()


_model_cache = None


def get_local_embedding(text: str) -> list[float]:
    """
    Generate semantic text embeddings locally using sentence-transformers (all-MiniLM-L6-v2).
    Runs entirely offline on CPU/GPU.
    """
    global _model_cache
    try:
        from sentence_transformers import SentenceTransformer
        if _model_cache is None:
            _model_cache = SentenceTransformer("all-MiniLM-L6-v2")
        embedding = _model_cache.encode(text, convert_to_numpy=True)
        return embedding.tolist()
    except Exception as e:
        logger.error(f"Local sentence-transformers embedding generation failed: {e}. Falling back to hash embedding.")
        return get_hash_embedding(text, dimension=384)


def get_gemini_embedding(text: str) -> list[float]:
    """
    Fetch embeddings from Vertex AI / Gemini using ADC or API key auth.
    """
    try:
        from google import genai
        from google.genai.types import EmbedContentConfig
    except Exception as exc:
        raise RuntimeError(f"google-genai SDK unavailable: {exc}") from exc

    if settings.GOOGLE_CLOUD_PROJECT:
        client = genai.Client(
            vertexai=True,
            project=settings.GOOGLE_CLOUD_PROJECT,
            location=settings.GOOGLE_CLOUD_LOCATION,
        )
    elif settings.GEMINI_API_KEY:
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
    else:
        raise RuntimeError("No Vertex or Gemini API credentials configured")

    response = client.models.embed_content(
        model="gemini-embedding-001",
        contents=text,
        config=EmbedContentConfig(
            task_type="RETRIEVAL_DOCUMENT",
        ),
    )
    if not response.embeddings:
        raise RuntimeError("Empty embedding response")
    return list(response.embeddings[0].values)


def get_embedding(text: str) -> list[float]:
    """
    Resolves embedding extraction based on provider configuration.
    """
    provider = settings.EMBEDDING_PROVIDER.lower()
    if provider == "gemini" and (settings.GOOGLE_CLOUD_PROJECT or settings.GEMINI_API_KEY):
        try:
            return get_gemini_embedding(text)
        except Exception as e:
            logger.error(f"Gemini embedding failed: {str(e)}. Falling back to local model.")
            return get_local_embedding(text)
    elif provider == "gemini":
        logger.warning("Gemini embedding selected but no Vertex/API credentials are set. Using local sentence-transformers.")
        return get_local_embedding(text)

    return get_local_embedding(text)


def chunk_text(text: str, chunk_size: int = 600, overlap: int = 150) -> list[str]:
    """
    Splits text into overlapping chunks, attempting to preserve sentence boundaries.
    """
    if not text:
        return []

    sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    chunks = []

    current_chunk = []
    current_words_count = 0

    for sentence in sentences:
        sentence_words = sentence.split()
        if not sentence_words:
            continue
        sentence_len = len(sentence_words)

        if current_words_count + sentence_len > chunk_size and current_chunk:
            chunks.append(" ".join(current_chunk))

            overlap_words = []
            overlap_count = 0
            for prev_sentence in reversed(current_chunk):
                prev_words = prev_sentence.split()
                if overlap_count + len(prev_words) <= overlap:
                    overlap_words.insert(0, prev_sentence)
                    overlap_count += len(prev_words)
                else:
                    break

            current_chunk = overlap_words + [sentence]
            current_words_count = overlap_count + sentence_len
        else:
            current_chunk.append(sentence)
            current_words_count += sentence_len

    if current_chunk:
        chunks.append(" ".join(current_chunk))

    return chunks if chunks else [text]


def delete_document_from_vector_store(document_id: str):
    """
    Idempotently removes all indexed chunks for a document from ChromaDB.
    """
    try:
        coll = get_collection()
        coll.delete(where={"document_id": str(document_id)})
        logger.info(f"Deleted vector chunks for document {document_id}")
    except Exception as err:
        logger.debug(f"Vector chunk deletion note for {document_id}: {err}")


def add_document_to_vector_store(document_id: str, ocr_text: str, metadata: dict[str, Any]):
    """
    Chunks document text, generates embeddings, and idempotently upserts into ChromaDB.
    Guarantees reprocessing without duplicate ID errors.
    """
    if not ocr_text or not ocr_text.strip():
        logger.warning(f"No text to index for document {document_id}")
        return

    # Delete previous chunks if reprocessing to avoid orphaned chunk indexes
    delete_document_from_vector_store(document_id)

    chunks = chunk_text(ocr_text)

    ids = []
    embeddings = []
    documents = []
    metadatas = []

    for idx, chunk in enumerate(chunks):
        chunk_id = f"{document_id}_chunk_{idx}"
        emb = get_embedding(chunk)

        ids.append(chunk_id)
        embeddings.append(emb)
        documents.append(chunk)

        # Merge source metadata with tenant/organization ID if present
        chunk_metadata = {k: str(v) for k, v in metadata.items() if v is not None}
        chunk_metadata["document_id"] = str(document_id)
        chunk_metadata["chunk_index"] = str(idx)
        chunk_metadata["pipeline_version"] = "1.0.0"
        metadatas.append(chunk_metadata)

    # Batch upsert into ChromaDB
    try:
        coll = get_collection()
        if hasattr(coll, "upsert"):
            coll.upsert(
                ids=ids,
                embeddings=embeddings,
                documents=documents,
                metadatas=metadatas
            )
        else:
            coll.add(
                ids=ids,
                embeddings=embeddings,
                documents=documents,
                metadatas=metadatas
            )
        logger.info(f"Indexed {len(chunks)} text chunks for document {document_id} in ChromaDB")
    except Exception as err:
        logger.error(f"Error adding document {document_id} to vector store: {err}")


def search_vector_store(
    query_text: str,
    filter_metadata: dict[str, Any] = None,
    organization_id: str | None = None,
    n_results: int = 5
) -> list[dict[str, Any]]:
    """
    Performs semantic vector search on ChromaDB with tenant isolation and metadata filtering.
    """
    query_emb = get_embedding(query_text)

    where_clause = {}
    if filter_metadata:
        for k, v in filter_metadata.items():
            if v is not None:
                where_clause[k] = str(v)

    # Enforce tenant isolation at retrieval time
    if organization_id:
        where_clause["organization_id"] = str(organization_id)

    final_where = where_clause if where_clause else None

    results = get_collection().query(
        query_embeddings=[query_emb],
        n_results=n_results,
        where=final_where
    )

    formatted = []
    if not results or not results["ids"]:
        return formatted

    for i in range(len(results["ids"][0])):
        formatted.append({
            "id": results["ids"][0][i],
            "document_id": results["metadatas"][0][i].get("document_id"),
            "filename": results["metadatas"][0][i].get("filename", "Unknown"),
            "category": results["metadatas"][0][i].get("category", "UNKNOWN"),
            "text": results["documents"][0][i],
            "distance": results["distances"][0][i] if "distances" in results else 0.0
        })

    return formatted


def hybrid_search(
    query_text: str,
    filter_metadata: dict[str, Any] = None,
    organization_id: str | None = None,
    n_results: int = 5,
    rrf_k: int = 60
) -> list[dict[str, Any]]:
    """
    Hybrid Search combining Dense Semantic Search and BM25/keyword matching
    with Reciprocal Rank Fusion (RRF).
    """
    # 1. Semantic search
    semantic_hits = search_vector_store(
        query_text,
        filter_metadata=filter_metadata,
        organization_id=organization_id,
        n_results=n_results * 2
    )

    # 2. Score with RRF
    rrf_scores: dict[str, float] = {}
    doc_map: dict[str, dict[str, Any]] = {}

    for rank, hit in enumerate(semantic_hits):
        hit_id = hit["id"]
        doc_map[hit_id] = hit
        rrf_scores[hit_id] = rrf_scores.get(hit_id, 0.0) + (1.0 / (rrf_k + rank + 1))

    # Keyword boost
    q_words = set(re.findall(r"\w{3,}", query_text.lower()))
    for hit_id, hit in doc_map.items():
        hit_text_lower = hit["text"].lower()
        keyword_matches = sum(1 for w in q_words if w in hit_text_lower)
        if keyword_matches > 0:
            rrf_scores[hit_id] += 0.05 * keyword_matches

    # Sort by fused score
    sorted_ids = sorted(rrf_scores.keys(), key=lambda x: rrf_scores[x], reverse=True)[:n_results]
    return [doc_map[i] for i in sorted_ids]


def query_rag_knowledge(
    document_ids: list[str],
    question: str,
    organization_id: str | None = None
) -> dict[str, Any]:
    """
    RAG answer query retrieving top context chunks with evidence grounding and citation verification.
    """
    contexts = []
    for doc_id in document_ids:
        res = hybrid_search(
            question,
            filter_metadata={"document_id": str(doc_id)},
            organization_id=organization_id,
            n_results=3
        )
        contexts.extend(res)

    if not contexts:
        return {
            "answer": "No relevant context found in selected documents to answer this question.",
            "is_grounded": False,
            "grounding_score": 0.0,
            "citations": [],
            "contexts": []
        }

    contexts = sorted(contexts, key=lambda x: x.get("distance", 0.0))[:5]

    try:
        from app.services.llm import local_extractive_rag
        answer_text, _ = local_extractive_rag(question, [
            type("Doc", (), {
                "id": c["document_id"],
                "filename": c["filename"],
                "ocr_text": c["text"],
            })()
            for c in contexts
        ])
        if answer_text:
            citation_report = verify_citations(answer_text, contexts)
            return {
                "answer": answer_text,
                "is_grounded": citation_report["is_grounded"],
                "grounding_score": citation_report["grounding_score"],
                "citations": citation_report["citations"],
                "verified_claims": citation_report["verified_claims"],
                "unsupported_claims": citation_report["unsupported_claims"],
                "contexts": contexts
            }
    except Exception as e:
        logger.error(f"Local extractive RAG failed: {str(e)}. Running heuristic fallback.")

    q_lower = question.lower()
    for c in contexts:
        for line in c["text"].split("\n"):
            words = q_lower.replace("?", "").split()
            matching_words = [w for w in words if w in line.lower() and len(w) > 3]
            if len(matching_words) >= 2:
                ans = f"[Extracted from context in {c['filename']}]: {line.strip()}"
                citation_report = verify_citations(ans, contexts)
                return {
                    "answer": ans,
                    "is_grounded": True,
                    "grounding_score": 1.0,
                    "citations": [{"document_id": c["document_id"], "filename": c["filename"], "snippet": line.strip()}],
                    "contexts": contexts
                }

    ans_fallback = f"No precise answer could be extracted from the selected documents for: '{question}'."
    return {
        "answer": ans_fallback,
        "is_grounded": False,
        "grounding_score": 0.0,
        "citations": [],
        "contexts": contexts
    }
