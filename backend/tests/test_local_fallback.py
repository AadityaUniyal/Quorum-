import pytest
from app.services.llm import local_extractive_rag
from app.models.document import Document
from unittest.mock import MagicMock

def test_local_extractive_rag_match():
    # Setup mock documents
    doc1 = MagicMock(spec=Document)
    doc1.id = "11111111-2222-3333-4444-555555555555"
    doc1.filename = "invoice_corp.pdf"
    doc1.ocr_text = "This is a document from Acme Corp. The total amount due is $1500.00 on December 2026."

    doc2 = MagicMock(spec=Document)
    doc2.id = "66666666-7777-8888-9999-000000000000"
    doc2.filename = "rfq_parts.pdf"
    doc2.ocr_text = "RFQ steel components are required by next month. Governing law is Delaware."

    docs = [doc1, doc2]

    # Test question with matches
    q = "What is the total amount due in the invoice?"
    answer, citations = local_extractive_rag(q, docs)

    assert "Acme Corp" in answer or "1500.00" in answer
    assert len(citations) > 0
    assert citations[0]["filename"] == "invoice_corp.pdf"
    assert "1500.00" in citations[0]["quote"]

def test_local_extractive_rag_no_match():
    doc1 = MagicMock(spec=Document)
    doc1.id = "11111111-2222-3333-4444-555555555555"
    doc1.filename = "invoice_corp.pdf"
    doc1.ocr_text = "This is a document from Acme Corp. The total amount due is $1500.00 on December 2026."
    docs = [doc1]

    # Question with no keywords in doc
    q = "unrelated banana query"
    answer, citations = local_extractive_rag(q, docs)

    assert "could not find precise matches" in answer.lower()
    assert citations == []
