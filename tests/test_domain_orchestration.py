"""
Unit & Integration Tests for Domain Orchestration Layer
"""

from decimal import Decimal
import pytest
import uuid

from app.domain.aggregate import DocumentAggregate, DomainExtractedField
from app.domain.consensus_engine import AgentVote, ConsensusEngine, MajorityConsensus, WeightedConsensus
from app.domain.provider_router import CircuitBreaker, MockLocalFallbackProvider, ProviderRouter
from app.domain.rule_engine import (
    CurrencyValidationRule,
    DateValidationRule,
    InvoiceTotalRule,
    RuleEngine,
    RuleStatus,
)
from app.domain.state_machine import DocumentState, DocumentStateMachine, InvalidStateTransitionError
from app.domain.value_objects import ConfidenceScore, DocumentHash, DocumentId, Money, TenantId


def test_money_value_object():
    m1 = Money.of(100.50, "USD")
    m2 = Money.of("49.50", "USD")
    m3 = m1 + m2
    assert m3.amount == Decimal("150.00")
    assert m3.currency == "USD"
    assert str(m3) == "150.00 USD"

    m_sub = m1 - m2
    assert m_sub.amount == Decimal("51.00")

    with pytest.raises(ValueError):
        _ = m1 + Money.of(10, "EUR")


def test_confidence_score_boundaries():
    c_valid = ConfidenceScore(0.95)
    assert c_valid.is_high_confidence()
    assert not c_valid.is_flagged()

    c_low = ConfidenceScore(0.40)
    assert not c_low.is_high_confidence()
    assert c_low.is_flagged()

    with pytest.raises(ValueError):
        ConfidenceScore(1.5)

    with pytest.raises(ValueError):
        ConfidenceScore(-0.1)


def test_document_hash_validation():
    valid_hash = "a" * 64
    dh = DocumentHash(valid_hash)
    assert str(dh) == valid_hash

    with pytest.raises(ValueError):
        DocumentHash("short_invalid_hash")


def test_state_machine_valid_transitions():
    sm = DocumentStateMachine()
    assert sm.current_state == DocumentState.UPLOADED

    sm.transition_to(DocumentState.VALIDATING, "Validating file integrity")
    assert sm.current_state == DocumentState.VALIDATING

    sm.transition_to(DocumentState.QUEUED, "Enqueueing to RabbitMQ")
    assert sm.current_state == DocumentState.QUEUED

    sm.transition_to(DocumentState.PROCESSING, "Worker started OCR")
    assert sm.current_state == DocumentState.PROCESSING

    sm.transition_to(DocumentState.EXTRACTED, "Fields extracted")
    assert sm.current_state == DocumentState.EXTRACTED

    sm.transition_to(DocumentState.VALIDATED, "Rules executed")
    assert sm.current_state == DocumentState.VALIDATED

    sm.transition_to(DocumentState.APPROVED, "Auto-approved")
    assert sm.current_state == DocumentState.APPROVED


def test_state_machine_invalid_transition():
    sm = DocumentStateMachine()
    with pytest.raises(InvalidStateTransitionError):
        sm.transition_to(DocumentState.APPROVED, "Illegal direct jump")


def test_invoice_total_rule():
    rule = InvoiceTotalRule()

    # Exact match
    res_pass = rule.evaluate({
        "subtotal": "100.00",
        "tax": "10.00",
        "shipping": "5.00",
        "discount": "0.00",
        "total_amount": "115.00",
        "currency": "USD"
    })
    assert res_pass.status == RuleStatus.PASS
    assert res_pass.score == 1.0

    # Mismatch
    res_fail = rule.evaluate({
        "subtotal": "100.00",
        "tax": "10.00",
        "shipping": "5.00",
        "discount": "0.00",
        "total_amount": "999.00",
        "currency": "USD"
    })
    assert res_fail.status == RuleStatus.FAIL
    assert res_fail.score == 0.0


def test_currency_and_date_rules():
    curr_rule = CurrencyValidationRule()
    assert curr_rule.evaluate({"currency": "USD"}).status == RuleStatus.PASS
    assert curr_rule.evaluate({"currency": "XYZ"}).status == RuleStatus.WARNING

    date_rule = DateValidationRule()
    assert date_rule.evaluate({"invoice_date": "2026-01-01", "due_date": "2026-01-30"}).status == RuleStatus.PASS
    assert date_rule.evaluate({"invoice_date": "2026-02-01", "due_date": "2026-01-01"}).status == RuleStatus.FAIL


def test_consensus_engine_majority_and_weighted():
    votes = [
        AgentVote(agent_name="Extractor", field_key="total", value="1500", confidence=0.85),
        AgentVote(agent_name="Critic", field_key="total", value="1500", confidence=0.90),
        AgentVote(agent_name="Auditor", field_key="total", value="1500", confidence=0.98),
    ]

    majority = MajorityConsensus()
    res_maj = majority.reach_consensus("total", votes)
    assert res_maj.consensus_value == "1500"
    assert res_maj.agreement_ratio == 1.0

    weighted = WeightedConsensus()
    res_wt = weighted.reach_consensus("total", votes)
    assert res_wt.consensus_value == "1500"
    assert res_wt.confidence.value > 0.85


def test_circuit_breaker():
    cb = CircuitBreaker(failure_threshold=2, recovery_timeout=0.1)
    assert cb.can_attempt()

    cb.record_failure()
    assert cb.can_attempt()

    cb.record_failure()
    assert cb.state == "OPEN"
    assert not cb.can_attempt()


@pytest.mark.asyncio
async def test_provider_router_fallback():
    router = ProviderRouter()
    res, provider = await router.generate("Test prompt")
    assert isinstance(res, str)
    assert isinstance(provider, str)


def test_document_aggregate_lifecycle():
    content_hash = "f" * 64
    doc = DocumentAggregate.create(
        filename="invoice_1001.pdf",
        file_path="/uploads/test.pdf",
        file_type="PDF",
        content_hash=content_hash,
        organization_id=uuid.uuid4(),
    )

    assert doc.current_state == DocumentState.UPLOADED

    doc.start_processing()
    assert doc.current_state == DocumentState.PROCESSING

    doc.set_extracted_fields([
        DomainExtractedField(
            field_key="subtotal",
            value="100.00",
            confidence=ConfidenceScore(0.95),
            page_number=1,
            evidence_text="Subtotal: $100.00"
        ),
        DomainExtractedField(
            field_key="tax",
            value="10.00",
            confidence=ConfidenceScore(0.95),
            page_number=1,
            evidence_text="Tax: $10.00"
        ),
        DomainExtractedField(
            field_key="total_amount",
            value="110.00",
            confidence=ConfidenceScore(0.98),
            page_number=1,
            evidence_text="Total: $110.00"
        ),
    ], category="INVOICE")

    assert doc.current_state == DocumentState.EXTRACTED

    is_valid = doc.validate_rules()
    assert is_valid
    assert doc.current_state == DocumentState.APPROVED
    assert doc.get_overall_confidence() > 0.90
