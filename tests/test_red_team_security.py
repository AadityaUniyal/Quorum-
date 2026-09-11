"""
Red-Team Security & Evaluation Test Suite
"""

import pytest

from app.core.security_net import validate_safe_url
from app.domain.rule_engine import InvoiceTotalRule, RuleStatus
from app.services.benchmark_evaluator import BenchmarkEvaluator
from app.services.citation_verifier import verify_citations
from app.services.document_diff import DiffChangeType, DocumentDiffEngine
from app.services.synthetic_generator import SyntheticDocumentGenerator


def test_ssrf_protection_blocked_ips():
    """Verify that dangerous private and metadata URLs are blocked."""
    blocked_urls = [
        "http://127.0.0.1:8000/secret",
        "http://localhost:8080/admin",
        "http://169.254.169.254/latest/meta-data/",
        "http://10.0.0.5/internal",
        "http://192.168.1.1/router",
        "http://172.16.0.1/private",
        "ftp://example.com/file",
        "file:///etc/passwd",
    ]

    for url in blocked_urls:
        with pytest.raises(ValueError):
            validate_safe_url(url, allow_local_for_testing=False)


def test_citation_verification_catches_hallucinations():
    """Verify that claims with no evidence in source chunks are flagged."""
    source_chunks = [
        {"document_id": "doc-1", "filename": "invoice_1001.pdf", "id": "c1", "text": "Subtotal is $500.00. Tax is $50.00. Total amount payable is $550.00."},
    ]

    # Grounded answer
    grounded_ans = "The total amount payable is $550.00 with tax of $50.00."
    report_grounded = verify_citations(grounded_ans, source_chunks)
    assert report_grounded["is_grounded"]
    assert report_grounded["grounding_score"] >= 0.70
    assert len(report_grounded["citations"]) > 0

    # Hallucinated answer with fabricated facts
    hallucinated_ans = "The vendor was Acme Corporation and the CEO is John Doe from Antarctica."
    report_hallucinated = verify_citations(hallucinated_ans, source_chunks)
    assert not report_hallucinated["is_grounded"]
    assert len(report_hallucinated["unsupported_claims"]) > 0


def test_document_diff_engine():
    """Verify field-level diff detection between two versions."""
    v1 = {"vendor": "Acme", "total": "500.00", "currency": "USD"}
    v2 = {"vendor": "Acme", "total": "600.00", "tax": "60.00"}

    diff_result = DocumentDiffEngine.compare_fields(v1, v2)
    diff_map = {d.field_key: d for d in diff_result.diffs}

    assert diff_map["vendor"].change_type == DiffChangeType.UNCHANGED
    assert diff_map["total"].change_type == DiffChangeType.CHANGED
    assert diff_map["currency"].change_type == DiffChangeType.REMOVED
    assert diff_map["tax"].change_type == DiffChangeType.ADDED


def test_synthetic_benchmark_evaluation():
    """Generate synthetic documents and run quality evaluation."""
    docs = [
        SyntheticDocumentGenerator.generate_invoice(inject_arithmetic_error=False, invoice_num=1),
        SyntheticDocumentGenerator.generate_invoice(inject_arithmetic_error=False, invoice_num=2),
        SyntheticDocumentGenerator.generate_invoice(inject_arithmetic_error=True, invoice_num=3),
    ]

    report = BenchmarkEvaluator.evaluate_synthetic_dataset(docs)
    assert report.total_samples == 3
    assert report.rule_validation_accuracy == 1.0
