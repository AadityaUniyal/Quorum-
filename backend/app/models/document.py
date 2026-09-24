import enum
import uuid
from datetime import UTC, datetime

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.database import GUID, Base


class DocumentStatus(enum.StrEnum):
    INGESTED = "INGESTED"
    PROCESSING = "PROCESSING"
    FAILED = "FAILED"
    AWAITING_REVIEW = "AWAITING_REVIEW"
    PROCESSED = "PROCESSED"


class DocumentCategory(enum.StrEnum):
    INVOICE = "INVOICE"
    RFQ = "RFQ"
    PURCHASE_ORDER = "PURCHASE_ORDER"
    CONTRACT = "CONTRACT"
    COMPLIANCE = "COMPLIANCE"
    UNKNOWN = "UNKNOWN"


class FieldValidationStatus(enum.StrEnum):
    VALID = "VALID"
    FLAGGED = "FLAGGED"
    MANUAL_CORRECTION = "MANUAL_CORRECTION"


class Document(Base):
    __tablename__ = "documents"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    organization_id = Column(GUID, ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True, index=True)
    filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_type = Column(String, nullable=False)
    mime_type = Column(String, nullable=True)
    size_bytes = Column(Integer, nullable=True)
    category = Column(Enum(DocumentCategory), default=DocumentCategory.UNKNOWN, nullable=False)
    status = Column(Enum(DocumentStatus), default=DocumentStatus.INGESTED, nullable=False)
    ocr_text = Column(Text, nullable=True)
    executive_summary = Column(Text, nullable=True)
    consensus_score = Column(Float, nullable=True)
    content_hash = Column(String(64), index=True, nullable=True)
    processing_version = Column(String(32), default="1.0.0", nullable=False)

    uploaded_by = Column(GUID, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    assigned_to_id = Column(GUID, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    due_date = Column(DateTime, nullable=True)
    approval_stage = Column(String, default="OPERATOR_REVIEW", nullable=False)
    
    # Soft delete support
    deleted_at = Column(DateTime, nullable=True)
    deleted_by = Column(GUID, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(UTC).replace(tzinfo=None), index=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(UTC).replace(tzinfo=None), onupdate=lambda: datetime.now(UTC).replace(tzinfo=None))

    # Composite indexes for multi-tenant querying performance & security
    __table_args__ = (
        Index("ix_docs_org_created", "organization_id", "created_at"),
        Index("ix_docs_org_status", "organization_id", "status"),
        Index("ix_docs_org_category", "organization_id", "category"),
    )

    # Relationships
    uploader = relationship("User", backref="uploaded_documents", foreign_keys=[uploaded_by])
    fields = relationship("ExtractedField", back_populates="document", cascade="all, delete-orphan")
    versions = relationship("DocumentVersion", back_populates="document", cascade="all, delete-orphan")
    review_tasks = relationship("ReviewTask", back_populates="document", cascade="all, delete-orphan")


class ExtractedField(Base):
    __tablename__ = "extracted_fields"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    document_id = Column(GUID, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    field_key = Column(String, nullable=False)
    extracted_value = Column(String, nullable=True)
    critic_score = Column(Float, default=1.0)
    auditor_score = Column(Float, default=1.0)
    consensus_value = Column(String, nullable=True)
    confidence_score = Column(Float, default=1.0)
    is_modified = Column(Boolean, default=False)
    validation_status = Column(Enum(FieldValidationStatus), default=FieldValidationStatus.VALID, nullable=False)
    validation_notes = Column(Text, nullable=True)

    # Evidence Grounding & Provenance
    page_number = Column(Integer, nullable=True)
    bounding_box = Column(JSON, nullable=True)
    evidence_text = Column(Text, nullable=True)
    chunk_id = Column(String, nullable=True)

    # Human Verification Provenance
    verification_source = Column(String, default="AI", nullable=False)  # AI, HUMAN, SYSTEM
    verified_by = Column(GUID, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    verified_at = Column(DateTime, nullable=True)

    __table_args__ = (
        Index("ix_extracted_fields_doc_key", "document_id", "field_key"),
    )

    # Relationships
    document = relationship("Document", back_populates="fields")


class DocumentVersion(Base):
    """
    Immutable version snapshot of processed document outputs.
    Supports reprocessing comparison, reproducibility, and lineage audits.
    """
    __tablename__ = "document_versions"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    document_id = Column(GUID, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    version_number = Column(Integer, nullable=False)
    content_hash = Column(String(64), nullable=False)
    ocr_text = Column(Text, nullable=True)
    executive_summary = Column(Text, nullable=True)
    consensus_score = Column(Float, nullable=True)
    pipeline_version = Column(String(32), default="1.0.0", nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC).replace(tzinfo=None))
    created_by = Column(GUID, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    document = relationship("Document", back_populates="versions")


class ReviewTask(Base):
    """
    Review task tracking for human-in-the-loop validation, SLAs, and workload routing.
    """
    __tablename__ = "review_tasks"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    document_id = Column(GUID, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    assigned_to_id = Column(GUID, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    priority = Column(String, default="MEDIUM", nullable=False)  # LOW, MEDIUM, HIGH, URGENT
    status = Column(String, default="PENDING", nullable=False)   # PENDING, IN_PROGRESS, COMPLETED, ESCALATED
    due_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC).replace(tzinfo=None))
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    document = relationship("Document", back_populates="review_tasks")
    assignee = relationship("User", foreign_keys=[assigned_to_id])
