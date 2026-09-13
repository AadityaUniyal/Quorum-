"""
Transactional Outbox Relay Service

Guarantees atomicity between local database transactions and message publication.
Events are committed to the `outbox_events` table as part of the primary business
transaction, and then dispatched by the OutboxRelay to RabbitMQ.
"""

import logging
import uuid
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.models.outbox import InboxEvent, OutboxEvent
from app.services.queue import publish_document_event

logger = logging.getLogger(__name__)


def record_outbox_event(
    db: Session,
    event_type: str,
    document_id: str | uuid.UUID,
    payload: dict,
    organization_id: str | uuid.UUID | None = None,
    trace_id: str | None = None,
) -> OutboxEvent:
    """
    Records an outbox event within an existing database transaction.
    Must be called BEFORE db.commit().
    """
    event = OutboxEvent(
        event_id=str(uuid.uuid4()),
        event_type=event_type,
        document_id=document_id,
        organization_id=organization_id,
        trace_id=trace_id,
        payload=payload,
        status="PENDING",
        retry_count=0,
    )
    db.add(event)
    return event


def relay_outbox_events(db: Session, limit: int = 50) -> int:
    """
    Scans for PENDING outbox events and publishes them to the message broker.
    Updates event status to PUBLISHED upon success, or increments retry_count on failure.
    """
    pending_events = (
        db.query(OutboxEvent)
        .filter(OutboxEvent.status == "PENDING")
        .order_by(OutboxEvent.created_at.asc())
        .limit(limit)
        .all()
    )

    published_count = 0
    for event in pending_events:
        try:
            publish_document_event(
                event_type=event.event_type,
                document_id=str(event.document_id),
            )
            event.status = "PUBLISHED"
            event.published_at = datetime.now(UTC)
            published_count += 1
        except Exception as e:
            event.retry_count += 1
            if event.retry_count >= 5:
                event.status = "FAILED"
            logger.error(f"Failed to publish outbox event {event.event_id}: {e}")

    if pending_events:
        db.commit()

    return published_count


def is_inbox_message_processed(db: Session, event_id: str, consumer: str) -> bool:
    """
    Checks whether a message has already been processed by the specified consumer.
    Ensures consumer idempotency under duplicate delivery.
    """
    existing = (
        db.query(InboxEvent)
        .filter(InboxEvent.event_id == event_id, InboxEvent.consumer == consumer)
        .first()
    )
    return existing is not None and existing.status == "PROCESSED"


def record_inbox_message(db: Session, event_id: str, consumer: str, status: str = "PROCESSED") -> InboxEvent:
    """
    Records a completed consumer inbox message for deduplication.
    """
    inbox_entry = InboxEvent(
        event_id=event_id,
        consumer=consumer,
        status=status,
        processed_at=datetime.now(UTC),
    )
    db.add(inbox_entry)
    db.commit()
    return inbox_entry
