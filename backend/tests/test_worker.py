"""
Tests for background worker execution (app.worker) covering:
- Clean module import and syntax integrity
- Safe handling of missing document IDs
- Exception handling in local fallback worker threads (no crash, status -> FAILED, no unhandled NameError)
- Re-raising behavior in non-fallback / RabbitMQ worker threads
- Resilient DB rollback handling when status update fails
- Rule-based document classification
"""

import threading
from unittest.mock import MagicMock, patch
import pytest

from app.database import Base
from app.models.document import Document, DocumentCategory, DocumentStatus
from app.worker import classify_document, process_document
try:
    from backend.tests.conftest import TestingSessionLocal, test_engine
except ImportError:
    from tests.conftest import TestingSessionLocal, test_engine


@pytest.fixture(autouse=True)
def setup_worker_env(monkeypatch):
    """Ensures all model tables are created on test_engine and binds SessionLocal."""
    Base.metadata.create_all(bind=test_engine)
    monkeypatch.setattr("app.worker.SessionLocal", TestingSessionLocal)


def test_worker_import_and_syntax():
    """Verify worker module imports cleanly and process_document is callable."""
    assert callable(process_document)
    assert callable(classify_document)


def test_classify_document_rules():
    """Verify document category classifier detects keywords."""
    assert classify_document("vendor_invoice_101.pdf", "total amount due") == DocumentCategory.INVOICE
    assert classify_document("rfq_steel_beams.docx", "request for quotation") == DocumentCategory.RFQ
    assert classify_document("master_agreement_contract.pdf", "parties agree to terms") == DocumentCategory.CONTRACT
    assert classify_document("iso_compliance_certificate.pdf", "audit compliance passed") == DocumentCategory.COMPLIANCE


def test_process_document_missing_id():
    """Processing a non-existent document ID returns gracefully without raising errors."""
    # Should not raise any exception
    process_document("00000000-0000-0000-0000-000000000000")


def test_process_document_fallback_thread_marks_failed_without_crash():
    """Local fallback worker thread catches processing failures, marks status FAILED, and does not re-raise."""
    session = TestingSessionLocal()
    doc = Document(
        filename="test_broken.pdf",
        file_path="/tmp/test_broken.pdf",
        file_type="pdf",
        status=DocumentStatus.INGESTED,
    )
    session.add(doc)
    session.commit()
    doc_id = str(doc.id)
    session.close()

    def run_in_fallback_thread():
        # Mock perform_ocr to simulate a fatal extraction failure
        with patch("app.worker.perform_ocr", side_effect=RuntimeError("OCR engine pipeline crashed")):
            process_document(doc_id)

    worker_thread = threading.Thread(
        target=run_in_fallback_thread,
        name="local_fallback_worker",
    )
    worker_thread.start()
    worker_thread.join(timeout=5)

    assert not worker_thread.is_alive()

    # Verify status in database was updated to FAILED
    verify_session = TestingSessionLocal()
    updated_doc = verify_session.query(Document).filter(Document.id == doc_id).first()
    assert updated_doc is not None
    assert updated_doc.status == DocumentStatus.FAILED
    verify_session.close()


def test_process_document_rabbitmq_thread_reraises():
    """RabbitMQ consumer thread re-raises processing exceptions for retry / DLQ routing."""
    session = TestingSessionLocal()
    doc = Document(
        filename="test_dlq.pdf",
        file_path="/tmp/test_dlq.pdf",
        file_type="pdf",
        status=DocumentStatus.INGESTED,
    )
    session.add(doc)
    session.commit()
    doc_id = str(doc.id)
    session.close()

    caught_exception = []

    def run_in_consumer_thread():
        with patch("app.worker.perform_ocr", side_effect=RuntimeError("Transient RabbitMQ failure")):
            try:
                process_document(doc_id)
            except RuntimeError as exc:
                caught_exception.append(exc)

    consumer_thread = threading.Thread(
        target=run_in_consumer_thread,
        name="rabbitmq_consumer_worker",
    )
    consumer_thread.start()
    consumer_thread.join(timeout=5)

    assert not consumer_thread.is_alive()
    # In consumer thread, exception must have been re-raised
    assert len(caught_exception) == 1
    assert "Transient RabbitMQ failure" in str(caught_exception[0])

    # Status must still have been updated to FAILED
    verify_session = TestingSessionLocal()
    updated_doc = verify_session.query(Document).filter(Document.id == doc_id).first()
    assert updated_doc is not None
    assert updated_doc.status == DocumentStatus.FAILED
    verify_session.close()


def test_process_document_db_rollback_on_inner_failure(monkeypatch):
    """If DB commit fails while recording FAILED status, db.rollback() is called and fallback thread does not crash."""
    mock_db = MagicMock()
    mock_doc = MagicMock()
    mock_db.query.return_value.filter.return_value.first.side_effect = [
        mock_doc,  # initial query to get doc
        mock_doc,  # query in exception handler
    ]
    mock_doc.id = "test-doc-id"
    mock_doc.filename = "test.pdf"
    mock_doc.file_path = "/tmp/test.pdf"
    mock_doc.file_type = "pdf"

    # Make second commit (inside except block) raise a database error
    mock_db.commit.side_effect = [
        None,  # if any commit before
        Exception("Simulated database disk I/O error"),
    ]

    monkeypatch.setattr("app.worker.SessionLocal", lambda: mock_db)

    def run_in_fallback_thread():
        with patch("app.worker.perform_ocr", side_effect=RuntimeError("Primary failure")):
            process_document("test-doc-id")

    worker_thread = threading.Thread(
        target=run_in_fallback_thread,
        name="local_fallback_worker",
    )
    worker_thread.start()
    worker_thread.join(timeout=5)

    assert not worker_thread.is_alive()
    # Ensure rollback was called on db session
    assert mock_db.rollback.called
    assert mock_db.close.called
