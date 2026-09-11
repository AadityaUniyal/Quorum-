"""
Transactional Outbox and Inbox Deduplication Models

Ensures reliable event delivery between database transactions and message broker,
as well as idempotent worker consumer processing.
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy import JSON, Column, DateTime, Integer, String, UniqueConstraint

from app.database import GUID, Base


class OutboxEvent(Base):
    __tablename__ = "outbox_events"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    event_id = Column(String(64), unique=True, index=True, nullable=False)
    event_type = Column(String(128), index=True, nullable=False)
    organization_id = Column(GUID, nullable=True, index=True)
    document_id = Column(GUID, nullable=True, index=True)
    trace_id = Column(String(128), nullable=True)
    payload = Column(JSON, nullable=False)
    status = Column(String(32), default="PENDING", nullable=False)  # PENDING, PUBLISHED, FAILED
    retry_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC), index=True)
    published_at = Column(DateTime, nullable=True)


class InboxEvent(Base):
    __tablename__ = "inbox_events"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    event_id = Column(String(64), index=True, nullable=False)
    consumer = Column(String(128), index=True, nullable=False)
    received_at = Column(DateTime, default=lambda: datetime.now(UTC))
    processed_at = Column(DateTime, nullable=True)
    status = Column(String(32), default="PROCESSED", nullable=False)

    __table_args__ = (
        UniqueConstraint("event_id", "consumer", name="uq_inbox_event_consumer"),
    )
