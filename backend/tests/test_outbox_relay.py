"""
Tests for Transactional Outbox Relay Service, Loop Lifecycle, and Email Ingestion Publishing.
"""

import asyncio
import email
from email.message import EmailMessage
import os
import uuid
from datetime import UTC, datetime
from unittest.mock import MagicMock, patch

import pytest
from app.config import settings
from app.database import Base
from app.main import app, lifespan
from app.models.document import Document, DocumentCategory, DocumentStatus
from app.models.outbox import OutboxEvent
from app.services.email_ingest import _run_mock_ingestion, check_mailbox_and_ingest
from app.services.outbox_relay import (
    record_outbox_event,
    relay_outbox_events,
    run_outbox_relay_loop,
)


# =========================================================================
# 1. Outbox Event Record & Relay State Transitions
# =========================================================================

def test_record_outbox_event(db_session):
    """Verify record_outbox_event stores a PENDING event with correct metadata."""
    doc_id = uuid.uuid4()
    payload = {"filename": "invoice_001.pdf", "size": 1024}

    event = record_outbox_event(
        db=db_session,
        event_type="document.uploaded",
        document_id=doc_id,
        payload=payload,
        trace_id="test-trace-123",
    )
    db_session.commit()

    assert event.id is not None
    assert event.event_type == "document.uploaded"
    assert event.document_id == doc_id
    assert event.payload == payload
    assert event.trace_id == "test-trace-123"
    assert event.status == "PENDING"
    assert event.retry_count == 0
    assert event.published_at is None


def test_relay_outbox_events_success_transition(db_session):
    """
    Verify relay_outbox_events dispatches PENDING events, transitions status
    to PUBLISHED, and populates the published_at timestamp.
    """
    doc_id = uuid.uuid4()
    event = record_outbox_event(
        db=db_session,
        event_type="document.uploaded",
        document_id=doc_id,
        payload={"filename": "test.pdf"},
    )
    db_session.commit()

    with patch("app.services.outbox_relay.publish_document_event") as mock_publish:
        published_count = relay_outbox_events(db_session)

    assert published_count == 1
    mock_publish.assert_called_once_with(
        event_type="document.uploaded",
        document_id=str(doc_id),
    )

    db_session.refresh(event)
    assert event.status == "PUBLISHED"
    assert event.published_at is not None
    assert isinstance(event.published_at, datetime)


def test_relay_outbox_events_empty(db_session):
    """Verify relay_outbox_events returns 0 when there are no pending events."""
    published_count = relay_outbox_events(db_session)
    assert published_count == 0


def test_relay_outbox_events_ignores_non_pending(db_session):
    """Verify already PUBLISHED or FAILED events are not re-processed."""
    doc_id = uuid.uuid4()
    event_pub = OutboxEvent(
        event_id=str(uuid.uuid4()),
        event_type="document.uploaded",
        document_id=doc_id,
        payload={},
        status="PUBLISHED",
        retry_count=0,
        published_at=datetime.now(UTC),
    )
    event_fail = OutboxEvent(
        event_id=str(uuid.uuid4()),
        event_type="document.uploaded",
        document_id=doc_id,
        payload={},
        status="FAILED",
        retry_count=5,
    )
    db_session.add_all([event_pub, event_fail])
    db_session.commit()

    with patch("app.services.outbox_relay.publish_document_event") as mock_publish:
        published = relay_outbox_events(db_session)

    assert published == 0
    mock_publish.assert_not_called()


def test_relay_outbox_events_retry_increment_on_broker_failure(db_session):
    """
    Verify that broker exceptions cause retry_count to increment while
    keeping status as PENDING (when retry_count < 5).
    """
    doc_id = uuid.uuid4()
    event = record_outbox_event(
        db=db_session,
        event_type="document.uploaded",
        document_id=doc_id,
        payload={"filename": "test.pdf"},
    )
    db_session.commit()

    with patch("app.services.outbox_relay.publish_document_event", side_effect=RuntimeError("RabbitMQ broker down")):
        published = relay_outbox_events(db_session)

    assert published == 0
    db_session.refresh(event)
    assert event.retry_count == 1
    assert event.status == "PENDING"
    assert event.published_at is None


def test_relay_outbox_events_failed_state_transition_after_max_retries(db_session):
    """
    Verify that when retry_count reaches 5, the event transitions to FAILED.
    """
    doc_id = uuid.uuid4()
    event = OutboxEvent(
        event_id=str(uuid.uuid4()),
        event_type="document.uploaded",
        document_id=doc_id,
        payload={"filename": "fatal.pdf"},
        status="PENDING",
        retry_count=4,  # Next failure will reach 5
    )
    db_session.add(event)
    db_session.commit()

    with patch("app.services.outbox_relay.publish_document_event", side_effect=RuntimeError("Permanent failure")):
        published = relay_outbox_events(db_session)

    assert published == 0
    db_session.refresh(event)
    assert event.retry_count == 5
    assert event.status == "FAILED"
    assert event.published_at is None


def test_relay_outbox_events_batch_limit(db_session):
    """Verify that relay_outbox_events honors the limit argument."""
    for i in range(5):
        record_outbox_event(
            db=db_session,
            event_type="document.uploaded",
            document_id=uuid.uuid4(),
            payload={"index": i},
        )
    db_session.commit()

    with patch("app.services.outbox_relay.publish_document_event"):
        count = relay_outbox_events(db_session, limit=3)

    assert count == 3
    pending_left = db_session.query(OutboxEvent).filter(OutboxEvent.status == "PENDING").count()
    assert pending_left == 2


# =========================================================================
# 2. Background Loop Lifecycle
# =========================================================================

@pytest.mark.asyncio
async def test_outbox_relay_loop_lifecycle_stop_event(db_session):
    """
    Verify run_outbox_relay_loop executes periodic relay and terminates
    cleanly when stop_event is set.
    """
    stop_event = asyncio.Event()
    relay_calls = 0

    class DummySessionContext:
        def __init__(self, session):
            self.session = session
        def close(self):
            pass

    def mock_session_factory():
        nonlocal relay_calls
        relay_calls += 1
        return DummySessionContext(db_session)

    # Spawn loop task
    loop_task = asyncio.create_task(
        run_outbox_relay_loop(
            interval_seconds=0.05,
            stop_event=stop_event,
            session_factory=mock_session_factory,
        )
    )

    # Wait for at least one iteration
    await asyncio.sleep(0.12)
    assert relay_calls >= 1

    # Signal stop event
    stop_event.set()
    await asyncio.wait_for(loop_task, timeout=1.0)
    assert loop_task.done()
    assert not loop_task.cancelled()


@pytest.mark.asyncio
async def test_outbox_relay_loop_lifecycle_cancellation(db_session):
    """
    Verify run_outbox_relay_loop terminates cleanly when cancelled via Task.cancel().
    """
    stop_event = asyncio.Event()

    class DummySessionContext:
        def close(self):
            pass

    def mock_factory():
        return DummySessionContext()

    loop_task = asyncio.create_task(
        run_outbox_relay_loop(
            interval_seconds=0.05,
            stop_event=stop_event,
            session_factory=mock_factory,
        )
    )

    await asyncio.sleep(0.08)
    loop_task.cancel()

    # Awaiting cancelled task should complete without raising unhandled exceptions
    try:
        await loop_task
    except asyncio.CancelledError:
        pass

    assert loop_task.done()


# =========================================================================
# 3. Lifespan Integration
# =========================================================================

@pytest.mark.asyncio
async def test_lifespan_starts_and_stops_relay_when_enabled(monkeypatch):
    """
    Verify that FastAPI lifespan starts the outbox relay background task
    when enabled and not in testing mode, and cleanly cancels and awaits it on shutdown.
    """
    monkeypatch.setattr(settings, "OUTBOX_RELAY_ENABLED", True)
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "OUTBOX_RELAY_INTERVAL_SECONDS", 0.05)

    with patch("app.services.outbox_relay.run_outbox_relay_loop") as mock_loop:
        # Mock loop so it awaits stop_event or cancellation
        async def fake_loop(interval_seconds, stop_event):
            try:
                await stop_event.wait()
            except asyncio.CancelledError:
                pass

        mock_loop.side_effect = fake_loop

        async with lifespan(app):
            # Assert background task was created on app.state
            task = getattr(app.state, "outbox_relay_task", None)
            stop_event = getattr(app.state, "outbox_relay_stop_event", None)
            assert task is not None
            assert stop_event is not None
            assert not task.done()

        # After exiting lifespan context, task should be finished
        assert task.done()
        assert stop_event.is_set()


@pytest.mark.asyncio
async def test_lifespan_skips_relay_in_testing_mode(monkeypatch):
    """
    Verify that FastAPI lifespan does not start outbox relay background task
    in testing mode to prevent unmonitored background tasks during test suites.
    """
    monkeypatch.setattr(settings, "OUTBOX_RELAY_ENABLED", True)
    monkeypatch.setattr(settings, "ENVIRONMENT", "testing")
    app.state.outbox_relay_task = None

    async with lifespan(app):
        task = getattr(app.state, "outbox_relay_task", None)
        assert task is None


# =========================================================================
# 4. Email Ingestion Attachment Event Publishing & Outbox Tracking
# =========================================================================

def test_email_mock_ingestion_creates_outbox_and_publishes_event(db_session):
    """
    Verify that _run_mock_ingestion:
    1. Creates Document with status INGESTED
    2. Records an OutboxEvent with event_type 'document.uploaded'
    3. Calls publish_document_event('document.uploaded', str(doc.id))
    """
    # Clean up any pre-existing mock document from earlier tests
    db_session.query(Document).filter(Document.filename == "mock_email_invoice.pdf").delete()
    db_session.commit()

    with patch("app.services.email_ingest.publish_document_event") as mock_publish:
        _run_mock_ingestion(db=db_session)

    # 1. Check Document
    doc = db_session.query(Document).filter(Document.filename == "mock_email_invoice.pdf").first()
    assert doc is not None
    assert doc.status == DocumentStatus.INGESTED
    assert doc.category == DocumentCategory.INVOICE

    # 2. Check OutboxEvent
    outbox_entry = (
        db_session.query(OutboxEvent)
        .filter(OutboxEvent.document_id == doc.id)
        .first()
    )
    assert outbox_entry is not None
    assert outbox_entry.event_type == "document.uploaded"
    assert outbox_entry.status == "PENDING"
    assert outbox_entry.payload["filename"] == "mock_email_invoice.pdf"
    assert outbox_entry.payload["source"] == "email_ingest"

    # 3. Check publish_document_event
    mock_publish.assert_called_once_with("document.uploaded", str(doc.id))


def test_email_check_mailbox_falls_back_to_mock_and_passes_db(db_session, monkeypatch):
    """
    Verify check_mailbox_and_ingest(db=db) routes to mock ingestion when credentials are unset,
    preserving the injected db session.
    """
    monkeypatch.setattr(settings, "ENVIRONMENT", "testing")
    monkeypatch.delenv("IMAP_SERVER", raising=False)
    monkeypatch.delenv("IMAP_USER", raising=False)
    monkeypatch.delenv("IMAP_PASSWORD", raising=False)

    with patch("app.services.email_ingest._run_mock_ingestion") as mock_mock_ingest:
        check_mailbox_and_ingest(db=db_session)

    mock_mock_ingest.assert_called_once_with(db=db_session)


def test_email_imap_ingestion_creates_outbox_and_publishes_event(db_session, monkeypatch, tmp_path):
    """
    Verify that live IMAP attachment ingestion saves Document, creates OutboxEvent,
    and calls publish_document_event.
    """
    monkeypatch.setenv("IMAP_SERVER", "imap.mockserver.test")
    monkeypatch.setenv("IMAP_USER", "invoices@docintel.test")
    monkeypatch.setenv("IMAP_PASSWORD", "mockpassword")

    # Build a mock email message with a PDF attachment
    msg = EmailMessage()
    msg["Subject"] = "Invoice INV-2026-99"
    msg["From"] = "billing@vendor.test"
    msg["To"] = "invoices@docintel.test"
    msg.set_content("Please find attached the invoice for September.")
    pdf_content = b"%PDF-1.4 Mock PDF stream for automated testing"
    msg.add_attachment(pdf_content, maintype="application", subtype="pdf", filename="vendor_invoice_99.pdf")
    raw_email_bytes = msg.as_bytes()

    # Mock imaplib.IMAP4_SSL
    mock_mail = MagicMock()
    mock_mail.search.return_value = ("OK", [b"1"])
    mock_mail.fetch.return_value = ("OK", [(b"1 (RFC822)", raw_email_bytes)])

    with patch("imaplib.IMAP4_SSL", return_value=mock_mail), \
         patch("app.services.email_ingest.publish_document_event") as mock_publish:
        check_mailbox_and_ingest(db=db_session)

    # Verify Document was persisted
    doc = db_session.query(Document).filter(Document.filename == "vendor_invoice_99.pdf").first()
    assert doc is not None
    assert doc.category == DocumentCategory.INVOICE
    assert doc.status == DocumentStatus.INGESTED

    # Verify OutboxEvent was recorded
    outbox = db_session.query(OutboxEvent).filter(OutboxEvent.document_id == doc.id).first()
    assert outbox is not None
    assert outbox.event_type == "document.uploaded"
    assert outbox.status == "PENDING"
    assert outbox.payload["source"] == "email_ingest"

    # Verify publish_document_event was invoked
    mock_publish.assert_called_once_with("document.uploaded", str(doc.id))
