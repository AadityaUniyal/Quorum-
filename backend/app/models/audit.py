import uuid
from datetime import UTC, datetime

from app.database import GUID, Base
from sqlalchemy import JSON, Column, DateTime, ForeignKey, String
from sqlalchemy.orm import relationship


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    document_id = Column(GUID, ForeignKey("documents.id", ondelete="SET NULL"), nullable=True)
    user_id = Column(GUID, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action = Column(String, nullable=False)  # e.g., "UPLOAD_DOCUMENT", "FIELD_CORRECTED", "STATUS_CHANGED"
    details = Column(JSON, nullable=True)    # For before/after diffs and event contexts
    timestamp = Column(DateTime, default=lambda: datetime.now(UTC).replace(tzinfo=None))

    # Relationships
    document = relationship("Document")
    user = relationship("User")
