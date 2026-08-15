import logging
import imaplib
import email
from email.header import decode_header
import os
import secrets
from datetime import datetime
from sqlalchemy.orm import Session
from app.config import settings
from app.database import SessionLocal
from app.models.document import Document, DocumentStatus, DocumentCategory

logger = logging.getLogger(__name__)

def check_mailbox_and_ingest():
    """
    Simulates or performs email ingestion by connecting via IMAP
    and downloading attachments matching rules (e.g. from invoice mailbox).
    If no credentials, logs warning and runs mock ingestion.
    """
    logger.info("Starting email ingestion check...")
    
    # We can configuration-gate this
    imap_server = os.getenv("IMAP_SERVER")
    imap_user = os.getenv("IMAP_USER")
    imap_pass = os.getenv("IMAP_PASSWORD")

    if not imap_server or not imap_user or not imap_pass:
        logger.info("IMAP credentials not configured. Running mock email ingestion.")
        _run_mock_ingestion()
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

        db = SessionLocal()
        try:
            for num in messages[0].split():
                status, data = mail.fetch(num, '(RFC822)')
                if status != "OK":
                    continue
                
                raw_email = data[0][1]
                msg = email.message_from_bytes(raw_email)
                
                # Check headers
                subject, encoding = decode_header(msg["Subject"])[0]
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
                                created_at=datetime.utcnow()
                            )
                            db.add(db_doc)
                            db.commit()
                            logger.info(f"Ingested attachment {filename} from email.")
        finally:
            db.close()

        mail.close()
        mail.logout()

    except Exception as e:
        logger.error(f"Error during IMAP email ingestion: {e}")

def _run_mock_ingestion():
    """Generates a mock ingested document to verify ingestion pipelines work."""
    db = SessionLocal()
    try:
        # Check if already has a mock invoice email ingested to avoid duplicates
        existing = db.query(Document).filter(Document.filename == "mock_email_invoice.pdf").first()
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
            created_at=datetime.utcnow()
        )
        db.add(db_doc)
        db.commit()
        logger.info("Successfully registered mock email ingestion document.")
    except Exception as e:
        logger.warning(f"Failed to create mock email doc: {e}")
    finally:
        db.close()
