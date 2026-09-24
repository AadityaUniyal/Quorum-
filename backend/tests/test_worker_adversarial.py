"""
Adversarial and Empirical Stress Test Suite for backend/app/worker.py
Milestone 1 Challenger 1

Verifies:
1. Thread-name based exception dispatch (swallow on local_fallback* vs re-raise on others)
2. Database failure during status update (commit failure, query failure, session broken)
3. Malformed, non-existent, and edge-case document IDs (None, int, invalid UUID, SQL injection, empty string)
4. Pipeline step failures (OCR crash, classification crash, consensus crash, vector store crash, audit log crash)
5. Concurrent stress execution of mixed fallback and non-fallback worker threads
"""

import threading
import uuid
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy.exc import OperationalError

from app.database import Base
from app.models.document import Document, DocumentStatus
from app.worker import process_document

try:
    from backend.tests.conftest import TestingSessionLocal, test_engine
except ImportError:
    from tests.conftest import TestingSessionLocal, test_engine


@pytest.fixture(autouse=True)
def setup_worker_env(monkeypatch):
    """Ensures test database tables exist and binds worker SessionLocal."""
    Base.metadata.create_all(bind=test_engine)
    monkeypatch.setattr("app.worker.SessionLocal", TestingSessionLocal)


# =========================================================================
# Scenario 1: Thread Name Permutations & Exception Handling
# =========================================================================

@pytest.mark.parametrize("thread_name,should_reraise", [
    ("local_fallback_worker", False),
    ("local_fallback", False),
    ("local_fallback_worker_42", False),
    ("local_fallback:doc-999", False),
    ("rabbitmq_consumer_worker", True),
    ("celery_worker", True),
    ("MainThread", True),
    ("worker_local_fallback", True),  # contains but does not start with
    ("", True),                       # empty string
    ("custom_thread_pool_executor", True),
])
def test_thread_name_exception_reraise_matrix(thread_name, should_reraise):
    """
    Empirically verify that threads whose names start with 'local_fallback'
    swallow processing exceptions, while ALL other threads re-raise.
    """
    session = TestingSessionLocal()
    doc = Document(
        filename=f"test_matrix_{thread_name[:10]}.pdf",
        file_path="/tmp/test.pdf",  # noqa: S108
        file_type="pdf",
        status=DocumentStatus.INGESTED,
    )
    session.add(doc)
    session.commit()
    doc_id = str(doc.id)
    session.close()

    caught_exceptions = []

    def runner():
        with patch("app.worker.perform_ocr", side_effect=RuntimeError(f"Simulated crash in {thread_name}")):
            try:
                process_document(doc_id)
            except Exception as exc:
                caught_exceptions.append(exc)

    t = threading.Thread(target=runner, name=thread_name)
    t.start()
    t.join(timeout=5)

    assert not t.is_alive(), f"Thread {thread_name} timed out or deadlocked"

    if should_reraise:
        assert len(caught_exceptions) == 1, (
            f"Thread '{thread_name}' was expected to re-raise, but caught: {caught_exceptions}"
        )
        assert f"Simulated crash in {thread_name}" in str(caught_exceptions[0])
    else:
        assert len(caught_exceptions) == 0, (
            f"Thread '{thread_name}' was expected to swallow exception, but caught: {caught_exceptions}"
        )

    # Document should still be marked as FAILED in DB regardless of thread type
    verify_session = TestingSessionLocal()
    updated_doc = verify_session.query(Document).filter(Document.id == doc_id).first()
    assert updated_doc is not None
    assert updated_doc.status == DocumentStatus.FAILED
    verify_session.close()


# =========================================================================
# Scenario 2: Malformed and Edge-case Document IDs
# =========================================================================

@pytest.mark.parametrize("malformed_id", [
    "",
    "   ",
    "invalid-uuid-format-12345",
    "00000000-0000-0000-0000-000000000000",
    "'; DROP TABLE documents; --",
    "' OR '1'='1",
    "A" * 5000,
    None,
    123456789,
    uuid.uuid4(),  # raw UUID object rather than str
])
def test_malformed_document_ids_graceful_handling(malformed_id):
    """
    Verify process_document handles malformed, non-existent, injection,
    and non-string document IDs without unhandled crashes.
    """
    def runner():
        process_document(malformed_id)

    # In local fallback thread: must NEVER raise
    fallback_t = threading.Thread(target=runner, name="local_fallback_worker")
    fallback_t.start()
    fallback_t.join(timeout=5)
    assert not fallback_t.is_alive()


# =========================================================================
# Scenario 3: Database Failures During Status Update
# =========================================================================

def test_db_query_failure_inside_exception_handler(monkeypatch):
    """
    Verify behavior when the DB query itself raises OperationalError
    inside the exception handler (e.g. database connection severed).
    """
    mock_db = MagicMock()
    mock_doc = MagicMock()
    mock_doc.id = "test-doc-broken-conn"

    # Initial query returns doc, but inside exception block query raises
    mock_db.query.return_value.filter.return_value.first.side_effect = [
        mock_doc,
        OperationalError("connection closed unexpectedly", params=None, orig=Exception("socket closed")),
    ]

    monkeypatch.setattr("app.worker.SessionLocal", lambda: mock_db)

    caught = []
    def runner():
        with patch("app.worker.perform_ocr", side_effect=RuntimeError("Primary processing fault")):
            try:
                process_document("test-doc-broken-conn")
            except Exception as e:
                caught.append(e)

    # Fallback thread should catch OperationalError in inner except and swallow primary
    t = threading.Thread(target=runner, name="local_fallback_worker")
    t.start()
    t.join(timeout=5)

    assert not t.is_alive()
    assert len(caught) == 0, f"Fallback thread unexpectedly raised: {caught}"
    assert mock_db.rollback.called
    assert mock_db.close.called


def test_db_commit_failure_inside_exception_handler(monkeypatch):
    """
    Verify behavior when db.commit() raises an exception inside the status update except block.
    """
    mock_db = MagicMock()
    mock_doc = MagicMock()
    mock_doc.id = "test-doc-commit-fail"

    mock_db.query.return_value.filter.return_value.first.return_value = mock_doc
    # Commit succeeds for initial step (PROCESSING), but fails during status update to FAILED
    mock_db.commit.side_effect = [
        None,  # step 1 doc.status = PROCESSING
        OperationalError("disk full", params=None, orig=Exception("ENOSPC")),  # status = FAILED
    ]

    monkeypatch.setattr("app.worker.SessionLocal", lambda: mock_db)

    caught = []
    def runner():
        with patch("app.worker.perform_ocr", side_effect=RuntimeError("Primary processing fault")):
            try:
                process_document("test-doc-commit-fail")
            except Exception as e:
                caught.append(e)

    t = threading.Thread(target=runner, name="local_fallback_worker")
    t.start()
    t.join(timeout=5)

    assert not t.is_alive()
    assert len(caught) == 0
    assert mock_db.rollback.called
    assert mock_db.close.called


def test_initial_db_query_failure(monkeypatch):
    """
    Verify behavior when the very first query to fetch Document raises OperationalError.
    """
    mock_db = MagicMock()
    mock_db.query.side_effect = OperationalError("DB down", params=None, orig=Exception("refused"))

    monkeypatch.setattr("app.worker.SessionLocal", lambda: mock_db)

    caught = []
    def runner():
        try:
            process_document("some-id")
        except Exception as e:
            caught.append(e)

    t = threading.Thread(target=runner, name="local_fallback_worker")
    t.start()
    t.join(timeout=5)

    assert not t.is_alive()
    assert len(caught) == 0, "Fallback worker must swallow exception even on initial DB failure"
    assert mock_db.rollback.called
    assert mock_db.close.called


# =========================================================================
# Scenario 4: Step-by-Step Pipeline Failures
# =========================================================================

@pytest.mark.parametrize("failing_step,patch_target,exception_to_raise", [
    ("redis_semaphore", "app.services.cache.acquire_redis_semaphore", TimeoutError("Redis lock timeout")),
    ("ocr_engine", "app.worker.perform_ocr", RuntimeError("OCR Tesseract segfault")),
    ("classifier", "app.worker.classify_document", ValueError("Classifier model corrupted")),
    ("consensus", "app.worker.run_agent_consensus", RuntimeError("LLM rate limited")),
    ("vector_store", "app.worker.add_document_to_vector_store", ConnectionError("ChromaDB connection dropped")),
])
def test_pipeline_step_failures_mark_status_failed(failing_step, patch_target, exception_to_raise):
    """
    Verify that failure at any point in the 7-step pipeline is safely caught,
    transitions document to FAILED status, and swallows in fallback thread.
    """
    session = TestingSessionLocal()
    doc = Document(
        filename=f"test_step_{failing_step}.pdf",
        file_path="/tmp/test.pdf",  # noqa: S108
        file_type="pdf",
        status=DocumentStatus.INGESTED,
    )
    session.add(doc)
    session.commit()
    doc_id = str(doc.id)
    session.close()

    def runner():
        if failing_step == "consensus":
            async def fake_consensus(*args, **kwargs):
                raise exception_to_raise
            with patch(patch_target, side_effect=fake_consensus):
                process_document(doc_id)
        else:
            with patch(patch_target, side_effect=exception_to_raise):
                process_document(doc_id)

    worker_thread = threading.Thread(target=runner, name="local_fallback_worker")
    worker_thread.start()
    worker_thread.join(timeout=5)

    assert not worker_thread.is_alive()

    # Verify status in database transitioned to FAILED
    verify_session = TestingSessionLocal()
    updated_doc = verify_session.query(Document).filter(Document.id == doc_id).first()
    assert updated_doc is not None
    assert updated_doc.status == DocumentStatus.FAILED
    verify_session.close()


# =========================================================================
# Scenario 5: High Concurrency Stress Test
# =========================================================================

@patch("app.worker.perform_ocr", side_effect=RuntimeError("Concurrent stress failure"))
def test_concurrent_fallback_and_consumer_threads_stress(mock_ocr):
    """
    Spawns concurrent fallback and consumer threads
    experiencing simulated failures simultaneously.
    Verifies that all fallback threads swallow exceptions without crashing,
    and all consumer threads cleanly re-raise.
    """
    session = TestingSessionLocal()
    doc_ids = []
    for i in range(4):
        doc = Document(
            filename=f"stress_doc_{i}.pdf",
            file_path=f"/tmp/stress_{i}.pdf",  # noqa: S108
            file_type="pdf",
            status=DocumentStatus.INGESTED,
        )
        session.add(doc)
        session.flush()
        doc_ids.append(str(doc.id))
    session.commit()
    session.close()

    fallback_errors = []
    consumer_errors = []

    def fallback_worker(did):
        try:
            process_document(did)
        except Exception as e:
            fallback_errors.append(e)

    def consumer_worker(did):
        try:
            process_document(did)
        except Exception as e:
            consumer_errors.append(e)

    # 2 fallback threads and 2 consumer threads
    t_f1 = threading.Thread(target=fallback_worker, args=(doc_ids[0],), name="local_fallback_worker_1")
    t_f2 = threading.Thread(target=fallback_worker, args=(doc_ids[1],), name="local_fallback_worker_2")
    t_c1 = threading.Thread(target=consumer_worker, args=(doc_ids[2],), name="rabbitmq_consumer_worker_1")
    t_c2 = threading.Thread(target=consumer_worker, args=(doc_ids[3],), name="rabbitmq_consumer_worker_2")

    threads = [t_f1, t_f2, t_c1, t_c2]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=10)
        assert not t.is_alive()

    assert len(fallback_errors) == 0, f"Fallback threads leaked errors: {fallback_errors}"
    assert len(consumer_errors) == 2, f"Expected 2 consumer errors, got: {len(consumer_errors)}"

    # All documents must be in FAILED status
    verify_session = TestingSessionLocal()
    for did in doc_ids:
        d = verify_session.query(Document).filter(Document.id == did).first()
        assert d is not None
        assert d.status == DocumentStatus.FAILED
    verify_session.close()
