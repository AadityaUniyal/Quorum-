import hashlib
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.audit import AuditLog
from app.models.auth import User, UserRole
from app.models.document import Document, DocumentCategory, DocumentStatus
from app.routes.auth import RoleChecker
from app.schemas.document import DocumentResponse, DocumentSimpleResponse
from app.services.cache import cache
from app.services.queue import publish_document_event
from app.services.storage import delete_stored_file, save_uploaded_file

router = APIRouter(prefix="/api/documents", tags=["documents"])

# Role permissions
admin_or_operator = RoleChecker([UserRole.ADMIN, UserRole.OPERATOR])
any_user = RoleChecker([UserRole.ADMIN, UserRole.OPERATOR, UserRole.REVIEWER, UserRole.VIEWER])

# Upload file endpoint
@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_or_operator)
):
    # Save the file locally using storage service
    storage_data = save_uploaded_file(file)

    try:
        # Compute SHA-256 hash of saved file content
        sha256 = hashlib.sha256()
        with open(storage_data["file_path"], "rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                sha256.update(chunk)
        file_content_hash = sha256.hexdigest()

        # Build a composite hash using: content_hash + file_type + file_size
        composite_string = f"{file_content_hash}:{storage_data['file_type']}:{storage_data['size_bytes']}"
        content_hash = hashlib.sha256(composite_string.encode("utf-8")).hexdigest()

        # Check for duplicate upload
        existing_doc = db.query(Document).filter(Document.content_hash == content_hash).first()
        if existing_doc:
            # Clean up the duplicate file we just saved
            delete_stored_file(storage_data["file_path"])
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "message": "Duplicate document detected. Returning existing document.",
                    "duplicate": True,
                    "id": str(existing_doc.id),
                    "filename": existing_doc.filename,
                    "file_type": existing_doc.file_type,
                    "category": existing_doc.category.value if existing_doc.category else None,
                    "status": existing_doc.status.value if existing_doc.status else None,
                    "consensus_score": existing_doc.consensus_score,
                    "created_at": existing_doc.created_at.isoformat() if existing_doc.created_at else None,
                },
            )

        # Create database entry for document
        db_doc = Document(
            filename=storage_data["filename"],
            file_path=storage_data["file_path"],
            file_type=storage_data["file_type"],
            status=DocumentStatus.INGESTED,
            category=DocumentCategory.UNKNOWN,
            uploaded_by=current_user.id,
            content_hash=content_hash,
        )
        db.add(db_doc)
        db.commit()
        db.refresh(db_doc)

        # Write Ingestion Audit Log
        audit = AuditLog(
            document_id=db_doc.id,
            user_id=current_user.id,
            action="INGEST_DOCUMENT",
            details={
                "filename": db_doc.filename,
                "file_type": db_doc.file_type,
                "size_bytes": storage_data["size_bytes"],
                "content_hash": content_hash,
            }
        )
        db.add(audit)
        db.commit()

        # Enqueue document processing event
        publish_document_event("document.uploaded", db_doc.id)

        # Reload to ensure relationships are loaded
        return db.query(Document).filter(Document.id == db_doc.id).first()

    except Exception as e:
        if not isinstance(e, HTTPException) and not hasattr(e, "status_code"):
            # Clean up file in case of database registration errors
            delete_stored_file(storage_data["file_path"])
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to record document upload: {str(e)}"
        ) from e

# List all documents
@cache(ttl_seconds=300)
@router.get("", response_model=list[DocumentSimpleResponse])
def list_documents(
    category: DocumentCategory | None = None,
    status: DocumentStatus | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(any_user)
):
    query = db.query(Document)
    if category:
        query = query.filter(Document.category == category)
    if status:
        query = query.filter(Document.status == status)

    documents = query.order_by(Document.created_at.desc()).all()

    # Format simple response containing uploader's name
    results = []
    for doc in documents:
        uploader_name = doc.uploader.full_name if doc.uploader else "System"
        results.append({
            "id": doc.id,
            "filename": doc.filename,
            "file_type": doc.file_type,
            "category": doc.category,
            "status": doc.status,
            "consensus_score": doc.consensus_score,
            "created_at": doc.created_at,
            "uploader_name": uploader_name
        })

    return results

# Get single document details
@cache(ttl_seconds=300)
@router.get("/{document_id}", response_model=DocumentResponse)
def get_document(
    document_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(any_user)
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc

# Reprocess document endpoint
@router.post("/{document_id}/reprocess", response_model=DocumentResponse)
def reprocess_document(
    document_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_or_operator)
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    doc.status = DocumentStatus.INGESTED
    db.commit()

    # Audit reprocessing action
    audit = AuditLog(
        document_id=doc.id,
        user_id=current_user.id,
        action="TRIGGER_REPROCESS",
        details={"requested_by": current_user.email}
    )
    db.add(audit)
    db.commit()

    # Re-publish processing event
    publish_document_event("document.reprocess", doc.id)
    return doc

# Delete document
@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_or_operator)
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Delete local file
    delete_stored_file(doc.file_path)

    # Create audit trail record before deletion (set document_id to None in table after deletion cascade)
    audit = AuditLog(
        user_id=current_user.id,
        action="DELETE_DOCUMENT",
        details={"deleted_filename": doc.filename, "document_id": str(doc.id)}
    )
    db.add(audit)

    # Database cascade deletes extracted fields automatically
    db.delete(doc)
    db.commit()
    return None


# Inspect DLQ messages
@router.get("/dlq", status_code=status.HTTP_200_OK)
def inspect_dlq(
    current_user: User = Depends(admin_or_operator)
):
    """
    Retrieves messages from DLQ for inspection without acknowledging them (re-queueing immediately).
    """
    import json

    import pika

    from app.config import settings
    credentials = pika.PlainCredentials(settings.RABBITMQ_USER, settings.RABBITMQ_PASS)
    parameters = pika.ConnectionParameters(
        host=settings.RABBITMQ_HOST,
        port=settings.RABBITMQ_PORT,
        credentials=credentials,
        socket_timeout=2,
    )
    messages = []
    try:
        connection = pika.BlockingConnection(parameters)
        channel = connection.channel()
        tags = []
        for _ in range(20):
            method_frame, header_frame, body = channel.basic_get(queue="document_processing_dlq", auto_ack=False)
            if not method_frame:
                break
            try:
                payload = json.loads(body.decode())
            except Exception:
                payload = {"raw": body.decode()}
            messages.append({
                "delivery_tag": method_frame.delivery_tag,
                "payload": payload,
                "headers": dict(header_frame.headers) if header_frame.headers else {}
            })
            tags.append(method_frame.delivery_tag)

        # Nack all of them so they stay in DLQ
        for tag in tags:
            channel.basic_nack(delivery_tag=tag, requeue=True)

        connection.close()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to inspect DLQ: {e}")

    return messages


# Requeue DLQ messages
@router.post("/dlq/requeue", status_code=status.HTTP_200_OK)
def requeue_dlq(
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_or_operator)
):
    """
    Consumes all messages from DLQ and republishes them to the main queue, resetting their retry count.
    Also updates document status to INGESTED so it is processed.
    """
    import json

    import pika

    from app.config import settings
    credentials = pika.PlainCredentials(settings.RABBITMQ_USER, settings.RABBITMQ_PASS)
    parameters = pika.ConnectionParameters(
        host=settings.RABBITMQ_HOST,
        port=settings.RABBITMQ_PORT,
        credentials=credentials,
        socket_timeout=2,
    )
    requeued_count = 0
    try:
        connection = pika.BlockingConnection(parameters)
        channel = connection.channel()
        while True:
            method_frame, header_frame, body = channel.basic_get(queue="document_processing_dlq", auto_ack=False)
            if not method_frame:
                break

            # Acknowledge from DLQ
            channel.basic_ack(delivery_tag=method_frame.delivery_tag)

            # Reset retry count in headers
            headers = dict(header_frame.headers) if header_frame.headers else {}
            headers["x-retry-count"] = 0

            # Publish to main queue
            channel.basic_publish(
                exchange="",
                routing_key="document_processing_queue",
                body=body,
                properties=pika.BasicProperties(
                    delivery_mode=2,
                    headers=headers
                )
            )
            requeued_count += 1

            # Update Document status back to INGESTED
            try:
                payload = json.loads(body.decode())
                doc_id = payload.get("document_id")
                if doc_id:
                    doc = db.query(Document).filter(Document.id == doc_id).first()
                    if doc:
                        doc.status = DocumentStatus.INGESTED
                        db.commit()
            except Exception:
                pass

        connection.close()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to requeue DLQ: {e}")

    return {"message": f"Successfully requeued {requeued_count} messages from DLQ."}


@router.get("/settings/synonyms")
def get_synonyms(current_user: User = Depends(any_user)):
    from app.services.local_engine import load_local_synonyms
    return load_local_synonyms()


@router.post("/settings/synonyms")
def update_synonyms(data: dict[str, list[str]], current_user: User = Depends(admin_or_operator)):
    from app.services.local_engine import save_local_synonyms
    save_local_synonyms(data)
    return {"status": "success", "message": "Synonyms updated successfully."}


@router.get("/{document_id}/probabilities")
def get_document_probabilities(document_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(any_user)):
    doc = db.query(Document).filter(Document.id == str(document_id)).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    from app.services.local_engine import LocalNaiveBayesClassifier
    text = doc.ocr_text or ""
    _, probabilities = LocalNaiveBayesClassifier.classify(text)
    return probabilities


@router.get("/{document_id}/audit-line-items")
def get_document_audit_line_items(document_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(any_user)):
    doc = db.query(Document).filter(Document.id == str(document_id)).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    from app.services.local_engine import LocalLayoutParser, LocalTableReconstructor
    text = doc.ocr_text or ""
    fields = LocalLayoutParser.extract_fields(text, doc.category.value if doc.category else "INVOICE")
    line_items = fields.get("line_items", [])
    audit_results = LocalTableReconstructor.audit_line_items(line_items)
    return {"line_items": line_items, "audit_results": audit_results}


