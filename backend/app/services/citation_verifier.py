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


def compute_nli_entailment(hypothesis: str, premise: str) -> tuple[str, float]:
    """
    Simulates / computes Natural Language Inference (NLI) premise-hypothesis entailment.
    Returns (verdict: ENTAILMENT | NEUTRAL | CONTRADICTION, entailment_score: float).
    """
    if not hypothesis or not premise:
        return ("NEUTRAL", 0.0)

    h_words = set(re.findall(r"\w{3,}", hypothesis.lower()))
    p_words = set(re.findall(r"\w{3,}", premise.lower()))

    if not h_words:
        return ("NEUTRAL", 0.5)

    overlap = len(h_words.intersection(p_words)) / len(h_words)

    # Check contradiction keywords
    negations = {"no", "not", "none", "never", "invalid", "rejected", "denied", "expired", "failed"}
    h_neg = bool(h_words.intersection(negations))
    p_neg = bool(p_words.intersection(negations))

    if h_neg != p_neg and overlap > 0.3:
        return ("CONTRADICTION", round(max(0.1, 1.0 - overlap), 3))

    if overlap >= 0.5:
        return ("ENTAILMENT", round(overlap, 3))
    elif overlap >= 0.25:
        return ("NEUTRAL", round(overlap, 3))
    else:
        return ("CONTRADICTION", 0.1)


def verify_citations(
    answer: str,
    source_chunks: list[dict[str, Any]],
    similarity_threshold: float = 0.35
) -> dict[str, Any]:
    """
    Verifies that claims in the answer are grounded in the source chunks using NLI entailment scoring.

    Returns:
    {
        "is_grounded": bool,
        "grounding_score": float (0.0 to 1.0),
        "verified_claims": list[dict],
        "unsupported_claims": list[str],
        "nli_verdicts": dict,
        "citations": list[dict],
    }
    """
    if not source_chunks:
        return {
            "is_grounded": False,
            "grounding_score": 0.0,
            "verified_claims": [],
            "unsupported_claims": extract_claims(answer),
            "nli_verdicts": {},
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
            "nli_verdicts": {},
            "citations": []
        }

    verified_claims = []
    unsupported_claims = []
    citations = []
    nli_verdicts = {"ENTAILMENT": 0, "NEUTRAL": 0, "CONTRADICTION": 0}

    for claim in claims:
        best_match_chunk = None
        best_verdict = "NEUTRAL"
        best_score = 0.0

        for chunk in source_chunks:
            chunk_text = chunk.get("text", "") or chunk.get("ocr_text", "")
            verdict, score = compute_nli_entailment(claim, chunk_text)

            if score > best_score:
                best_score = score
                best_verdict = verdict
                best_match_chunk = chunk

        nli_verdicts[best_verdict] = nli_verdicts.get(best_verdict, 0) + 1

        if best_verdict == "ENTAILMENT" or (best_score >= similarity_threshold and best_verdict != "CONTRADICTION"):
            verified_claims.append({
                "claim": claim,
                "confidence": best_score,
                "nli_verdict": best_verdict,
                "source_document_id": best_match_chunk.get("document_id") if best_match_chunk else None,
                "source_filename": best_match_chunk.get("filename", "Unknown") if best_match_chunk else "Unknown",
            })
            if best_match_chunk:
                citation_entry = {
                    "document_id": best_match_chunk.get("document_id"),
                    "filename": best_match_chunk.get("filename", "Unknown"),
                    "snippet": (best_match_chunk.get("text") or best_match_chunk.get("ocr_text") or "")[:200],
                }
                if citation_entry not in citations:
                    citations.append(citation_entry)
        else:
            unsupported_claims.append(claim)

    total_claims = len(claims)
    grounding_score = len(verified_claims) / total_claims if total_claims > 0 else 1.0
    is_grounded = grounding_score >= 0.65 and nli_verdicts["CONTRADICTION"] == 0

    return {
        "is_grounded": is_grounded,
        "grounding_score": round(grounding_score, 3),
        "verified_claims": verified_claims,
        "unsupported_claims": unsupported_claims,
        "nli_verdicts": nli_verdicts,
        "citations": citations,
    }
