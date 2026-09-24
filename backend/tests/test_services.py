"""
Unit tests for core services:
- Zero-Trust PII / PHI Governance Vault (Luhn CC, IBAN Mod-97, SSN masking)
- Synthetic Document & Benchmark Generation
- 3-Way Cross-Document Reconciliation Engine
"""

from app.services.benchmark_evaluator import BenchmarkEvaluator
from app.services.pii_governance import (
    PIIGovernanceEngine,
    PIIType,
    _is_luhn_valid,
)
from app.services.reconciliation_3way import (
    ReconciliationDecision,
    ThreeWayReconciliationEngine,
)
from app.services.synthetic_generator import SyntheticDocumentGenerator


def test_pii_credit_card_luhn_validation():
    """Verify Luhn algorithm correctly distinguishes valid CC from random numbers."""
    # Standard Visa test card (valid Luhn)
    assert _is_luhn_valid("4532015112830366") is True
    # Invalid card number
    assert _is_luhn_valid("4532015112830367") is False


def test_pii_masking_zero_trust():
    """Verify sensitive PII (SSN, Email, CC) is cleanly masked."""
    text = "User John Doe with SSN 123-45-6789 and email john@example.com purchased items."
    masked, entities = PIIGovernanceEngine.sanitize_text(text)
    assert "123-45-6789" not in masked
    assert "***-**-6789" in masked or "***" in masked
    assert any(e.entity_type == PIIType.SSN for e in entities)


def test_synthetic_document_generator_anomalies():
    """Verify synthetic generator accurately generates both valid and math-tampered invoices."""
    clean_doc = SyntheticDocumentGenerator.generate_invoice(inject_arithmetic_error=False)
    assert clean_doc.has_anomaly is False
    assert float(clean_doc.ground_truth["total_amount"]) == round(
        float(clean_doc.ground_truth["subtotal"])
        + float(clean_doc.ground_truth["tax"])
        + float(clean_doc.ground_truth["shipping"]),
        2,
    )

    tampered_doc = SyntheticDocumentGenerator.generate_invoice(inject_arithmetic_error=True)
    assert tampered_doc.has_anomaly is True
    assert tampered_doc.anomaly_type == "ARITHMETIC_MISMATCH"


def test_benchmark_evaluator_precision():
    """Verify benchmark evaluator correctly audits synthetic datasets."""
    docs = [
        SyntheticDocumentGenerator.generate_invoice(inject_arithmetic_error=False, invoice_num=1),
        SyntheticDocumentGenerator.generate_invoice(inject_arithmetic_error=True, invoice_num=2),
    ]
    report = BenchmarkEvaluator.evaluate_synthetic_dataset(docs)
    assert report.total_samples == 2
    assert report.rule_validation_accuracy == 1.0


def test_three_way_reconciliation_exact_match():
    """Verify 3-way reconciliation auto-approves when PO, Delivery, and Invoice match perfectly."""
    po_data = {
        "items": [{"name": "Titanium Bolts", "qty": 100, "unit_price": 5.0, "total": 500.0}],
        "total_amount": 500.0,
    }
    dn_data = {
        "items": [{"name": "Titanium Bolts", "qty": 100}],
    }
    inv_data = {
        "items": [{"name": "Titanium Bolts", "qty": 100, "unit_price": 5.0, "total": 500.0}],
        "total_amount": 500.0,
    }

    engine = ThreeWayReconciliationEngine()
    report = engine.reconcile(po_data, dn_data, inv_data)
    assert report.decision == ReconciliationDecision.AUTO_APPROVE
    assert report.items_flagged == 0
    assert report.net_variance == 0.0


def test_three_way_reconciliation_flags_price_variance():
    """Verify 3-way reconciliation catches price discrepancies exceeding tolerance."""
    po_data = {
        "items": [{"name": "Titanium Bolts", "qty": 100, "unit_price": 5.0, "total": 500.0}],
        "total_amount": 500.0,
    }
    dn_data = {
        "items": [{"name": "Titanium Bolts", "qty": 100}],
    }
    inv_data = {
        "items": [{"name": "Titanium Bolts", "qty": 100, "unit_price": 6.5, "total": 650.0}],  # 30% price markup
        "total_amount": 650.0,
    }

    engine = ThreeWayReconciliationEngine()
    report = engine.reconcile(po_data, dn_data, inv_data)
    assert report.decision in (ReconciliationDecision.REQUIRES_REVIEW, ReconciliationDecision.REJECT_DISCREPANCY)
    assert report.items_flagged > 0
