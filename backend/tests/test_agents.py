"""
Unit tests for DocIntel AI Multi-Agent Consensus circle:
- Auditor Agent (US/European format math, graduated scoring)
- Critic Agent (Hallucination detection against OCR text)
- Compliance Agent (Jurisdiction & mandatory regulatory clauses)
- Reconciler Agent (Inter-agent conflict resolution)
"""

from app.agents.auditor import _parse_decimal, run_auditor_agent
from app.agents.compliance import run_compliance_agent
from app.agents.critic import run_critic_agent
from app.agents.reconciler import run_reconciler_agent
from app.models.document import DocumentCategory


def test_auditor_exact_match_us_format():
    """Verify auditor passes exact arithmetic match in standard US currency format."""
    fields = {
        "subtotal": "$1,000.00",
        "tax": "$100.00",
        "shipping": "$25.00",
        "total_amount": "$1,125.00",
    }
    results = run_auditor_agent(DocumentCategory.INVOICE, fields)
    assert results["total_amount"]["score"] == 1.0
    assert "Verified" in results["total_amount"]["notes"]


def test_auditor_european_number_format():
    """Verify decimal parser handles European number formatting with comma decimals."""
    val = _parse_decimal("1.250,50")
    assert float(val) == 1250.50

    fields = {
        "subtotal": "1.000,00",
        "tax": "100,00",
        "shipping": "25,00",
        "total_amount": "1.125,00",
    }
    results = run_auditor_agent(DocumentCategory.INVOICE, fields)
    assert results["total_amount"]["score"] == 1.0


def test_auditor_graduated_math_penalty_large_discrepancy():
    """Verify auditor assigns a 0.0 score when math discrepancy exceeds 5%."""
    fields = {
        "subtotal": "1000.00",
        "tax": "100.00",
        "shipping": "0.00",
        "total_amount": "1500.00",  # Stated $1500 vs calculated $1100 (~26% error)
    }
    results = run_auditor_agent(DocumentCategory.INVOICE, fields)
    assert results["total_amount"]["score"] == 0.0
    assert "arithmetic failure" in results["total_amount"]["notes"].lower()


def test_critic_flags_hallucinated_values():
    """Verify critic penalizes fields whose values do not appear in the raw OCR text."""
    ocr_text = "INVOICE #4091\nVendor: Apex Industrial Corp\nTotal: $500.00"
    fields = {
        "vendor_name": "Apex Industrial Corp",
        "total_amount": "$500.00",
        "fake_field": "NonExistentHallucination999",
    }
    results = run_critic_agent(ocr_text, fields)
    assert results["vendor_name"]["score"] > 0.8
    assert results["fake_field"]["score"] <= 0.5


def test_compliance_contract_governing_law():
    """Verify compliance agent checks governing law in legal agreements."""
    ocr_text = "This Master Agreement shall be governed by the laws of the State of Delaware."
    fields = {"governing_law": "Delaware"}
    results = run_compliance_agent(ocr_text, DocumentCategory.CONTRACT, fields)
    assert results["governing_law"]["score"] == 1.0

    missing_ocr = "This document is an agreement between two parties without specifying venue or jurisdiction."
    missing_results = run_compliance_agent(missing_ocr, DocumentCategory.CONTRACT, fields)
    assert missing_results["governing_law"]["score"] == 0.0


def test_reconciler_conflict_resolution():
    """Verify reconciler resolves high-variance conflicts between Auditor and Critic."""
    critic_scores = {"total_amount": {"score": 0.95, "notes": "Found in OCR"}}
    auditor_scores = {"total_amount": {"score": 0.0, "notes": "Math mismatch"}}
    extracted_fields = {"total_amount": "1500.00"}
    ocr_text = "Total: 1500.00"

    reconciled = run_reconciler_agent(
        ocr_text,
        extracted_fields,
        critic_scores,
        auditor_scores,
    )
    assert "total_amount" in reconciled
    assert reconciled["total_amount"]["reconciled_score"] < 0.5
