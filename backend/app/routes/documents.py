import hashlib
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, Response, UploadFile, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.audit import AuditLog
from app.models.auth import User, UserRole
from app.models.document import Document, DocumentCategory, DocumentStatus
from app.routes.auth import RoleChecker
from app.schemas.document import DocumentCreateSchema, DocumentResponse, DocumentSimpleResponse
from app.services.auth_access import filter_documents_for_user, require_document_read, require_document_write
from app.services.queue import publish_document_event
from app.services.storage import delete_stored_file, save_uploaded_file

router = APIRouter(prefix="/api/documents", tags=["documents"])

# Role permissions
admin_or_operator = RoleChecker([UserRole.ADMIN, UserRole.OPERATOR])
any_user = RoleChecker([UserRole.ADMIN, UserRole.OPERATOR, UserRole.REVIEWER, UserRole.VIEWER])


class BatchUploadResponse(BaseModel):
    batch_id: str
    total_files: int
    successful_uploads: int
    duplicates: int
    failed_uploads: int
    documents: list[dict] = []
    errors: list[dict] = []
    total: int = 0
    successful: int = 0
    failed: int = 0
    items: list[dict] = []


# Batch Upload Endpoint (Roadmap Phase 2.2)
@router.post("/batch-upload", response_model=BatchUploadResponse, status_code=status.HTTP_201_CREATED)
async def batch_upload_documents(
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_or_operator)
):
    """
    Transactional batch document ingestion endpoint.
    Accepts multi-file payloads, detects duplicates, assigns a batch correlation ID,
    and enqueues background processing for each document.
    """
    import uuid

    from app.services.outbox_relay import record_outbox_event

    batch_id = f"batch_{uuid.uuid4().hex[:12]}"
    successful = 0
    duplicates = 0
    failed = 0
    docs_out = []
    errors_out = []
    items_out = []

    for file in files:
        try:
            storage_data = save_uploaded_file(file)

            # Compute content hash
            sha256 = hashlib.sha256()
            with open(storage_data["file_path"], "rb") as f:
                for chunk in iter(lambda: f.read(8192), b""):
                    sha256.update(chunk)
            file_content_hash = sha256.hexdigest()
            composite = f"{file_content_hash}:{storage_data['file_type']}:{storage_data['size_bytes']}"
            content_hash = hashlib.sha256(composite.encode("utf-8")).hexdigest()

            # Check duplicate within scope
            dup_query = db.query(Document).filter(
                Document.content_hash == content_hash,
                Document.deleted_at.is_(None)
            )
            if current_user.organization_id:
                dup_query = dup_query.filter(Document.organization_id == current_user.organization_id)

            existing_doc = dup_query.first()
            if existing_doc:
                delete_stored_file(storage_data["file_path"])
                duplicates += 1
                docs_out.append({
                    "id": str(existing_doc.id),
                    "filename": existing_doc.filename,
                    "duplicate": True,
                    "status": existing_doc.status.value if existing_doc.status else "COMPLETED",
                    "batch_id": batch_id
                })
                items_out.append({
                    "document_id": str(existing_doc.id),
                    "filename": existing_doc.filename,
                    "category": existing_doc.category.value if existing_doc.category else "UNKNOWN",
                    "status": existing_doc.status.value if existing_doc.status else "COMPLETED",
                    "error": None
                })
                continue

            # Create document
            db_doc = Document(
                filename=storage_data["filename"],
                file_path=storage_data["file_path"],
                file_type=storage_data["file_type"],
                size_bytes=storage_data.get("size_bytes"),
                status=DocumentStatus.INGESTED,
                category=DocumentCategory.UNKNOWN,
                uploaded_by=current_user.id,
                organization_id=current_user.organization_id,
                content_hash=content_hash,
            )
            db.add(db_doc)
            db.commit()
            db.refresh(db_doc)

            # Audit log
            audit = AuditLog(
                document_id=db_doc.id,
                user_id=current_user.id,
                action="BATCH_INGEST_DOCUMENT",
                details={
                    "batch_id": batch_id,
                    "filename": db_doc.filename,
                    "file_type": db_doc.file_type,
                    "size_bytes": storage_data["size_bytes"],
                    "content_hash": content_hash,
                }
            )
            db.add(audit)

            # Outbox event
            record_outbox_event(
                db=db,
                event_type="document.uploaded",
                document_id=db_doc.id,
                organization_id=current_user.organization_id,
                payload={"filename": db_doc.filename, "file_type": db_doc.file_type, "batch_id": batch_id}
            )
            db.commit()

            # Publish event
            publish_document_event("document.uploaded", db_doc.id)

            successful += 1
            docs_out.append({
                "id": str(db_doc.id),
                "filename": db_doc.filename,
                "duplicate": False,
                "status": db_doc.status.value if db_doc.status else "INGESTED",
                "batch_id": batch_id
            })
            items_out.append({
                "document_id": str(db_doc.id),
                "filename": db_doc.filename,
                "category": db_doc.category.value if db_doc.category else "UNKNOWN",
                "status": db_doc.status.value if db_doc.status else "INGESTED",
                "error": None
            })

        except Exception as file_err:
            failed += 1
            errors_out.append({
                "filename": getattr(file, "filename", "unknown"),
                "error": str(file_err)
            })
            items_out.append({
                "document_id": None,
                "filename": getattr(file, "filename", "unknown"),
                "category": None,
                "status": "FAILED",
                "error": str(file_err)
            })

    return BatchUploadResponse(
        batch_id=batch_id,
        total_files=len(files),
        successful_uploads=successful,
        duplicates=duplicates,
        failed_uploads=failed,
        documents=docs_out,
        errors=errors_out,
        total=len(files),
        successful=successful,
        failed=failed,
        items=items_out
    )


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

        # Check for duplicate upload within user's organization / scope
        dup_query = db.query(Document).filter(
            Document.content_hash == content_hash,
            Document.deleted_at.is_(None)
        )
        if current_user.organization_id:
            dup_query = dup_query.filter(Document.organization_id == current_user.organization_id)

        existing_doc = dup_query.first()
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
            size_bytes=storage_data.get("size_bytes"),
            status=DocumentStatus.INGESTED,
            category=DocumentCategory.UNKNOWN,
            uploaded_by=current_user.id,
            organization_id=current_user.organization_id,
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
                "organization_id": str(current_user.organization_id) if current_user.organization_id else None,
            }
        )
        db.add(audit)

        # Record Transactional Outbox Event atomically
        from app.services.outbox_relay import record_outbox_event
        record_outbox_event(
            db=db,
            event_type="document.uploaded",
            document_id=db_doc.id,
            organization_id=current_user.organization_id,
            payload={"filename": db_doc.filename, "file_type": db_doc.file_type}
        )
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


# JSON document creation endpoint (no file upload)
@router.post("/", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
def create_document_json(
    doc: DocumentCreateSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_or_operator),
):
    """Create a document from JSON payload without uploading a file.
    Stores content in the `ocr_text` field and leaves file_path empty.
    """
    new_doc = Document(
        filename=doc.title,
        file_path="",
        file_type="text",
        status=DocumentStatus.INGESTED,
        category=DocumentCategory.UNKNOWN,
        uploaded_by=current_user.id,
        organization_id=current_user.organization_id,
    )
    new_doc.ocr_text = doc.content
    db.add(new_doc)
    db.commit()
    db.refresh(new_doc)
    return new_doc


# List documents (Tenant-safe with pagination and eager loading)
@router.get("", response_model=list[DocumentSimpleResponse])
def list_documents(
    category: DocumentCategory | None = None,
    status: DocumentStatus | None = None,
    skip: int = Query(0, ge=0, description="Number of items to skip for pagination"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of items to return"),
    db: Session = Depends(get_db),
    current_user: User = Depends(any_user)
):
    query = filter_documents_for_user(db.query(Document).options(joinedload(Document.uploader)), current_user)
    if category:
        query = query.filter(Document.category == category)
    if status:
        query = query.filter(Document.status == status)

    documents = query.order_by(Document.created_at.desc()).offset(skip).limit(limit).all()

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


# Get single document details (Tenant-safe)
@router.get("/{document_id}", response_model=DocumentResponse)
def get_document(
    document_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(any_user)
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    return require_document_read(current_user, doc)


# Reprocess document endpoint (Tenant-safe)
@router.post("/{document_id}/reprocess", response_model=DocumentResponse)
def reprocess_document(
    document_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_or_operator)
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    require_document_write(current_user, doc)

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


# Delete document (Tenant-safe with audit)
@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_or_operator)
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    require_document_write(current_user, doc)

    # Delete local file if present
    if doc.file_path:
        delete_stored_file(doc.file_path)

    # Create audit trail record before deletion
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


class DocumentUpdateSchema(BaseModel):
    filename: str | None = None
    category: DocumentCategory | None = None


@router.patch("/{document_id}", response_model=DocumentResponse)
def update_document(
    document_id: UUID,
    update_data: DocumentUpdateSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_or_operator)
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    require_document_write(current_user, doc)
    if update_data.filename:
        doc.filename = update_data.filename
    if update_data.category:
        doc.category = update_data.category
    db.commit()
    db.refresh(doc)
    return doc


class BulkDeleteSchema(BaseModel):
    document_ids: list[UUID]


@router.post("/bulk-delete", status_code=status.HTTP_200_OK)
def bulk_delete_documents(
    payload: BulkDeleteSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_or_operator)
):
    deleted_count = 0
    for doc_id in payload.document_ids:
        doc = db.query(Document).filter(Document.id == doc_id).first()
        if doc:
            require_document_write(current_user, doc)
            if doc.file_path:
                delete_stored_file(doc.file_path)
            db.delete(doc)
            deleted_count += 1
    db.commit()
    return {"message": f"Successfully deleted {deleted_count} documents", "count": deleted_count}


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
    require_document_read(current_user, doc)

    from app.services.local_engine import LocalNaiveBayesClassifier
    text = doc.ocr_text or ""
    _, probabilities = LocalNaiveBayesClassifier.classify(text)
    return probabilities


@router.get("/{document_id}/audit-line-items")
def get_document_audit_line_items(document_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(any_user)):
    doc = db.query(Document).filter(Document.id == str(document_id)).first()
    require_document_read(current_user, doc)

    from app.services.local_engine import LocalLayoutParser, LocalTableReconstructor
    text = doc.ocr_text or ""
    fields = LocalLayoutParser.extract_fields(text, doc.category.value if doc.category else "INVOICE")
    line_items = fields.get("line_items", [])
    audit_results = LocalTableReconstructor.audit_line_items(line_items)
    return {"line_items": line_items, "audit_results": audit_results}


@router.get("/{document_id}/spatial-layout")
def get_document_spatial_layout(
    document_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(any_user)
):
    """
    Returns spatial token bounding box coordinates and page dimensions for interactive canvas visual grounding.
    """
    doc = db.query(Document).filter(Document.id == str(document_id)).first()
    require_document_read(current_user, doc)

    from app.services.spatial_grounding import SpatialGroundingEngine
    layout = SpatialGroundingEngine.extract_spatial_layout(doc.file_path)
    return layout


@router.get("/{document_id}/export/{format}")
def export_document_erp(
    document_id: UUID,
    format: str,
    raw: bool = False,
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(any_user)
):
    """
    Exports extracted document data directly into standardized ERP & Accounting payloads:
    - 'quickbooks': QuickBooks Online / Desktop Bill JSON schema
    - 'xero': Xero ACCPAY XML payload
    - 'sap': SAP S/4HANA / NetSuite AP Journal CSV
    - 'json': Universal IDP JSON schema with full provenance
    """
    from app.services.export import (
        export_to_quickbooks,
        export_to_sap,
        export_to_universal_json,
        export_to_xero,
    )

    doc = db.query(Document).filter(Document.id == str(document_id)).first()
    require_document_read(current_user, doc)

    clean_format = format.lower().strip()
    safe_fn = (doc.filename or "document").rsplit(".", 1)[0]

    if clean_format in ("quickbooks", "qbo"):
        payload = export_to_quickbooks(doc)
        return JSONResponse(
            content=payload,
            headers={"Content-Disposition": f'attachment; filename="{safe_fn}_quickbooks.json"'}
        )

    elif clean_format == "xero":
        xml_content = export_to_xero(doc)
        if raw or (request and request.headers.get("accept") == "application/xml"):
            return Response(
                content=xml_content,
                media_type="application/xml",
                headers={"Content-Disposition": f'attachment; filename="{safe_fn}_xero.xml"'}
            )
        return JSONResponse(
            content={"format": "xero", "xml_payload": xml_content, "filename": f"{safe_fn}_xero.xml"},
            headers={"Content-Disposition": f'attachment; filename="{safe_fn}_xero.xml"'}
        )

    elif clean_format in ("sap", "netsuite", "csv"):
        csv_content = export_to_sap(doc)
        if raw or (request and request.headers.get("accept") == "text/csv"):
            return Response(
                content=csv_content,
                media_type="text/csv",
                headers={"Content-Disposition": f'attachment; filename="{safe_fn}_sap_journal.csv"'}
            )
        return JSONResponse(
            content={"format": "sap", "csv_payload": csv_content, "filename": f"{safe_fn}_sap_journal.csv"},
            headers={"Content-Disposition": f'attachment; filename="{safe_fn}_sap_journal.csv"'}
        )

    elif clean_format in ("json", "universal"):
        payload = export_to_universal_json(doc)
        return JSONResponse(
            content=payload,
            headers={"Content-Disposition": f'attachment; filename="{safe_fn}_docintel.json"'}
        )

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported export format: '{format}'. Supported formats: quickbooks, xero, sap, json"
        )

