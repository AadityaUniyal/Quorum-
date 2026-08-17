from unittest.mock import MagicMock

from app.models.document import Document
from app.services.local_engine import LocalLayoutParser, LocalTfidfSearch


def test_local_layout_parser_invoice():
    ocr_text = """
    STARK INDUSTRIES
    INVOICE NUMBER: INV-2026-9021
    Invoice Date: July 07, 2026
    
    Subtotal: $12500.00
    Tax (8.0%): $1000.00
    Shipping: $150.00
    Total Amount Due: $13650.00
    """
    fields = LocalLayoutParser.extract_fields(ocr_text, "INVOICE")
    assert fields["invoice_number"] == "INV-2026-9021"
    assert fields["invoice_date"] == "July 07, 2026"
    assert fields["subtotal"] == "12500.00"
    assert fields["tax"] == "1000.00"
    assert fields["shipping"] == "150.00"
    assert fields["total_amount"] == "13650.00"

def test_local_layout_parser_rfq():
    ocr_text = """
    RFQ REFERENCE: RFQ-9002
    PART NUMBER: PART-ST-88
    Material: Titanium
    Quantity: 250
    Tolerance: +/-0.05mm
    """
    fields = LocalLayoutParser.extract_fields(ocr_text, "RFQ")
    assert fields["rfq_reference"] == "RFQ-9002"
    assert fields["part_number"] == "PART-ST-88"
    assert fields["material"] == "Titanium"
    assert fields["quantity"] == "250"
    assert fields["tolerance"] == "+/-0.05mm"

def test_local_tfidf_search():
    docs = ["Titanium alloy screws are required for aviation", "Total invoice amount is $500", "Contract is governed by Delaware law"]
    results = LocalTfidfSearch.compute_tfidf("aviation alloy", docs)
    assert len(results) == 3
    # Index 0 should have the highest score since it contains both aviation and alloy
    results.sort(key=lambda x: x[1], reverse=True)
    assert results[0][0] == 0
    assert results[0][1] > 0.0

def test_local_extractive_qa():
    doc1 = MagicMock(spec=Document)
    doc1.id = "11111111-2222-3333-4444-555555555555"
    doc1.filename = "doc1.pdf"
    doc1.ocr_text = "Governing law is state of Delaware. Effective date is June 2026."
    
    docs = [doc1]
    answer, citations = LocalTfidfSearch.extractive_qa("What is the governing law?", docs)
    assert "Delaware" in answer
    assert len(citations) == 1
    assert citations[0]["filename"] == "doc1.pdf"
    assert "Delaware" in citations[0]["quote"]
