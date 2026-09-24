import logging
import uuid
from datetime import UTC, datetime
from uuid import UUID

import redis
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.audit import AuditLog
from app.models.auth import User, UserRole
from app.models.document import Document, DocumentStatus, ExtractedField, FieldValidationStatus
from app.routes.auth import RoleChecker
from app.schemas.document import DocumentResponse, DocumentReviewSubmit, DocumentSimpleResponse
from app.services.auth_access import filter_documents_for_user, require_document_write

router = APIRouter(prefix="/api/review", tags=["review"])

logger = logging.getLogger(__name__)

# Role permissions
reviewer_or_admin = RoleChecker([UserRole.ADMIN, UserRole.REVIEWER])

# Lock TTL in seconds (15 minutes)
LOCK_TTL_SECONDS = 900

LUA_HEARTBEAT_SCRIPT = """
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("expire", KEYS[1], ARGV[2])
else
    return 0
end
"""

LUA_RELEASE_SCRIPT = """
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
else
    return 0
end
"""


class InMemoryRedisFallback:
    _store = {}
    def ping(self):
        return True
    def get(self, key):
        return self._store.get(key)
    def set(self, key, value, ex=None, nx=False):
        if nx and key in self._store:
            return False
        self._store[key] = value
        return True
    def expire(self, key, seconds):
        return True
    def delete(self, key):
        return self._store.pop(key, None) is not None
    def eval(self, script, keys_num, *args):
        if not args:
            return 0
        key = args[0]
        value = args[1] if len(args) > 1 else None
        if "expire" in script:
            if self._store.get(key) == value:
                return 1
            return 0
        if self._store.get(key) == value:
            self._store.pop(key, None)
            return 1
        return 0


_in_memory_redis_fallback = InMemoryRedisFallback()
_redis_client = None
_redis_unavailable_until = 0.0


def get_redis_client():
    """Return a Redis client or a fast local in-memory fallback if Redis is unavailable."""
    global _redis_client, _redis_unavailable_until
    import time
    now = time.time()
    if now < _redis_unavailable_until:
        return _in_memory_redis_fallback
    if _redis_client is not None:
        return _redis_client
    try:
        r = redis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            password=settings.REDIS_PASSWORD,
            decode_responses=True,
            socket_connect_timeout=0.2,
            socket_timeout=0.2,
        )
        r.ping()
        _redis_client = r
        return _redis_client
    except Exception:
        _redis_unavailable_until = now + 30.0
        return _in_memory_redis_fallback


def acquire_document_lock(document_id: str, username: str, token: str | None = None) -> str | None:
    """
    Attempts to lock a document using Redis SET NX EX.
    Returns the lock token (string) if lock acquired or extended, None if already locked by another user.
    """
    lock_key = f"lock:document:{document_id}"
    r = get_redis_client()
    current_val = r.get(lock_key)

    if current_val:
        parts = current_val.split(":", 1)
        current_holder = parts[0]
        current_token = parts[1] if len(parts) > 1 else ""
        if current_holder == username and (token is None or current_token == token):
            r.expire(lock_key, LOCK_TTL_SECONDS)
            return current_token
        return None

    new_token = token or str(uuid.uuid4())
    value_to_store = f"{username}:{new_token}"
    if r.set(lock_key, value_to_store, ex=LOCK_TTL_SECONDS, nx=True) is True:
        return new_token
    return None


def release_document_lock(document_id: str, expected_value: str | None = None) -> bool:
    lock_key = f"lock:document:{document_id}"
    r = get_redis_client()
    if expected_value is None:
        return r.delete(lock_key) > 0
    res = r.eval(LUA_RELEASE_SCRIPT, 1, lock_key, expected_value)
    return int(res) > 0


def heartbeat_document_lock(document_id: str, expected_value: str) -> bool:
    lock_key = f"lock:document:{document_id}"
    r = get_redis_client()
    res = r.eval(LUA_HEARTBEAT_SCRIPT, 1, lock_key, expected_value, LOCK_TTL_SECONDS)
    return int(res) > 0


def get_lock_holder(document_id: str) -> str | None:
    lock_key = f"lock:document:{document_id}"
    r = get_redis_client()
    val = r.get(lock_key)
    if val:
        return val.split(":", 1)[0]
    return None


# Get Review Queue (Tenant-filtered)
@router.get("/queue", response_model=list[DocumentSimpleResponse])
def get_review_queue(
    db: Session = Depends(get_db),
    current_user: User = Depends(reviewer_or_admin)
):
    base_query = db.query(Document).filter(Document.status == DocumentStatus.AWAITING_REVIEW)
    query = filter_documents_for_user(base_query, current_user)
    documents = query.order_by(Document.created_at.asc()).all()

    results = []
    for doc in documents:
        uploader_name = doc.uploader.full_name if doc.uploader else "System"
        try:
            lock_holder = get_lock_holder(str(doc.id))
        except Exception:
            lock_holder = None

        results.append({
            "id": doc.id,
            "filename": doc.filename,
            "file_type": doc.file_type,
            "category": doc.category,
            "status": doc.status,
            "consensus_score": doc.consensus_score,
            "created_at": doc.created_at,
            "uploader_name": f"{uploader_name} (Locked by {lock_holder})" if lock_holder else uploader_name
        })
    return results


# Lock document for review (Tenant-safe)
@router.post("/{document_id}/lock", status_code=status.HTTP_200_OK)
def lock_document(
    document_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(reviewer_or_admin)
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    require_document_write(current_user, doc)

    doc_id_str = str(document_id)
    token = acquire_document_lock(doc_id_str, current_user.full_name)
    if not token:
        holder = get_lock_holder(doc_id_str) or "another user"
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"This document is currently locked for review by {holder}."
        )
    return {"message": "Document locked successfully", "locked_by": current_user.full_name, "lock_token": token}


# Heartbeat
@router.post("/{document_id}/heartbeat", status_code=status.HTTP_200_OK)
def heartbeat_lock(
    document_id: UUID,
    lock_token: str | None = None,
    current_user: User = Depends(reviewer_or_admin)
):
    doc_id_str = str(document_id)
    lock_key = f"lock:document:{doc_id_str}"
    r = get_redis_client()
    current_val = r.get(lock_key)
    if current_val is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active lock found for this document."
        )
    parts = current_val.split(":", 1)
    current_holder = parts[0]
    current_token = parts[1] if len(parts) > 1 else ""

    if current_holder != current_user.full_name:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Lock is held by {current_holder}, not you."
        )
    if lock_token and current_token != lock_token:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid lock token."
        )

    success = heartbeat_document_lock(doc_id_str, current_val)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Lock heartbeat renewal failed."
        )
    return {"message": "Lock extended successfully", "ttl_seconds": LOCK_TTL_SECONDS}


# Unlock document
@router.post("/{document_id}/unlock", status_code=status.HTTP_200_OK)
def unlock_document(
    document_id: UUID,
    lock_token: str | None = None,
    current_user: User = Depends(reviewer_or_admin)
):
    doc_id_str = str(document_id)
    lock_key = f"lock:document:{doc_id_str}"
    r = get_redis_client()
    val = r.get(lock_key)
    if val:
        parts = val.split(":", 1)
        holder = parts[0]
        token = parts[1] if len(parts) > 1 else ""
        if holder != current_user.full_name and current_user.role != UserRole.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Cannot unlock document locked by {holder}."
            )
        if lock_token and token != lock_token:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid lock token."
            )
        release_document_lock(doc_id_str, val)
    return {"message": "Document unlocked successfully"}


# Submit review corrections (Atomic Transaction with Provenance)
@router.post("/{document_id}/submit", response_model=DocumentResponse)
def submit_review(
    document_id: UUID,
    review_data: DocumentReviewSubmit,
    lock_token: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(reviewer_or_admin)
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    require_document_write(current_user, doc)

    doc_id_str = str(document_id)
    lock_key = f"lock:document:{doc_id_str}"
    r = get_redis_client()
    val = r.get(lock_key)
    if val:
        parts = val.split(":", 1)
        holder = parts[0]
        token = parts[1] if len(parts) > 1 else ""
        if holder != current_user.full_name and current_user.role != UserRole.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This document is locked by {holder}. Please unlock it first."
            )
        if lock_token and token != lock_token:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid lock token."
            )

    # Apply changes and calculate before/after difference for audit logs
    diffs = {}

    for update in review_data.updates:
        field = db.query(ExtractedField).filter(
            ExtractedField.document_id == document_id,
            ExtractedField.field_key == update.field_key
        ).first()

        if field:
            before_val = field.consensus_value
            after_val = update.consensus_value

            if before_val != after_val:
                field.consensus_value = after_val
                field.is_modified = True
                field.validation_status = FieldValidationStatus.MANUAL_CORRECTION
                field.verification_source = "HUMAN"
                field.verified_by = current_user.id
                field.verified_at = datetime.now(UTC)

                diffs[update.field_key] = {
                    "before": before_val,
                    "after": after_val
                }
        else:
            # Create newly added custom field
            new_field = ExtractedField(
                id=uuid.uuid4(),
                document_id=document_id,
                field_key=update.field_key,
                extracted_value=update.consensus_value,
                consensus_value=update.consensus_value,
                critic_score=1.0,
                auditor_score=1.0,
                confidence_score=1.0,
                is_modified=True,
                validation_status=FieldValidationStatus.MANUAL_CORRECTION,
                verification_source="HUMAN",
                verified_by=current_user.id,
                verified_at=datetime.now(UTC)
            )
            db.add(new_field)
            diffs[update.field_key] = {
                "before": None,
                "after": update.consensus_value,
                "action": "ADDED"
            }

    # Process deletions
    if getattr(review_data, "deleted_field_keys", None):
        for del_key in review_data.deleted_field_keys:
            del_field = db.query(ExtractedField).filter(
                ExtractedField.document_id == document_id,
                ExtractedField.field_key == del_key
            ).first()
            if del_field:
                db.delete(del_field)
                diffs[del_key] = {"action": "DELETED"}

    # Update document status to PROCESSED
    doc.status = DocumentStatus.PROCESSED

    # Write Correction Audit Log in SAME atomic transaction
    if diffs:
        audit = AuditLog(
            document_id=doc.id,
            user_id=current_user.id,
            action="HUMAN_REVIEW_CORRECTION",
            details={
                "reviewer": current_user.full_name,
                "corrections": diffs
            }
        )
        db.add(audit)

        # Active Learning: Record human feedback into exemplar memory for future few-shot extraction
        try:
            from app.services.active_learning import ActiveLearningService
            ActiveLearningService.record_corrections(
                document_id=str(doc.id),
                category=str(doc.category.value if doc.category else "UNKNOWN"),
                corrections=diffs,
                organization_id=str(doc.organization_id) if doc.organization_id else None,
            )
        except Exception as e:
            logger.warning(f"ActiveLearning: Failed to record exemplar: {e}")

    # Commit all changes atomically
    db.commit()

    # Release Lock AFTER commit
    if val:
        release_document_lock(doc_id_str, val)
    else:
        release_document_lock(doc_id_str)

    # Reload document
    db.refresh(doc)
    return doc


class DocumentAssignRequest(BaseModel):
    assigned_to_id: UUID
    due_date: datetime | None = None


@router.post("/{document_id}/assign", status_code=status.HTTP_200_OK)
def assign_document(
    document_id: UUID,
    req_data: DocumentAssignRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(reviewer_or_admin)
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    require_document_write(current_user, doc)

    target_user = db.query(User).filter(User.id == req_data.assigned_to_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Assigned user not found")

    # If organization exists, verify assignee belongs to the same organization
    if current_user.organization_id and target_user.organization_id != current_user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot assign document to a user in a different organization."
        )

    doc.assigned_to_id = req_data.assigned_to_id
    if req_data.due_date:
        doc.due_date = req_data.due_date

    # Create notification (Roadmap 2.3)
    from app.models.notification import Notification
    notification = Notification(
        user_id=target_user.id,
        title="Document Assignment",
        message=f"You have been assigned to review: {doc.filename}. Due: {doc.due_date or 'No SLA'}"
    )
    db.add(notification)
    db.commit()

    return {"message": f"Document assigned successfully to {target_user.full_name}"}


@router.post("/{document_id}/approve", status_code=status.HTTP_200_OK)
def approve_document_stage(
    document_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(reviewer_or_admin)
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    require_document_write(current_user, doc)

    stages = ["OPERATOR_REVIEW", "MANAGER_APPROVAL", "FINANCE_STAMP", "APPROVED"]
    current_stage = doc.approval_stage or "OPERATOR_REVIEW"

    if current_stage not in stages or current_stage == "APPROVED":
        raise HTTPException(status_code=400, detail=f"Document is already fully approved or in invalid stage: {current_stage}")

    next_idx = stages.index(current_stage) + 1
    next_stage = stages[next_idx]
    doc.approval_stage = next_stage

    if next_stage == "APPROVED":
        doc.status = DocumentStatus.PROCESSED

        # Dispatch webhook (Roadmap 2.4 / Webhook Studio)
        from app.services.webhook import dispatch_webhook
        dispatch_webhook(
            event_type="document.processed",
            payload={
                "document_id": str(doc.id),
                "filename": doc.filename,
                "category": doc.category.value if doc.category else None,
                "consensus_score": doc.consensus_score,
                "timestamp": datetime.now(UTC).isoformat()
            }
        )

    # Notify uploader/assignee of stage transition (Roadmap 2.3)
    from app.models.notification import Notification
    notify_user_id = doc.uploaded_by or doc.assigned_to_id
    if notify_user_id:
        notification = Notification(
            user_id=notify_user_id,
            title="Document Status Update",
            message=f"Document '{doc.filename}' has been moved to: {next_stage}."
        )
        db.add(notification)

    db.commit()
    return {"message": f"Document transitioned to stage: {next_stage}", "approval_stage": next_stage}
