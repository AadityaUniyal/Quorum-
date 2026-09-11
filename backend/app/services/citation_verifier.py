"""
Citation Verification & Evidence Grounding Engine

Analyzes generated RAG answers, verifies claims against retrieved source chunks,
calculates citation coverage confidence, and flags unsupported assertions / hallucinations.
"""

import logging
import re
from typing import Any

logger = logging.getLogger(__name__)


def extract_claims(answer_text: str) -> list[str]:
    """Splits generated answer into individual testable claim sentences."""
    if not answer_text:
        return []
    sentences = re.split(r"(?<=[.!?])\s+", answer_text.strip())
    # Filter out conversational boilerplate
    claims = [
        s.strip() for s in sentences
        if len(s.strip().split()) >= 3
        and not s.strip().lower().startswith(("hello", "hi", "based on", "according to", "in summary"))
    ]
    return claims or [answer_text.strip()]


def verify_citations(
    answer: str,
    source_chunks: list[dict[str, Any]],
    similarity_threshold: float = 0.4
) -> dict[str, Any]:
    """
    Verifies that claims in the answer are grounded in the source chunks.

    Returns:
    {
        "is_grounded": bool,
        "grounding_score": float (0.0 to 1.0),
        "verified_claims": list[dict],
        "unsupported_claims": list[str],
        "citations": list[dict],
    }
    """
    if not source_chunks:
        return {
            "is_grounded": False,
            "grounding_score": 0.0,
            "verified_claims": [],
            "unsupported_claims": extract_claims(answer),
            "citations": [],
            "warning": "No source chunks provided for citation verification."
        }

    claims = extract_claims(answer)
    if not claims:
        return {
            "is_grounded": True,
            "grounding_score": 1.0,
            "verified_claims": [],
            "unsupported_claims": [],
            "citations": []
        }

    verified_claims = []
    unsupported_claims = []
    citations = []

    for claim in claims:
        claim_lower = claim.lower()
        claim_words = set(re.findall(r"\w{4,}", claim_lower))
        best_match_chunk = None
        best_overlap = 0.0

        for chunk in source_chunks:
            chunk_text = chunk.get("text", "").lower()
            chunk_words = set(re.findall(r"\w{4,}", chunk_text))

            if not claim_words:
                continue

            intersection = claim_words.intersection(chunk_words)
            overlap_ratio = len(intersection) / len(claim_words)

            if overlap_ratio > best_overlap:
                best_overlap = overlap_ratio
                best_match_chunk = chunk

        if best_overlap >= similarity_threshold and best_match_chunk is not None:
            verified_claims.append({
                "claim": claim,
                "confidence": round(best_overlap, 3),
                "source_document_id": best_match_chunk.get("document_id"),
                "source_filename": best_match_chunk.get("filename", "Unknown"),
                "chunk_id": best_match_chunk.get("id"),
            })
            citation_entry = {
                "document_id": best_match_chunk.get("document_id"),
                "filename": best_match_chunk.get("filename", "Unknown"),
                "snippet": best_match_chunk.get("text", "")[:200],
            }
            if citation_entry not in citations:
                citations.append(citation_entry)
        else:
            unsupported_claims.append(claim)

    total_claims = len(claims)
    grounding_score = len(verified_claims) / total_claims if total_claims > 0 else 1.0
    is_grounded = grounding_score >= 0.70

    return {
        "is_grounded": is_grounded,
        "grounding_score": round(grounding_score, 3),
        "verified_claims": verified_claims,
        "unsupported_claims": unsupported_claims,
        "citations": citations,
    }
