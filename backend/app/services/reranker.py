import logging
import math
import re
from typing import Any

logger = logging.getLogger(__name__)


def compute_cross_encoder_score(query: str, text: str) -> float:
    """
    Computes a cross-encoder interaction score between query and document text.
    Combines term proximity, token overlap density, and exact phrase match bonuses.
    """
    if not query or not text:
        return 0.0

    q_clean = query.lower().strip()
    t_clean = text.lower().strip()
    q_terms = [re.escape(term) for term in q_clean.split() if len(term) > 1]

    if not q_terms:
        return 0.0

    # 1. Exact phrase match bonus
    phrase_score = 0.0
    if q_clean in t_clean:
        phrase_score = 0.35

    # 2. Token overlap ratio
    term_matches = 0
    first_positions: list[int] = []

    for term in q_terms:
        matches = list(re.finditer(term, t_clean))
        if matches:
            term_matches += 1
            first_positions.append(matches[0].start())

    overlap_ratio = term_matches / len(q_terms)

    # 3. Term Proximity Penalty (closer together = higher score)
    proximity_bonus = 0.0
    if len(first_positions) > 1:
        first_positions.sort()
        span = first_positions[-1] - first_positions[0]
        proximity_bonus = max(0.0, 0.25 * math.exp(-span / 300.0))
    elif len(first_positions) == 1:
        proximity_bonus = 0.1

    final_score = (overlap_ratio * 0.4) + phrase_score + proximity_bonus
    return min(1.0, max(0.0, round(final_score, 4)))


def rerank_search_results(
    query: str,
    candidates: list[dict[str, Any]],
    top_n: int = 5,
    rerank_weight: float = 0.6,
) -> list[dict[str, Any]]:
    """
    Two-Stage Retrieval Reranker:
    Fuses initial retrieval score with Cross-Encoder query-document interaction score.
    """
    if not candidates or not query.strip():
        return candidates[:top_n]

    reranked = []
    for item in candidates:
        initial_score = float(item.get("score", 0.5))
        content_text = item.get("snippet") or item.get("excerpt") or item.get("filename") or ""

        cross_score = compute_cross_encoder_score(query, content_text)
        fused_score = (initial_score * (1.0 - rerank_weight)) + (cross_score * rerank_weight)

        item_copy = dict(item)
        item_copy["initial_score"] = round(initial_score, 4)
        item_copy["cross_encoder_score"] = round(cross_score, 4)
        item_copy["score"] = round(fused_score, 4)
        reranked.append(item_copy)

    # Sort descending by fused score
    reranked.sort(key=lambda x: x["score"], reverse=True)
    return reranked[:top_n]
