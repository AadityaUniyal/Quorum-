"""
Memory Agent — drift detection using ChromaDB historical embeddings.

Compares key fields of the current document against the average of previously
processed documents from the same vendor/entity to detect anomalous values.
"""
import logging
from typing import Any

logger = logging.getLogger(__name__)

# Fields to check for drift per category
DRIFT_FIELDS: dict[str, list[str]] = {
    "INVOICE":  ["total_amount", "tax", "subtotal"],
    "RFQ":      ["quantity"],
    "CONTRACT": [],
    "COMPLIANCE": [],
}

# Percentage deviation that triggers a drift warning
DRIFT_WARN_THRESHOLD = 0.40   # 40 % above/below historical average
DRIFT_CRITICAL_THRESHOLD = 1.0  # 100 % (double / half the average)


def run_memory_agent(
    category: str,
    extracted_fields: dict[str, Any],
    vendor_key: str | None = None,
) -> dict[str, Any]:
    """
    Memory Agent: compares numeric fields against historical averages stored in ChromaDB.

    Args:
        category:         Document category string.
        extracted_fields: Extracted field key→value pairs from the extractor agent.
        vendor_key:       Optional vendor identifier used to scope the history lookup.

    Returns:
        {
            "drift_flags": [ { "field": str, "current": float, "historical_avg": float,
                               "deviation_pct": float, "severity": "WARNING"|"CRITICAL" } ],
            "summary": str
        }
    """
    drift_flags = []
    fields_to_check = DRIFT_FIELDS.get(category, [])

    if not fields_to_check:
        return {"drift_flags": [], "summary": "Memory Agent: no numeric drift checks for this document type."}

    # Fetch historical averages from ChromaDB metadata
    historical_averages = _get_historical_averages(category, vendor_key, fields_to_check)

    for field in fields_to_check:
        raw_val = extracted_fields.get(field)
        if raw_val is None:
            continue

        try:
            current_val = float(str(raw_val).replace("$", "").replace(",", "").strip())
        except (ValueError, TypeError):
            continue

        if current_val == 0:
            continue

        hist_avg = historical_averages.get(field)
        if hist_avg is None or hist_avg == 0:
            continue

        deviation_pct = abs(current_val - hist_avg) / hist_avg

        if deviation_pct >= DRIFT_CRITICAL_THRESHOLD:
            drift_flags.append({
                "field": field,
                "current": current_val,
                "historical_avg": round(hist_avg, 2),
                "deviation_pct": round(deviation_pct * 100, 1),
                "severity": "CRITICAL",
            })
            logger.warning(
                f"Memory Agent CRITICAL drift on '{field}': "
                f"current={current_val}, avg={hist_avg:.2f}, dev={deviation_pct:.1%}"
            )
        elif deviation_pct >= DRIFT_WARN_THRESHOLD:
            drift_flags.append({
                "field": field,
                "current": current_val,
                "historical_avg": round(hist_avg, 2),
                "deviation_pct": round(deviation_pct * 100, 1),
                "severity": "WARNING",
            })
            logger.info(
                f"Memory Agent WARNING drift on '{field}': "
                f"current={current_val}, avg={hist_avg:.2f}, dev={deviation_pct:.1%}"
            )

    if drift_flags:
        flags_desc = "; ".join(
            f"{f['field']} is {f['deviation_pct']}% {'above' if f['current'] > f['historical_avg'] else 'below'} "
            f"the historical average ({f['severity']})"
            for f in drift_flags
        )
        summary = f"Memory Agent detected {len(drift_flags)} drift flag(s): {flags_desc}."
    else:
        summary = "Memory Agent: all numeric fields are within historical norms."

    return {"drift_flags": drift_flags, "summary": summary}


def _get_historical_averages(
    category: str,
    vendor_key: str | None,
    fields: list[str],
) -> dict[str, float]:
    """
    Query ChromaDB for recent documents of the same category/vendor
    and compute the average value of each numeric field from metadata.
    """
    try:
        from app.services.vector_store import collection

        where: dict = {"category": category}
        if vendor_key:
            where["vendor_name"] = vendor_key

        results = collection.get(
            where=where,
            limit=50,
            include=["metadatas"],
        )

        if not results or not results.get("metadatas"):
            return {}

        averages: dict[str, list[float]] = {f: [] for f in fields}
        for meta in results["metadatas"]:
            for field in fields:
                raw = meta.get(field)
                if raw is not None:
                    try:
                        val = float(str(raw).replace("$", "").replace(",", "").strip())
                        if val > 0:
                            averages[field].append(val)
                    except (ValueError, TypeError):
                        pass

        return {
            f: sum(vals) / len(vals)
            for f, vals in averages.items()
            if vals
        }

    except Exception as exc:
        logger.debug(f"Memory Agent history lookup failed (non-critical): {exc}")
        return {}
