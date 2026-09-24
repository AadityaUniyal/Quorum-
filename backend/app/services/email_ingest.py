import email
import imaplib
import logging
import os
import secrets
from datetime import UTC, datetime
from email.header import decode_header

from app.config import settings
from app.database import SessionLocal
from app.models.document import Document, DocumentCategory, DocumentStatus
from app.services.outbox_relay import record_outbox_event
from app.services.queue import publish_document_event
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

def check_mailbox_and_ingest(db: Session | None = None) -> None:
    """
    Simulates or performs email ingestion by connecting via IMAP
    and downloading attachments matching rules (e.g. from invoice mailbox).
    If no credentials, logs a warning and runs mock ingestion.
    Supports optional db session parameter for test injection.
    """
    logger.info("Starting email ingestion check...")

    # We can configuration-gate this
    imap_server = os.getenv("IMAP_SERVER")
    imap_user = os.getenv("IMAP_USER")
    imap_pass = os.getenv("IMAP_PASSWORD")

    if not imap_server or not imap_user or not imap_pass:
        if settings.ENVIRONMENT.lower() in {"development", "test", "testing"}:
            logger.info("IMAP credentials not configured. Running mock email ingestion.")
            _run_mock_ingestion(db=db)
        else:
            logger.warning("IMAP credentials not configured. Skipping email ingestion in production.")
        return

    try:
        mail = imaplib.IMAP4_SSL(imap_server)
        mail.login(imap_user, imap_pass)
        mail.select("inbox")

        # Search for unread messages containing PDF attachments
        status, messages = mail.search(None, 'UNSEEN')
        if status != "OK":
            logger.warning("No new messages found or query failed.")
            return

        session = db or SessionLocal()
        close_session = (db is None)
        try:
            for num in messages[0].split():
                status, data = mail.fetch(num, '(RFC822)')
                if status != "OK":
                    continue

                raw_email = data[0][1]
                msg = email.message_from_bytes(raw_email)

                # Check headers safely (Subject might be absent)
                raw_subject = msg["Subject"] or ""
                subject = ""
                if raw_subject:
                    subject, encoding = decode_header(raw_subject)[0]
                    if isinstance(subject, bytes):
                        subject = subject.decode(encoding or "utf-8")

                logger.info(f"Processing email: {subject}")

                # Process attachments
                for part in msg.walk():
                    if part.get_content_maintype() == 'multipart':
                        continue
                    if part.get('Content-Disposition') is None:
                        continue

                    filename = part.get_filename()
                    if filename:
                        filename, encoding = decode_header(filename)[0]
                        if isinstance(filename, bytes):
                            filename = filename.decode(encoding or "utf-8")

                        if filename.lower().endswith('.pdf'):
                            # Save attachment file
                            file_data = part.get_payload(decode=True)
                            if file_data is None:
                                logger.warning(f"Attachment {filename} has None payload. Skipping.")
                                continue

                            dest_dir = os.path.join(os.getcwd(), "uploads")
                            os.makedirs(dest_dir, exist_ok=True)

                            safe_name = f"email_{secrets.token_hex(4)}_{filename}"
                            dest_path = os.path.join(dest_dir, safe_name)
                            with open(dest_path, "wb") as f:
                                f.write(file_data)

                            # Register document in database
                            db_doc = Document(
                                filename=filename,
                                file_path=dest_path,
                                file_type="PDF",
                                category=DocumentCategory.INVOICE if "invoice" in filename.lower() else DocumentCategory.UNKNOWN,
                                status=DocumentStatus.INGESTED,
                                created_at=datetime.now(UTC)
                            )
                            session.add(db_doc)
                            session.flush()

                            # Record outbox event for transactional consistency
                            record_outbox_event(
                                session,
                                event_type="document.uploaded",
                                document_id=db_doc.id,
                                payload={
                                    "filename": db_doc.filename,
                                    "file_type": db_doc.file_type,
                                    "source": "email_ingest",
                                },
                            )
                            session.commit()
                            session.refresh(db_doc)
                            logger.info(f"Ingested attachment {filename} from email.")

                            # Publish event immediately so it enters the active processing pipeline
                            publish_document_event("document.uploaded", str(db_doc.id))
        finally:
            if close_session:
                session.close()

        mail.close()
        mail.logout()

    except Exception as e:
        logger.error(f"Error during IMAP email ingestion: {e}")


def _run_mock_ingestion(db: Session | None = None) -> None:
    """Generates a mock ingested document to verify ingestion pipelines work."""
    session = db or SessionLocal()
    close_session = (db is None)
    try:
        # Check if already has a mock invoice email ingested to avoid duplicates
        existing = session.query(Document).filter(Document.filename == "mock_email_invoice.pdf").first()
        if existing:
            logger.info("Mock email invoice already ingested.")
            return

        dest_dir = os.path.join(os.getcwd(), "uploads")
        os.makedirs(dest_dir, exist_ok=True)
        dest_path = os.path.join(dest_dir, "mock_email_invoice.pdf")

        # Create a simple mock empty file
        with open(dest_path, "w") as f:
            f.write("Mock invoice PDF content")

        db_doc = Document(
            filename="mock_email_invoice.pdf",
            file_path=dest_path,
            file_type="PDF",
            category=DocumentCategory.INVOICE,
            status=DocumentStatus.INGESTED,
            created_at=datetime.now(UTC),
        )
        session.add(db_doc)
        session.flush()

        # Record outbox event for transactional consistency
        record_outbox_event(
            session,
            event_type="document.uploaded",
            document_id=db_doc.id,
            payload={
                "filename": db_doc.filename,
                "file_type": db_doc.file_type,
                "source": "email_ingest",
            },
        )
        session.commit()
        session.refresh(db_doc)
        logger.info("Successfully registered mock email ingestion document.")

        # Publish event immediately so it enters active processing pipeline
        publish_document_event("document.uploaded", str(db_doc.id))
    except Exception as e:
        logger.warning(f"Failed to create mock email doc: {e}")
        if close_session:
            session.rollback()
    finally:
        if close_session:
            session.close()
