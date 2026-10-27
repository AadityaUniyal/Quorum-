"""
Comprehensive Test Suite for QUORUM OS Algorithmic Engines:
1. SMT Arithmetic Prover (Z3 / Formal constraint satisfiability)
2. Cryptographic Merkle Provenance Tree (Quorum Verification Seal)
3. Topological Spatial Graph & Tabular Extraction
4. Reflexive Debate & Nash Consensus Engine
"""

from decimal import Decimal
import pytest

from app.services.smt_verifier import SMTArithmeticProver
from app.services.merkle_provenance import MerkleProvenanceEngine
from app.services.topological_graph import TopologicalSpatialEngine
from app.agents.reflexive_debate import ReflexiveDebateEngine
from app.models.document import DocumentCategory


def test_smt_arithmetic_prover_sat():
    """Verify that an exact mathematical invoice satisfies constraints (Δ == $0.00)."""
    fields = {
        "subtotal": "1000.00",
        "tax_amount": "100.00",
        "discount": "50.00",
        "shipping": "25.00",
        "total_amount": "1075.00",
    }
    line_items = [
        {"description": "Server Rack", "quantity": "2", "unit_price": "500.00", "total": "1000.00"}
    ]

    result = SMTArithmeticProver.verify_financial_constraints(fields, line_items)
    assert result.is_satisfiable is True
    assert result.status == "SAT"
    assert result.arithmetic_delta == Decimal("0.00")
    assert result.math_accuracy_score == 1.0
    assert len(result.unsat_core_reasons) == 0


def test_smt_arithmetic_prover_unsat():
    """Verify that an invoice overcharge or mathematical drift yields UNSAT with exact delta."""
    fields = {
        "subtotal": "1000.00",
        "tax_amount": "100.00",
        "discount": "0.00",
        "shipping": "0.00",
        "total_amount": "1250.00",  # Claimed 1250 instead of 1100
    }
    result = SMTArithmeticProver.verify_financial_constraints(fields)
    assert result.is_satisfiable is False
    assert result.status == "UNSAT"
    assert result.arithmetic_delta == Decimal("150.00")
    assert len(result.unsat_core_reasons) > 0


def test_merkle_provenance_seal_generation_and_tamper_detection():
    """Verify that Merkle root is deterministic and detects any field modification."""
    doc_id = "doc-test-889021"
    fields = [
        {"field_key": "invoice_number", "consensus_value": "INV-2026-99", "bounding_box": [10, 10, 50, 20]},
        {"field_key": "total_amount", "consensus_value": "45000.00", "bounding_box": [500, 700, 600, 750]},
    ]

    seal_1 = MerkleProvenanceEngine.generate_verification_seal(doc_id, fields)
    seal_2 = MerkleProvenanceEngine.generate_verification_seal(doc_id, fields)

    # Determinism
    assert seal_1.merkle_root == seal_2.merkle_root
    assert seal_1.leaf_count == 2
    assert "qvs_" in seal_1.seal_id

    # Tampering with total_amount must completely alter the root hash
    tampered_fields = [
        {"field_key": "invoice_number", "consensus_value": "INV-2026-99", "bounding_box": [10, 10, 50, 20]},
        {"field_key": "total_amount", "consensus_value": "45001.00", "bounding_box": [500, 700, 600, 750]},
    ]
    tampered_seal = MerkleProvenanceEngine.generate_verification_seal(doc_id, tampered_fields)
    assert tampered_seal.merkle_root != seal_1.merkle_root


def test_topological_spatial_graph():
    """Verify topological graph construction and row collinearity clustering."""
    words = [
        {"text": "Qty", "bbox": [50, 100, 80, 114]},
        {"text": "Description", "bbox": [100, 100, 200, 114]},
        {"text": "Total", "bbox": [400, 100, 450, 114]},
        {"text": "2", "bbox": [50, 130, 60, 144]},
        {"text": "Cloud Nodes", "bbox": [100, 130, 180, 144]},
        {"text": "$2,000.00", "bbox": [400, 130, 460, 144]},
    ]

    graph = TopologicalSpatialEngine.build_layout_graph(words, page_number=1)
    assert graph.total_tokens == 6
    assert len(graph.edges) > 0
    assert len(graph.table_candidates) >= 1


def test_reflexive_debate_convergence():
    """Verify multi-turn debate on contested fields."""
    engine = ReflexiveDebateEngine(max_rounds=3)
    initial_fields = {
        "invoice_number": "INV-001",
        "total_amount": "5000.00",
    }
    critic_results = {
        "invoice_number": {"score": 0.99, "notes": "Clear match"},
        "total_amount": {"score": 0.55, "notes": "Tax deduction discrepancy"},
    }
    auditor_results = {
        "invoice_number": {"score": 1.0, "notes": "Valid identifier"},
        "total_amount": {"score": 0.95, "notes": "Exact line item total"},
    }
    compliance_results = {}

    debate = engine.run_debate(
        ocr_text="Invoice #INV-001 Total $5000.00",
        category=DocumentCategory.INVOICE,
        initial_fields=initial_fields,
        critic_results=critic_results,
        auditor_results=auditor_results,
        compliance_results=compliance_results,
    )

    assert debate.converged is True
    assert len(debate.thought_graph) > 0
    assert debate.field_confidence["total_amount"] > 0.7
