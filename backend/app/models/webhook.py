import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Integer, String

from app.database import GUID, Base


class WebhookConfig(Base):
    __tablename__ = "webhook_configs"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    url = Column(String, nullable=False)
    event_type = Column(String, nullable=False, index=True) # e.g. "document.processed"
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class WebhookLog(Base):
    __tablename__ = "webhook_logs"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    webhook_config_id = Column(GUID, nullable=True)
    url = Column(String, nullable=False)
    event_type = Column(String, nullable=False)
    idempotency_key = Column(String, nullable=False, index=True)
    status = Column(String, nullable=False)  # PENDING, DELIVERED, FAILED
    error_message = Column(String, nullable=True)
    attempt_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

