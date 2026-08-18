"""
Reconciler Agent — 5th agent in the consensus pipeline.

Activates when Critic and Auditor scores on any field diverge by more than 0.3.
It performs a targeted re-analysis of the conflicting fields and produces a
reconciled confidence score between the two disagreeing agents.
"""
import logging
from typing import Any

from app.config import settings

logger = logging.getLogger(__name__)

CONFLICT_THRESHOLD = 0.3  # Minimum score gap that triggers reconciliation


def run_reconciler_agent(
    ocr_text: str,
    extracted_fields: dict[str, Any],
    critic_results: dict[str, dict],
    auditor_results: dict[str, dict],
) -> dict[str, dict[str, Any]]:
    """
    Reconciler Agent: Detects critic/auditor disagreements and resolves them.

    Returns a dict of field_key → { "reconciled_score": float, "notes": str }
    Only conflicting fields are returned; non-conflicting fields are omitted.
    """
    reconciled: dict[str, dict[str, Any]] = {}

    for field_key in extracted_fields:
        critic_score = critic_results.get(field_key, {}).get("score", 1.0)
        auditor_score = auditor_results.get(field_key, {}).get("score", 1.0)
        gap = abs(critic_score - auditor_score)

        if gap <= CONFLICT_THRESHOLD:
            continue  # No conflict — skip this field

        logger.info(
            f"Reconciler: conflict on '{field_key}' "
            f"(critic={critic_score:.2f}, auditor={auditor_score:.2f}, gap={gap:.2f})"
        )

        # Try Gemini reconciliation only when explicitly preferred.
        if settings.LLM_PREFERRED_PROVIDER == "gemini" and settings.GEMINI_API_KEY:
            try:
                result = _call_gemini_reconciler(
                    ocr_text, field_key, extracted_fields[field_key],
                    critic_score, critic_results.get(field_key, {}).get("notes", ""),
                    auditor_score, auditor_results.get(field_key, {}).get("notes", ""),
                )
                reconciled[field_key] = result
                continue
            except Exception as exc:
                logger.warning(f"Gemini reconciler failed for '{field_key}': {exc}")

        # Deterministic fallback: weighted average biased toward the stricter score
        reconciled_score = round((critic_score * 0.4 + auditor_score * 0.6), 4)
        reconciled[field_key] = {
            "reconciled_score": reconciled_score,
            "notes": (
                f"Reconciler (heuristic): critic={critic_score:.2f}, "
                f"auditor={auditor_score:.2f} → resolved={reconciled_score:.2f}"
            ),
        }

    return reconciled


def _call_gemini_reconciler(
    ocr_text: str,
    field_key: str,
    field_value: Any,
    critic_score: float,
    critic_notes: str,
    auditor_score: float,
    auditor_notes: str,
) -> dict[str, Any]:
    """Ask Gemini to adjudicate the disagreement on a specific field."""
    import asyncio
    import json

    from app.services.llm import call_llm_cached
    prompt = f"""
You are a Reconciler Agent arbitrating a disagreement between two AI validation agents
about a specific extracted field from a business document.

Field: {field_key}
Extracted value: {field_value}

Critic Agent score: {critic_score} — Notes: {critic_notes}
Auditor Agent score: {auditor_score} — Notes: {auditor_notes}

Relevant OCR text (excerpt, max 800 chars):
{ocr_text[:800]}

Your task: Decide the correct confidence score (0.0 to 1.0) for this field
by examining the OCR text and the agents' reasoning.

Respond ONLY with valid JSON in this exact format:
{{"reconciled_score": 0.87, "notes": "Brief explanation of your decision."}}
"""
    async def _run():
        response_text, provider, from_cache = await call_llm_cached(
            prompt=prompt,
            temperature=0.0,
            use_cache=True
        )
        return response_text

    content = asyncio.run(_run()).strip()
    if content.startswith("```json"):
        content = content[7:]
    if content.endswith("```"):
        content = content[:-3]
    data = json.loads(content.strip())
    score = max(0.0, min(1.0, float(data.get("reconciled_score", 0.75))))
    return {
        "reconciled_score": round(score, 4),
        "notes": data.get("notes", "Reconciled by Gemini."),
    }
