"""
Adversarial Challenge & Stress Tests for Milestone 2:
Transactional Outbox Relay, State Transitions, Failure Retries, and Loop Lifecycle.
"""

import asyncio
import uuid
from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest

from app.models.document import Document
from app.models.outbox import OutboxEvent
from app.services.email_ingest import _run_mock_ingestion
from app.services.outbox_relay import (
    record_outbox_event,
    relay_outbox_events,
    run_outbox_relay_loop,
)

# =========================================================================
# 1. Mixed Batch & Partial Failure Isolation
# =========================================================================

def test_outbox_relay_mixed_batch_partial_failures(db_session):
    """
    Stress-test: When a batch has multiple events and one fails mid-batch,
    the successful events must be PUBLISHED, the failed event must increment
    retry_count, and all state changes must be committed.
    """
    doc_id_1 = uuid.uuid4()
    doc_id_2 = uuid.uuid4()
    doc_id_3 = uuid.uuid4()

    e1 = record_outbox_event(db_session, "doc.success1", doc_id_1, {"idx": 1})
    e2 = record_outbox_event(db_session, "doc.fail", doc_id_2, {"idx": 2})
    e3 = record_outbox_event(db_session, "doc.success2", doc_id_3, {"idx": 3})
    db_session.commit()

    def mock_publish(event_type, document_id):
        if event_type == "doc.fail":
            raise ConnectionError("RabbitMQ socket write timeout")

    with patch("app.services.outbox_relay.publish_document_event", side_effect=mock_publish):
        published_count = relay_outbox_events(db_session, limit=10)

    assert published_count == 2

    db_session.refresh(e1)
    db_session.refresh(e2)
    db_session.refresh(e3)

    # Event 1: succeeded
    assert e1.status == "PUBLISHED"
    assert e1.retry_count == 0
    assert e1.published_at is not None

    # Event 2: failed
    assert e2.status == "PENDING"
    assert e2.retry_count == 1
    assert e2.published_at is None

    # Event 3: succeeded
    assert e3.status == "PUBLISHED"
    assert e3.retry_count == 0
    assert e3.published_at is not None


# =========================================================================
# 2. Boundary Condition: Exact Retry Exhaustion (1 to 5)
# =========================================================================

@pytest.mark.parametrize(
    "initial_retries,expected_status,expected_retries",
    [
        (0, "PENDING", 1),
        (3, "PENDING", 4),
        (4, "FAILED", 5),
        (5, "FAILED", 6),
    ],
)
def test_outbox_relay_exact_retry_exhaustion_boundary(
    db_session, initial_retries, expected_status, expected_retries
):
    """
    Verify exact off-by-one boundaries for retry exhaustion:
    - Retries < 5: status stays PENDING
    - Retries >= 5: status transitions to FAILED
    """
    event = OutboxEvent(
        event_id=str(uuid.uuid4()),
        event_type="document.test_retry",
        document_id=uuid.uuid4(),
        payload={},
        status="PENDING",
        retry_count=initial_retries,
    )
    db_session.add(event)
    db_session.commit()

    with patch("app.services.outbox_relay.publish_document_event", side_effect=RuntimeError("Broker offline")):
        count = relay_outbox_events(db_session)

    assert count == 0
    db_session.refresh(event)
    assert event.retry_count == expected_retries
    assert event.status == expected_status
    assert event.published_at is None


# =========================================================================
# 3. Limit Zero and Negative Bounds
# =========================================================================

def test_outbox_relay_zero_limit(db_session):
    """Verify limit=0 returns 0 without updating or publishing anything."""
    record_outbox_event(db_session, "doc.zero_limit", uuid.uuid4(), {})
    db_session.commit()

    with patch("app.services.outbox_relay.publish_document_event") as mock_pub:
        count = relay_outbox_events(db_session, limit=0)

    assert count == 0
    mock_pub.assert_not_called()


# =========================================================================
# 4. Background Loop Lifecycle Stress
# =========================================================================

@pytest.mark.asyncio
async def test_outbox_relay_loop_fast_start_stop():
    """
    Stress test: stop_event signaled before loop even starts.
    Loop must exit immediately without running any iteration.
    """
    stop_event = asyncio.Event()
    stop_event.set()  # Pre-set

    relay_calls = 0

    def mock_factory():
        nonlocal relay_calls
        relay_calls += 1
        mock_ctx = MagicMock()
        return mock_ctx

    loop_task = asyncio.create_task(
        run_outbox_relay_loop(
            interval_seconds=1.0,
            stop_event=stop_event,
            session_factory=mock_factory,
        )
    )

    await asyncio.wait_for(loop_task, timeout=0.5)
    assert loop_task.done()
    assert relay_calls == 0


@pytest.mark.asyncio
async def test_outbox_relay_loop_immediate_cancellation():
    """
    Stress test: Task cancelled immediately after creation.
    Must handle CancelledError gracefully without crashing or escaping.
    """
    stop_event = asyncio.Event()

    loop_task = asyncio.create_task(
        run_outbox_relay_loop(
            interval_seconds=1.0,
            stop_event=stop_event,
            session_factory=MagicMock,
        )
    )

    loop_task.cancel()
    try:
        await loop_task
    except asyncio.CancelledError:
        pass

    assert loop_task.done()


@pytest.mark.asyncio
async def test_outbox_relay_loop_recovers_from_transient_db_exception():
    """
    Stress test: If session_factory or DB query raises an unhandled exception,
    the loop logs the error and continues running without terminating abnormally.
    """
    stop_event = asyncio.Event()
    call_count = 0

    class TransientErrorSession:
        def __init__(self):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise RuntimeError("Transient PostgreSQL disconnect")
        def close(self):
            pass

    loop_task = asyncio.create_task(
        run_outbox_relay_loop(
            interval_seconds=0.03,
            stop_event=stop_event,
            session_factory=TransientErrorSession,
        )
    )

    # Allow time for multiple iterations
    await asyncio.sleep(0.12)
    assert call_count >= 2, "Loop should have retried despite first transient exception"

    stop_event.set()
    await asyncio.wait_for(loop_task, timeout=1.0)
    assert loop_task.done()


# =========================================================================
# 5. Email Ingest Double-Publish Analysis
# =========================================================================

def test_email_ingest_creates_pending_outbox_and_triggers_relay(db_session):
    """
    Adversarial verification of the dual-dispatch behavior:
    1. _run_mock_ingestion creates a PENDING outbox event and calls publish_document_event.
    2. Since the outbox event remains PENDING in the DB, a subsequent relay_outbox_events
       call will pick it up and call publish_document_event a SECOND time.
    This test verifies that the outbox relay completes the lifecycle from PENDING to PUBLISHED.
    """
    db_session.query(Document).filter(Document.filename == "mock_email_invoice.pdf").delete()
    db_session.commit()

    # Step 1: Ingestion
    with patch("app.services.email_ingest.publish_document_event") as mock_ingest_publish:
        _run_mock_ingestion(db=db_session)
        assert mock_ingest_publish.call_count == 1

    doc = db_session.query(Document).filter(Document.filename == "mock_email_invoice.pdf").first()
    assert doc is not None

    # Verify outbox event is in PENDING state
    outbox_event = (
        db_session.query(OutboxEvent)
        .filter(OutboxEvent.document_id == doc.id)
        .first()
    )
    assert outbox_event is not None
    assert outbox_event.status == "PENDING"
    assert outbox_event.published_at is None

    # Step 2: Relay run
    with patch("app.services.outbox_relay.publish_document_event") as mock_relay_publish:
        published_count = relay_outbox_events(db_session)

    assert published_count == 1
    mock_relay_publish.assert_called_once_with(
        event_type="document.uploaded",
        document_id=str(outbox_event.document_id),
    )

    # Step 3: Verify transition to PUBLISHED
    db_session.refresh(outbox_event)
    assert outbox_event.status == "PUBLISHED"
    assert outbox_event.published_at is not None
    assert isinstance(outbox_event.published_at, datetime)
