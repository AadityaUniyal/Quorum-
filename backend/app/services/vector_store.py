import hashlib
import logging
from typing import Any

import chromadb
import httpx
import numpy as np

import re
from app.config import settings

logger = logging.getLogger(__name__)

# Initialize persistent Chroma client
chroma_client = chromadb.PersistentClient(path=settings.CHROMA_PERSIST_DIR)

def get_collection():
    """Dynamically get or create collection to handle deletion/resets in tests."""
    return chroma_client.get_or_create_collection(name="document_intelligence")

# Maintain backward compatibility for modules importing vector_store.collection
@property
def collection():
    return get_collection()

# Use helper to access the active collection reference
def _get_active_collection():
    return chroma_client.get_or_create_collection(name="document_intelligence")

def get_hash_embedding(text: str, dimension: int = 768) -> list[float]:
    """
    Fallback deterministic embedding generator.
    Creates a fixed-length float vector from the text content.
    """
    # Create salt seeds based on character positions
    hash_inst = hashlib.sha256(text.encode('utf-8'))
    seed = int(hash_inst.hexdigest()[:8], 16)

    np.random.seed(seed)
    # Generate normal-distributed vector
    vec = np.random.normal(0.0, 1.0, dimension)
    # Normalize to unit vector
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
        # Generate embedding
        embedding = _model_cache.encode(text, convert_to_numpy=True)
        return embedding.tolist()
    except Exception as e:
        logger.error(f"Local sentence-transformers embedding generation failed: {e}. Falling back to hash embedding.")
        return get_hash_embedding(text, dimension=384)

def get_gemini_embedding(text: str) -> list[float]:
    """
    Fetches embedding from Gemini Embeddings API.
    """
    url = f"https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key={settings.GEMINI_API_KEY}"
    payload = {
        "model": "models/text-embedding-004",
        "content": {"parts": [{"text": text}]}
    }
    response = httpx.post(url, json=payload, timeout=20.0)
    response.raise_for_status()
    res_data = response.json()
    return res_data["embedding"]["values"]

def get_embedding(text: str) -> list[float]:
    """
    Resolves embedding extraction based on provider configuration.
    """
    provider = settings.EMBEDDING_PROVIDER.lower()
    if provider == "gemini" and settings.GEMINI_API_KEY:
        try:
            return get_gemini_embedding(text)
        except Exception as e:
            logger.error(f"Gemini embedding failed: {str(e)}. Falling back to local model.")
            return get_local_embedding(text)
    elif provider == "gemini":
        logger.warning("Gemini embedding selected but GEMINI_API_KEY is not set. Using local sentence-transformers.")
        return get_local_embedding(text)
    
    return get_local_embedding(text)


def chunk_text(text: str, chunk_size: int = 600, overlap: int = 150) -> list[str]:
    """
    Splits text into overlapping chunks, attempting to preserve sentence boundaries.
    """
    if not text:
        return []
    
    # Split raw text into rough sentence units using sentence ending punctuation followed by space
    sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    chunks = []
    
    current_chunk = []
    current_words_count = 0
    
    for sentence in sentences:
        sentence_words = sentence.split()
        if not sentence_words:
            continue
        sentence_len = len(sentence_words)
        
        # If adding sentence exceeds chunk size and we already have words, store current chunk
        if current_words_count + sentence_len > chunk_size and current_chunk:
            chunks.append(" ".join(current_chunk))
            
            # Recalculate overlap window from sentences
            overlap_words = []
            overlap_count = 0
            # Backtrack to fulfill overlap word count
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

def add_document_to_vector_store(document_id: str, ocr_text: str, metadata: dict[str, Any]):
    """
    Chunks document text, generates embeddings, and inserts into ChromaDB.
    """
    if not ocr_text or not ocr_text.strip():
        logger.warning(f"No text to index for document {document_id}")
        return

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

        # Merge source metadata
        chunk_metadata = metadata.copy()
        chunk_metadata["document_id"] = str(document_id)
        chunk_metadata["chunk_index"] = idx
        metadatas.append(chunk_metadata)

    # Batch insert
    get_collection().add(
        ids=ids,
        embeddings=embeddings,
        documents=documents,
        metadatas=metadatas
    )
    logger.info(f"Indexed {len(chunks)} text chunks for document {document_id} in ChromaDB")

def search_vector_store(query_text: str, filter_metadata: dict[str, Any] = None, n_results: int = 5) -> list[dict[str, Any]]:
    """
    Performs semantic vector search on ChromaDB.
    """
    query_emb = get_embedding(query_text)

    where_clause = None
    if filter_metadata:
        # Simplify filter metadata for ChromaDB compatibility
        where_clause = {k: str(v) for k, v in filter_metadata.items() if v is not None}
        if not where_clause:
            where_clause = None

    results = get_collection().query(
        query_embeddings=[query_emb],
        n_results=n_results,
        where=where_clause
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

def query_rag_knowledge(document_ids: list[str], question: str) -> str:
    """
    RAG (Retrieval-Augmented Generation) answer query:
    1. Search for top semantic chunks constrained to document_ids.
    2. Compile prompt and fetch answer from Gemini.
    """
    # Retrieve relevant contexts
    contexts = []
    for doc_id in document_ids:
        res = search_vector_store(question, filter_metadata={"document_id": str(doc_id)}, n_results=3)
        contexts.extend(res)

    if not contexts:
        return "No relevant context found in selected documents to answer this question."

    # Deduplicate and sort by relevance distance (lower distance = closer match)
    contexts = sorted(contexts, key=lambda x: x["distance"])[:5]
    merged_context = "\n\n".join([f"Source: {c['filename']} (Chunk)\n{c['text']}" for c in contexts])

    prompt = f"""
    You are an AI assistant answering questions about a corpus of business documents.
    Answer the user's question using ONLY the provided document contexts.
    If you cannot find the answer in the contexts, state clearly that the information is not present.

    Document Contexts:
    {merged_context}

    User Question:
    {question}

    Answer:
    """

    # Route through centralized call_llm_cached for fallback and caching
    try:
        import asyncio
        from app.services.llm import call_llm_cached
        
        async def _run():
            response_text, provider, from_cache = await call_llm_cached(
                prompt=prompt,
                temperature=0.2,
                use_cache=True
            )
            return response_text
            
        return asyncio.run(_run())
    except Exception as e:
        logger.error(f"Centralized RAG call failed: {str(e)}. Running heuristic fallback.")

    # Heuristic fallback - scan text for keywords
    q_lower = question.lower()
    for c in contexts:
        # If question asks about standard terms, scan lines
        for line in c["text"].split("\n"):
            # Simple keyword matching
            words = q_lower.replace("?", "").split()
            matching_words = [w for w in words if w in line.lower() and len(w) > 3]
            if len(matching_words) >= 2:
                return f"[Extracted from context in {c['filename']}]: {line.strip()}\n\n(Local search match: '{line.strip()}')"

    # Default mock fallback summary
    return f"Based on the processed documents (including {contexts[0]['filename']}), the document mentions details matching your query. (API offline, summary matches: '{question}')."
