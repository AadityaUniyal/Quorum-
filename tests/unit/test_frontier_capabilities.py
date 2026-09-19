"""
Unit tests for the 5 Frontier Capabilities of DocIntel AI:
1. Spatial PDF Visual Grounding & Bounding Box extraction
2. Enterprise 3-Way Cross-Document Reconciliation (PO <-> Delivery Note <-> Invoice)
3. Multi-Turn Reflexive Agent Debate (Graph of Thoughts)
4. Active Learning & Continual Human Feedback Memory
5. Zero-Trust PII/PHI Redaction & Data Governance
"""


from app.models.document import DocumentCategory
from app.services.active_learning import ActiveLearningService
from app.services.pii_governance import PIIGovernanceEngine, PIIType
from app.services.reconciliation_3way import (
    MatchingStatus,
    ReconciliationDecision,
    ThreeWayReconciliationEngine,
)
from app.services.spatial_grounding import SpatialGroundingEngine

# ─── 1. Zero-Trust PII/PHI Redaction & Governance Tests ─────────────────────

def test_pii_detection_and_redaction():
    text = (
        "Client SSN is 123-45-6789. Email is billing@apexcorp.com. "
        "Tax ID is 12-3456789. Contact at +1 555-123-4567."
    )
    sanitized, entities = PIIGovernanceEngine.sanitize_text(text)

    # Raw SSN, Email, Tax ID must be masked
    assert "123-45-6789" not in sanitized
    assert "12-3456789" not in sanitized
    assert "***-**-6789" in sanitized or "6789" in sanitized

    # Check entities detected
    types = {e.entity_type for e in entities}
    assert PIIType.SSN in types
    assert PIIType.EMAIL in types
    assert PIIType.TAX_ID in types


def test_pii_vault_tokenization_and_abac():
    secret_text = "Vendor Tax ID: 98-7654321 and SSN: 987-65-4321."
    tokenized, vault = PIIGovernanceEngine.tokenize_into_vault(secret_text)

    # Must contain token placeholders
    assert "{{PII_" in tokenized
    assert "98-7654321" not in tokenized
    assert len(vault) >= 2

    # ABAC: Admin role gets raw restored values
    restored_admin = PIIGovernanceEngine.detokenize_for_role(tokenized, vault, user_role="ADMIN")
    assert "98-7654321" in restored_admin
    assert "987-65-4321" in restored_admin

    # ABAC: Regular operator or reviewer gets masked values
    restored_viewer = PIIGovernanceEngine.detokenize_for_role(tokenized, vault, user_role="VIEWER")
    assert "98-7654321" not in restored_viewer
    assert "****" in restored_viewer or "***" in restored_viewer


# ─── 2. Enterprise 3-Way Reconciliation Tests ───────────────────────────────

def test_3way_reconciliation_exact_match():
    po_data = {
        "po_number": "PO-2026-001",
        "items": [
            {"sku": "SKU-A", "qty": 100, "unit_price": 10.0, "total": 1000.0},
            {"sku": "SKU-B", "qty": 50, "unit_price": 20.0, "total": 1000.0},
        ],
        "total_amount": 2000.0,
    }
    delivery_data = {
        "delivery_number": "DN-8812",
        "items": [
            {"sku": "SKU-A", "qty": 100},
            {"sku": "SKU-B", "qty": 50},
        ],
    }
    invoice_data = {
        "invoice_number": "INV-9901",
        "items": [
            {"sku": "SKU-A", "qty": 100, "unit_price": 10.0, "total": 1000.0},
            {"sku": "SKU-B", "qty": 50, "unit_price": 20.0, "total": 1000.0},
        ],
        "total_amount": 2000.0,
    }

    engine = ThreeWayReconciliationEngine(price_tolerance_pct=0.5)
    report = engine.reconcile(po_data, delivery_data, invoice_data)

    assert report.decision == ReconciliationDecision.AUTO_APPROVE
    assert report.items_flagged == 0
    assert report.items_matched == 2
    assert report.net_variance == 0.0


def test_3way_reconciliation_price_variance_flagged():
    po_data = {
        "po_number": "PO-2026-002",
        "items": [{"sku": "SKU-STEEL", "qty": 200, "unit_price": 50.0}],
        "total_amount": 10000.0,
    }
    delivery_data = {
        "items": [{"sku": "SKU-STEEL", "qty": 200}],
    }
    # Invoice inflated price to 55.0 (+10% variance > 0.5% tolerance)
    invoice_data = {
        "invoice_number": "INV-VARIANCE",
        "items": [{"sku": "SKU-STEEL", "qty": 200, "unit_price": 55.0}],
        "total_amount": 11000.0,
    }

    engine = ThreeWayReconciliationEngine(price_tolerance_pct=0.5)
    report = engine.reconcile(po_data, delivery_data, invoice_data)

    assert report.decision == ReconciliationDecision.REQUIRES_REVIEW
    assert report.items_flagged == 1
    flagged = report.line_details[0]
    assert flagged["status"] == MatchingStatus.PRICE_VARIANCE.value
    assert flagged["notes"] != ""


def test_3way_reconciliation_overbilled_and_unordered():
    po_data = {
        "items": [{"sku": "SKU-PO", "qty": 50, "unit_price": 10.0}],
    }
    delivery_data = {
        "items": [{"sku": "SKU-PO", "qty": 50}],
    }
    # Invoice billed 60 units (10 more than ordered & delivered), plus an unexpected SKU-EXTRA
    invoice_data = {
        "items": [
            {"sku": "SKU-PO", "qty": 60, "unit_price": 10.0},
            {"sku": "SKU-EXTRA", "qty": 5, "unit_price": 100.0},
        ],
    }

    engine = ThreeWayReconciliationEngine()
    report = engine.reconcile(po_data, delivery_data, invoice_data)

    assert report.decision == ReconciliationDecision.REJECT_DISCREPANCY
    statuses = {item["status"] for item in report.line_details}
    assert MatchingStatus.OVERBILLED.value in statuses or MatchingStatus.UNORDERED_ITEM.value in statuses


# ─── 3. Multi-Turn Reflexive Agent Debate Tests ─────────────────────────────

def test_reflexive_debate_graph_of_thoughts():
    from app.agents.reflexive_debate import ReflexiveDebateEngine

    initial_fields = {
        "invoice_number": "INV-1002",
        "subtotal": "1000.00",
        "tax": "82.50",
        "total_amount": "1082.50",
    }
    # Create disagreement on total_amount between Critic and Auditor
    critic_results = {
        "invoice_number": {"score": 0.95, "notes": "Matches header"},
        "subtotal": {"score": 0.95, "notes": "Matches line items"},
        "tax": {"score": 0.90, "notes": "Matches tax row"},
        "total_amount": {"score": 0.50, "notes": "Unclear OCR token on decimal"},
    }
    auditor_results = {
        "invoice_number": {"score": 0.95, "notes": "Valid string"},
        "subtotal": {"score": 0.95, "notes": "Valid math"},
        "tax": {"score": 0.90, "notes": "Valid percentage"},
        "total_amount": {"score": 0.95, "notes": "Subtotal 1000 + 82.50 = 1082.50 confirmed"},
    }
    compliance_results = {}

    engine = ReflexiveDebateEngine(max_rounds=3)
    result = engine.run_debate(
        ocr_text="INVOICE: INV-1002 Subtotal $1000.00 Tax $82.50 Total $1082.50",
        category=DocumentCategory.INVOICE,
        initial_fields=initial_fields,
        critic_results=critic_results,
        auditor_results=auditor_results,
        compliance_results=compliance_results,
    )

    assert result.converged is True
    assert result.total_rounds >= 1
    assert len(result.thought_graph) > 0
    # Contested total_amount should have synthesized consensus
    assert "total_amount" in result.field_confidence
    assert result.field_confidence["total_amount"] > 0.65


# ─── 4. Active Learning & Continual Memory Tests ────────────────────────────

def test_active_learning_recording_and_retrieval(tmp_path, monkeypatch):
    import app.services.active_learning as al

    temp_file = str(tmp_path / "test_active_learning.json")
    monkeypatch.setattr(al, "_MEM_FILE_PATH", temp_file)

    diffs = {
        "vendor_tax_id": {"before": "", "after": "US-9918274"},
        "payment_terms": {"before": "Net 15", "after": "Net 30"},
    }

    count = ActiveLearningService.record_corrections(
        document_id="doc-1234",
        category="INVOICE",
        corrections=diffs,
        vendor_name="Acme Corp",
    )
    assert count == 2

    # Retrieve exemplars
    exemplars = ActiveLearningService.get_exemplars(category="INVOICE", vendor_name="Acme Corp")
    assert len(exemplars) == 2
    keys = {e["field_key"] for e in exemplars}
    assert "vendor_tax_id" in keys
    assert "payment_terms" in keys

    # Apply learned corrections to missing field
    extracted = {"invoice_number": "INV-550", "vendor_tax_id": ""}
    updated, notes = ActiveLearningService.apply_learned_corrections(
        extracted, category="INVOICE", vendor_name="Acme Corp"
    )
    assert updated["vendor_tax_id"] == "US-9918274"
    assert len(notes) >= 1


# ─── 5. Spatial PDF Visual Grounding Tests ──────────────────────────────────

def test_spatial_grounding_coordinates():
    mock_layout = {
        "total_pages": 1,
        "pages": [
            {
                "page_number": 1,
                "width": 612.0,
                "height": 792.0,
                "words": [
                    {"text": "INVOICE", "bbox": [50.0, 100.0, 120.0, 115.0]},
                    {"text": "INV-2026-90481", "bbox": [130.0, 100.0, 240.0, 115.0]},
                    {"text": "TOTAL:", "bbox": [400.0, 700.0, 450.0, 715.0]},
                    {"text": "$4,136.44", "bbox": [460.0, 700.0, 520.0, 715.0]},
                ]
            }
        ]
    }

    # Ground invoice number
    page, bbox = SpatialGroundingEngine.ground_field_value("INV-2026-90481", mock_layout)
    assert page == 1
    assert bbox == [130.0, 100.0, 240.0, 115.0]

    # Ground total amount
    page, bbox = SpatialGroundingEngine.ground_field_value("$4,136.44", mock_layout)
    assert page == 1
    assert bbox == [460.0, 700.0, 520.0, 715.0]
