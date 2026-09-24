import logging
from typing import Any

from app.agents.auditor import run_auditor_agent
from app.agents.compliance import run_compliance_agent
from app.agents.critic import run_critic_agent
from app.agents.extractor import run_extractor_agent
from app.agents.memory import run_memory_agent
from app.agents.reconciler import run_reconciler_agent
from app.agents.summary import run_summary_agent
from app.models.document import DocumentCategory, FieldValidationStatus

logger = logging.getLogger(__name__)

# Category-aware agent weight configuration: (critic, auditor, compliance)
WEIGHT_CONFIG: dict[DocumentCategory, tuple[float, float, float]] = {
    DocumentCategory.INVOICE:        (0.3, 0.5, 0.2),  # Math matters most
    DocumentCategory.CONTRACT:       (0.3, 0.1, 0.6),  # Compliance matters most
    DocumentCategory.COMPLIANCE:     (0.2, 0.1, 0.7),  # Compliance critical
    DocumentCategory.RFQ:            (0.5, 0.3, 0.2),  # Accuracy matters most
    DocumentCategory.PURCHASE_ORDER: (0.4, 0.4, 0.2),  # Balanced
    DocumentCategory.UNKNOWN:        (0.5, 0.3, 0.2),  # Default
}


async def run_agent_safe(agent_func, *args, timeout_seconds: float = 15.0) -> dict:
    import asyncio
    import time

    from opentelemetry import trace

    from app.main import metrics

    tracer = trace.get_tracer(__name__)
    func_name = getattr(agent_func, "__name__", getattr(type(agent_func), "__name__", "agent"))
    span_name = f"consensus.{func_name}"

    start_time = time.time()
    with tracer.start_as_current_span(span_name) as span:
        span.set_attribute("agent.name", func_name)
        try:
            result = await asyncio.wait_for(asyncio.to_thread(agent_func, *args), timeout=timeout_seconds)
            duration = time.time() - start_time
            metrics.record_agent_latency(func_name, duration)
            span.set_attribute("agent.status", "success")
            span.set_attribute("agent.duration_seconds", duration)
            return result
        except TimeoutError:
            duration = time.time() - start_time
            logger.error(f"Agent {func_name} timed out after {timeout_seconds}s. Task cancelled.")
            metrics.record_agent_latency(func_name, duration)
            span.set_attribute("agent.status", "timeout")
            span.set_attribute("agent.duration_seconds", duration)
            return {}
        except Exception as e:
            duration = time.time() - start_time
            logger.error(f"Agent {agent_func.__name__} raised an exception: {e}")
            metrics.record_agent_latency(agent_func.__name__, duration)
            span.set_attribute("agent.status", "error")
            span.set_attribute("agent.duration_seconds", duration)
            span.record_exception(e)
            return {}


async def run_agent_consensus(ocr_text: str, category: DocumentCategory) -> dict[str, Any]:
    """
    Orchestrates the full 7-agent consensus pipeline:

    1. Extractor Agent   – structured field extraction
    2. Critic Agent      – cross-verification against OCR text
    3. Auditor Agent     – deterministic math / logic checks
    4. Compliance Agent  – regulatory checklist evaluation
    5. Reconciler Agent  – resolves Critic/Auditor conflicts > 0.3 gap
    6. Memory Agent      – historical drift detection via ChromaDB
    7. Summary Agent     – 3-sentence executive summary

    Returns a dict with overall_score, fields list, drift_flags, and summary.
    """
    logger.info(f"Starting multi-agent consensus for category: {category.value}")

    # ── Step 1: Extraction ───────────────────────────────────────────────────
    extracted_fields = run_extractor_agent(ocr_text, category)
    logger.info(f"Extractor completed: {list(extracted_fields.keys())}")

    # ── Steps 2-4: Concurrent validation ────────────────────────────────────
    import asyncio
    critic_results, auditor_results, compliance_results = await asyncio.gather(
        run_agent_safe(run_critic_agent, ocr_text, extracted_fields, timeout_seconds=15.0),
        run_agent_safe(run_auditor_agent, category, extracted_fields, timeout_seconds=15.0),
        run_agent_safe(run_compliance_agent, ocr_text, category, extracted_fields, timeout_seconds=15.0)
    )
    logger.info("Critic, Auditor, and Compliance concurrent validation step finished.")

    # ── Step 5: Reconciler (conflict resolution) ─────────────────────────────
    try:
        reconciler_results = await asyncio.wait_for(
            asyncio.to_thread(
                run_reconciler_agent, ocr_text, extracted_fields, critic_results, auditor_results
            ),
            timeout=5.0
        )
    except TimeoutError:
        logger.warning("Reconciler agent timed out. Skipping conflict resolution.")
        reconciler_results = {}

    if reconciler_results:
        logger.info(
            f"Reconciler resolved {len(reconciler_results)} conflict(s): "
            f"{list(reconciler_results.keys())}"
        )

    # ── Step 6: Memory Agent (drift detection) ───────────────────────────────
    vendor_key = str(extracted_fields.get("vendor_name") or extracted_fields.get("client_name") or "")
    try:
        memory_result = await asyncio.wait_for(
            asyncio.to_thread(
                run_memory_agent, category.value, extracted_fields, vendor_key or None
            ),
            timeout=5.0
        )
    except TimeoutError:
        logger.warning("Memory agent timed out. Skipping historical drift verification.")
        memory_result = {}

    drift_flags = memory_result.get("drift_flags", []) if memory_result else []
    drift_fields = {f["field"] for f in drift_flags} if drift_flags else set()
    if drift_flags:
        logger.warning(f"Memory Agent: {len(drift_flags)} drift flag(s) detected.")

    # ── Step 7: Summary Agent ────────────────────────────────────────────────
    try:
        executive_summary = await asyncio.wait_for(
            asyncio.to_thread(
                run_summary_agent, ocr_text, category.value, extracted_fields
            ),
            timeout=5.0
        )
    except TimeoutError:
        logger.warning("Summary agent timed out. Skipping executive summary generation.")
        executive_summary = ""

    # ── Field-aware and weighted consensus calculation ──────────────────────
    cat_critic, cat_auditor, cat_compliance = WEIGHT_CONFIG.get(
        category, WEIGHT_CONFIG[DocumentCategory.UNKNOWN]
    )

    financial_keys = {"total_amount", "subtotal", "tax", "shipping", "discount", "quantity"}
    compliance_keys = {"governing_law", "standards", "compliance", "regulations"}

    field_reports = []
    weighted_confidence_sum = 0.0
    total_field_weights = 0.0
    has_anchor_arithmetic_failure = False

    for key, value in extracted_fields.items():
        # Determine agent weights for this specific field type
        if key in ("total_amount", "subtotal"):
            w_critic, w_auditor, w_compliance = 0.25, 0.65, 0.10
            field_importance = 0.30
        elif key in financial_keys or key == "line_items":
            w_critic, w_auditor, w_compliance = 0.30, 0.55, 0.15
            field_importance = 0.15
        elif key in compliance_keys:
            w_critic, w_auditor, w_compliance = 0.25, 0.00, 0.75
            field_importance = 0.25
        else:
            # Metadata / text fields (vendor_name, invoice_number, dates, etc.)
            w_critic, w_auditor, w_compliance = 0.85, 0.00, 0.15
            field_importance = 0.05

        # Check agent availability (avoid treating timeout / network failure as 0.0 score)
        critic_eval = critic_results.get(key)
        auditor_eval = auditor_results.get(key)
        compliance_eval = compliance_results.get(key)

        active_weights = 0.0
        weighted_val = 0.0
        missing_agent_penalty = 0.0

        if critic_eval is not None and "score" in critic_eval:
            critic_score = float(critic_eval["score"])
            weighted_val += critic_score * w_critic
            active_weights += w_critic
        elif w_critic > 0:
            critic_score = 0.70  # Conservative estimate
            missing_agent_penalty += 0.05
            critic_eval = {"score": critic_score, "notes": "Critic check unavailable (skipped/timed out)"}

        if auditor_eval is not None and "score" in auditor_eval:
            auditor_score = float(auditor_eval["score"])
            weighted_val += auditor_score * w_auditor
            active_weights += w_auditor
        elif w_auditor > 0:
            auditor_score = 0.70
            missing_agent_penalty += 0.05
            auditor_eval = {"score": auditor_score, "notes": "Auditor check unavailable (skipped/timed out)"}
        else:
            auditor_score = 1.0  # Inapplicable agent defaults to pass

        if compliance_eval is not None and "score" in compliance_eval:
            compliance_score = float(compliance_eval["score"])
            weighted_val += compliance_score * w_compliance
            active_weights += w_compliance
        elif w_compliance > 0:
            compliance_score = 0.70
            missing_agent_penalty += 0.05
            compliance_eval = {"score": compliance_score, "notes": "Compliance check unavailable (skipped/timed out)"}
        else:
            compliance_score = 1.0

        # Compute normalized confidence among applicable active agents
        if active_weights > 0:
            confidence = (weighted_val / active_weights) - missing_agent_penalty
        else:
            confidence = 0.95

        # If the Reconciler resolved this field, adopt its adjudicated score
        if key in reconciler_results:
            rec_score = reconciler_results[key]["reconciled_score"]
            confidence = rec_score
            critic_score = round((critic_score + rec_score) / 2, 2)
            auditor_score = round((auditor_score + rec_score) / 2, 2)

        # Apply memory drift penalty if historical anomaly detected
        if key in drift_fields:
            drift_entry = next((d for d in drift_flags if d["field"] == key), None)
            if drift_entry:
                penalty = 0.15 if drift_entry.get("severity") == "CRITICAL" else 0.07
                confidence = max(0.0, confidence - penalty)

        confidence = max(0.0, min(1.0, confidence))

        # Check for anchor failure
        if key in ("total_amount", "subtotal") and auditor_score == 0.0:
            has_anchor_arithmetic_failure = True

        # Build validation notes
        notes_list = []
        if critic_eval and critic_eval.get("notes") and critic_score < 0.95:
            notes_list.append(f"Critic: {critic_eval['notes']}")
        if auditor_eval and auditor_eval.get("notes") and auditor_score < 1.0:
            notes_list.append(f"Auditor: {auditor_eval['notes']}")
        if compliance_eval and compliance_eval.get("notes") and compliance_score < 1.0:
            notes_list.append(f"Compliance: {compliance_eval['notes']}")
        if key in reconciler_results:
            notes_list.append(f"Reconciler: {reconciler_results[key]['notes']}")
        if key in drift_fields:
            drift_entry = next((d for d in drift_flags if d["field"] == key), None)
            if drift_entry:
                notes_list.append(
                    f"Memory [{drift_entry['severity']}]: "
                    f"{key} deviates {drift_entry.get('deviation_pct', 0)}% from historical average."
                )

        validation_notes = " | ".join(notes_list) if notes_list else "All checks passed."
        validation_status = FieldValidationStatus.VALID

        # Mark FLAGGED if confidence is below threshold or applicable anchor check explicitly failed
        if confidence < 0.85:
            validation_status = FieldValidationStatus.FLAGGED
        elif key in financial_keys and auditor_score == 0.0:
            validation_status = FieldValidationStatus.FLAGGED
        elif key in compliance_keys and compliance_score == 0.0:
            validation_status = FieldValidationStatus.FLAGGED

        field_reports.append({
            "field_key":         key,
            "extracted_value":   str(value),
            "critic_score":      critic_score,
            "auditor_score":     auditor_score,
            "consensus_value":   str(value),
            "confidence_score":  round(confidence, 4),
            "is_modified":       False,
            "validation_status": validation_status,
            "validation_notes":  validation_notes,
        })

        weighted_confidence_sum += confidence * field_importance
        total_field_weights += field_importance

    # Normalized overall score based on field importance
    if total_field_weights > 0:
        overall_score = round(weighted_confidence_sum / total_field_weights, 4)
    else:
        overall_score = 1.0

    # If anchor financial calculation failed, cap overall score so it accurately reflects critical failure
    if has_anchor_arithmetic_failure:
        overall_score = min(overall_score, 0.55)

    logger.info(f"Consensus complete — score: {overall_score:.2%}, drift flags: {len(drift_flags)}")

    return {
        "overall_score":    overall_score,
        "fields":           field_reports,
        "drift_flags":      drift_flags,
        "executive_summary": executive_summary,
    }
