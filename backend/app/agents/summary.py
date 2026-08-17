"""
Summary Agent — generates a 3-sentence executive summary for each processed document.

Uses Gemini if available; falls back to a deterministic keyword-extraction summary.
"""
import logging
import re

from app.config import settings

logger = logging.getLogger(__name__)


def run_summary_agent(ocr_text: str, category: str, extracted_fields: dict) -> str:
    """
    Generates a concise 3-sentence executive summary of the document.

    Args:
        ocr_text: Raw OCR text of the document.
        category: Document category string (e.g. "INVOICE").
        extracted_fields: Dict of already-extracted field key→value pairs.

    Returns:
        A 3-sentence plain-text summary string.
    """
    if settings.GEMINI_API_KEY:
        try:
            return _call_gemini_summary(ocr_text, category, extracted_fields)
        except Exception as exc:
            logger.warning(f"Summary Agent (Gemini) failed: {exc}. Using heuristic fallback.")

    return _heuristic_summary(ocr_text, category, extracted_fields)


def _call_gemini_summary(ocr_text: str, category: str, extracted_fields: dict) -> str:
    import asyncio

    from app.services.llm import call_llm_cached
    fields_str = ", ".join(f"{k}: {v}" for k, v in list(extracted_fields.items())[:8])
    prompt = f"""
You are a Summary Agent. Generate exactly 3 concise sentences summarising this
{category} business document for an executive reader.

Key extracted fields: {fields_str}

Document text (first 1200 characters):
{ocr_text[:1200]}

Rules:
- Exactly 3 sentences, no bullet points.
- Include the most important financial or legal figures.
- End with any flags or compliance concerns if present.
- Plain text only, no markdown.
"""
    async def _run():
        response_text, provider, from_cache = await call_llm_cached(
            prompt=prompt,
            temperature=0.2,
            use_cache=True
        )
        return response_text

    text = asyncio.run(_run()).strip()
    # Ensure no more than 3 sentences
    sentences = re.split(r"(?<=[.!?])\s+", text)
    return " ".join(sentences[:3])


def _heuristic_summary(ocr_text: str, category: str, extracted_fields: dict) -> str:
    """Deterministic fallback: build a summary from extracted field values."""
    cat = category.replace("_", " ").title()

    # Sentence 1: document type + primary identifiers
    if category == "INVOICE":
        s1 = (
            f"This is an invoice from {extracted_fields.get('vendor_name', 'an unknown vendor')} "
            f"(#{extracted_fields.get('invoice_number', 'N/A')}) "
            f"dated {extracted_fields.get('invoice_date', 'an unspecified date')}."
        )
        s2 = (
            f"The total amount due is "
            f"${extracted_fields.get('total_amount', '0.00')}, "
            f"comprising a subtotal of ${extracted_fields.get('subtotal', '0.00')}, "
            f"tax of ${extracted_fields.get('tax', '0.00')}, "
            f"and shipping of ${extracted_fields.get('shipping', '0.00')}."
        )
    elif category == "CONTRACT":
        s1 = (
            f"This is a contract between "
            f"{extracted_fields.get('client_name', 'an unnamed client')} and "
            f"{extracted_fields.get('contractor_name', 'an unnamed contractor')}, "
            f"effective {extracted_fields.get('effective_date', 'an unspecified date')}."
        )
        s2 = (
            f"The agreement expires on {extracted_fields.get('expiry_date', 'an unspecified date')} "
            f"and is governed by the laws of {extracted_fields.get('governing_law', 'an unspecified jurisdiction')}."
        )
    elif category == "RFQ":
        s1 = (
            f"This is a Request for Quotation (#{extracted_fields.get('rfq_reference', 'N/A')}) "
            f"for part {extracted_fields.get('part_number', 'N/A')} "
            f"made from {extracted_fields.get('material', 'unspecified material')}."
        )
        s2 = (
            f"The requested quantity is {extracted_fields.get('quantity', '0')} units "
            f"with a tolerance of {extracted_fields.get('tolerance', 'N/A')}."
        )
    elif category == "COMPLIANCE":
        s1 = (
            f"This is a compliance certificate "
            f"(#{extracted_fields.get('certificate_number', 'N/A')}) "
            f"issued on {extracted_fields.get('issue_date', 'an unspecified date')}."
        )
        s2 = (
            f"The certificate covers {extracted_fields.get('standards', 'unspecified standards')} "
            f"for manufacturer {extracted_fields.get('manufacturer', 'N/A')}."
        )
    else:
        s1 = f"This is a {cat} document titled '{extracted_fields.get('document_title', 'Untitled')}'."
        s2 = f"It was processed on {extracted_fields.get('extracted_date', 'an unspecified date')}."

    # Sentence 3: flag any N/A fields
    na_fields = [k for k, v in extracted_fields.items() if str(v).strip() in ("N/A", "0", "0.00", "")]
    if na_fields:
        s3 = f"Note: the following fields could not be extracted and require manual review: {', '.join(na_fields[:4])}."
    else:
        s3 = "All key fields were successfully extracted and passed automated validation."

    return f"{s1} {s2} {s3}"
