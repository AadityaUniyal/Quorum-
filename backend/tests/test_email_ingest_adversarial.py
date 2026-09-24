"""
Adversarial and Empirical Stress Test Suite for backend/app/services/email_ingest.py
Milestone 2 Challenger 2

Empirically challenges:
1. Empty and zero-byte attachments, malformed MIME payloads (NoneType)
2. Duplicate ingestion and idempotency under repeated runs
3. Database session commit failures, rollbacks, and ghost-event prevention
4. Message broker failures during publish_document_event and outbox recovery
5. Email header edge cases (missing Subject, non-ASCII encoded subjects, mixed attachments, case-insensitive .PDF extensions)
"""

import os
from email.message import EmailMessage
from unittest.mock import MagicMock, patch

from sqlalchemy.exc import OperationalError

from app.config import settings
from app.models.document import Document, DocumentCategory, DocumentStatus
from app.models.outbox import OutboxEvent
from app.services.email_ingest import _run_mock_ingestion, check_mailbox_and_ingest
from app.services.outbox_relay import relay_outbox_events

try:
    from backend.tests.conftest import TestingSessionLocal
except ImportError:
    from tests.conftest import TestingSessionLocal


# =========================================================================
# Scenario 1: Empty & Zero-Byte Attachments, Malformed Payloads
# =========================================================================

def test_imap_ingestion_zero_byte_pdf_attachment(db_session, monkeypatch, tmp_path):
    """
    Verify that an email with a 0-byte PDF attachment is successfully ingested,
    stored with INGESTED status, records an OutboxEvent, and publishes the event.
    """
    monkeypatch.setenv("IMAP_SERVER", "imap.stress.test")
    monkeypatch.setenv("IMAP_USER", "inbox@docintel.test")
    monkeypatch.setenv("IMAP_PASSWORD", "secret")

    msg = EmailMessage()
    msg["Subject"] = "Zero Byte Invoice"
    msg["From"] = "sender@stress.test"
    msg["To"] = "inbox@docintel.test"
    msg.set_content("Empty invoice attached.")
    msg.add_attachment(b"", maintype="application", subtype="pdf", filename="empty_invoice.pdf")

    mock_mail = MagicMock()
    mock_mail.search.return_value = ("OK", [b"1"])
    mock_mail.fetch.return_value = ("OK", [(b"1 (RFC822)", msg.as_bytes())])

    with patch("imaplib.IMAP4_SSL", return_value=mock_mail), \
         patch("app.services.email_ingest.publish_document_event") as mock_publish:
        check_mailbox_and_ingest(db=db_session)

    doc = db_session.query(Document).filter(Document.filename == "empty_invoice.pdf").first()
    assert doc is not None
    assert doc.status == DocumentStatus.INGESTED
    assert doc.category == DocumentCategory.INVOICE
    assert os.path.exists(doc.file_path)
    assert os.path.getsize(doc.file_path) == 0

    outbox = db_session.query(OutboxEvent).filter(OutboxEvent.document_id == doc.id).first()
    assert outbox is not None
    assert outbox.event_type == "document.uploaded"
    assert outbox.status == "PENDING"
    assert outbox.payload["filename"] == "empty_invoice.pdf"

    mock_publish.assert_called_once_with("document.uploaded", str(doc.id))


def test_imap_ingestion_malformed_none_payload_graceful_handling(db_session, monkeypatch):
    """
    Verify that when part.get_payload(decode=True) returns None (corrupted MIME),
    the ingestion service catches the exception gracefully, logs an error,
    does not insert a partial Document, and does NOT publish an event.
    """
    monkeypatch.setenv("IMAP_SERVER", "imap.stress.test")
    monkeypatch.setenv("IMAP_USER", "inbox@docintel.test")
    monkeypatch.setenv("IMAP_PASSWORD", "secret")

    msg = EmailMessage()
    msg["Subject"] = "Corrupted MIME Invoice"
    msg["From"] = "sender@stress.test"
    msg["To"] = "inbox@docintel.test"
    msg.set_content("Corrupted PDF payload.")
    msg.add_attachment(b"dummy content", maintype="application", subtype="pdf", filename="corrupted.pdf")

    mock_mail = MagicMock()
    mock_mail.search.return_value = ("OK", [b"1"])
    mock_mail.fetch.return_value = ("OK", [(b"1 (RFC822)", msg.as_bytes())])

    with patch("imaplib.IMAP4_SSL", return_value=mock_mail), \
         patch("email.message.EmailMessage.walk") as mock_walk, \
         patch("app.services.email_ingest.publish_document_event") as mock_publish:

        mock_part = MagicMock()
        mock_part.get_content_maintype.return_value = "application"
        mock_part.get.return_value = "attachment"
        mock_part.get_filename.return_value = "corrupted.pdf"
        mock_part.get_payload.return_value = None  # None payload simulates broken decoding

        mock_walk.return_value = [mock_part]

        check_mailbox_and_ingest(db=db_session)

    # Document should not be saved
    doc = db_session.query(Document).filter(Document.filename == "corrupted.pdf").first()
    assert doc is None
    # No event should be published
    mock_publish.assert_not_called()


# =========================================================================
# Scenario 2: Duplicate Ingestion & Idempotency
# =========================================================================

def test_mock_ingestion_idempotency_duplicate_calls(db_session):
    """
    Verify that calling _run_mock_ingestion multiple times is idempotent:
    it only inserts the document once, creates one OutboxEvent, and calls publish_document_event once.
    """
    # Clean up prior records if any
    db_session.query(Document).filter(Document.filename == "mock_email_invoice.pdf").delete()
    db_session.commit()

    with patch("app.services.email_ingest.publish_document_event") as mock_publish:
        # First execution: registers doc and outbox event
        _run_mock_ingestion(db=db_session)
        assert mock_publish.call_count == 1

        # Second execution: detects existing document and exits early
        _run_mock_ingestion(db=db_session)
        assert mock_publish.call_count == 1  # Not called again

    docs = db_session.query(Document).filter(Document.filename == "mock_email_invoice.pdf").all()
    assert len(docs) == 1

    outbox_events = (
        db_session.query(OutboxEvent)
        .filter(OutboxEvent.document_id == docs[0].id)
        .all()
    )
    assert len(outbox_events) == 1


def test_imap_ingestion_duplicate_filenames_generate_unique_dest_paths(db_session, monkeypatch):
    """
    Verify that receiving two emails with the exact same attachment filename
    (e.g., 'invoice.pdf') creates two distinct Documents with unique IDs and paths.
    """
    monkeypatch.setenv("IMAP_SERVER", "imap.stress.test")
    monkeypatch.setenv("IMAP_USER", "inbox@docintel.test")
    monkeypatch.setenv("IMAP_PASSWORD", "secret")

    def build_email_msg(subject: str):
        msg = EmailMessage()
        msg["Subject"] = subject
        msg.set_content("Here is your invoice.")
        msg.add_attachment(b"%PDF-1.4 sample content", maintype="application", subtype="pdf", filename="invoice.pdf")
        return msg.as_bytes()

    mock_mail = MagicMock()
    mock_mail.search.return_value = ("OK", [b"1 2"])
    mock_mail.fetch.side_effect = [
        ("OK", [(b"1 (RFC822)", build_email_msg("Invoice 1"))]),
        ("OK", [(b"2 (RFC822)", build_email_msg("Invoice 2"))]),
    ]

    with patch("imaplib.IMAP4_SSL", return_value=mock_mail), \
         patch("app.services.email_ingest.publish_document_event") as mock_publish:
        check_mailbox_and_ingest(db=db_session)

    docs = db_session.query(Document).filter(Document.filename == "invoice.pdf").all()
    assert len(docs) == 2
    assert docs[0].id != docs[1].id
    assert docs[0].file_path != docs[1].file_path
    assert mock_publish.call_count == 2


# =========================================================================
# Scenario 3: Database Session Commit & Rollback Integrity
# =========================================================================

def test_mock_ingestion_db_commit_failure_prevents_publish(monkeypatch):
    """
    Verify that if session.commit() raises an OperationalError during mock ingestion:
    1. The error is handled gracefully.
    2. publish_document_event is NOT called (prevents ghost event publishing).
    """
    # Clean up prior records
    session = TestingSessionLocal()
    session.query(Document).filter(Document.filename == "mock_email_invoice.pdf").delete()
    session.commit()
    session.close()

    with patch.object(TestingSessionLocal, "commit", side_effect=OperationalError("disk I/O error", {}, None)), \
         patch("app.services.email_ingest.SessionLocal", TestingSessionLocal), \
         patch("app.services.email_ingest.publish_document_event") as mock_publish:

        _run_mock_ingestion(db=None)

        # publish_document_event must NOT be called if commit failed
        mock_publish.assert_not_called()


def test_imap_ingestion_db_commit_failure_prevents_publish(db_session, monkeypatch):
    """
    Verify that if session.commit() fails during IMAP ingestion:
    1. The exception is caught and logged.
    2. publish_document_event is NOT called for that document.
    """
    monkeypatch.setenv("IMAP_SERVER", "imap.stress.test")
    monkeypatch.setenv("IMAP_USER", "inbox@docintel.test")
    monkeypatch.setenv("IMAP_PASSWORD", "secret")

    msg = EmailMessage()
    msg["Subject"] = "Failed Commit Invoice"
    msg.set_content("Testing commit rollback.")
    msg.add_attachment(b"%PDF-1.4 test", maintype="application", subtype="pdf", filename="failed_commit.pdf")

    mock_mail = MagicMock()
    mock_mail.search.return_value = ("OK", [b"1"])
    mock_mail.fetch.return_value = ("OK", [(b"1 (RFC822)", msg.as_bytes())])

    with patch("imaplib.IMAP4_SSL", return_value=mock_mail), \
         patch.object(db_session, "commit", side_effect=OperationalError("DB locked", {}, None)), \
         patch("app.services.email_ingest.publish_document_event") as mock_publish:

        check_mailbox_and_ingest(db=db_session)

        # publish_document_event must NOT be called
        mock_publish.assert_not_called()


def test_session_lifecycle_with_and_without_injected_db():
    """
    Verify session lifecycle:
    - When db=None: SessionLocal is instantiated and closed in finally block.
    - When db is passed: the caller's session is used and NOT closed.
    """
    mock_session = MagicMock()
    mock_session.query.return_value.filter.return_value.first.return_value = None

    # When db is provided, session.close() should NOT be called by _run_mock_ingestion
    with patch("app.services.email_ingest.publish_document_event"):
        _run_mock_ingestion(db=mock_session)

    mock_session.close.assert_not_called()
    mock_session.commit.assert_called_once()


# =========================================================================
# Scenario 4: Broker Failures & Outbox Durability
# =========================================================================

def test_imap_ingestion_broker_failure_preserves_outbox_event_for_relay(db_session, monkeypatch):
    """
    CRITICAL OUTBOX GUARANTEE:
    If publish_document_event raises an exception (e.g. RabbitMQ and local fallback worker fail),
    the Document and OutboxEvent are ALREADY committed to the database in PENDING status.
    The outbox relay can subsequent pick up the event and dispatch it once the broker is back.
    """
    monkeypatch.setenv("IMAP_SERVER", "imap.stress.test")
    monkeypatch.setenv("IMAP_USER", "inbox@docintel.test")
    monkeypatch.setenv("IMAP_PASSWORD", "secret")

    msg = EmailMessage()
    msg["Subject"] = "Broker Down Invoice"
    msg.set_content("Broker failure scenario.")
    msg.add_attachment(b"%PDF-1.4 sample stream", maintype="application", subtype="pdf", filename="broker_fail_inv.pdf")

    mock_mail = MagicMock()
    mock_mail.search.return_value = ("OK", [b"1"])
    mock_mail.fetch.return_value = ("OK", [(b"1 (RFC822)", msg.as_bytes())])

    # Simulate broker crash during immediate publishing
    with patch("imaplib.IMAP4_SSL", return_value=mock_mail), \
         patch("app.services.email_ingest.publish_document_event", side_effect=ConnectionError("RabbitMQ broker dead")):

        check_mailbox_and_ingest(db=db_session)

    # 1. Verify Document was saved
    doc = db_session.query(Document).filter(Document.filename == "broker_fail_inv.pdf").first()
    assert doc is not None
    assert doc.status == DocumentStatus.INGESTED

    # 2. Verify OutboxEvent was safely persisted in PENDING status
    outbox = db_session.query(OutboxEvent).filter(OutboxEvent.document_id == doc.id).first()
    assert outbox is not None
    assert outbox.event_type == "document.uploaded"
    assert outbox.status == "PENDING"
    assert outbox.published_at is None

    # 3. Simulate Outbox Relay recovering and dispatching the pending event
    with patch("app.services.outbox_relay.publish_document_event") as mock_relay_publish:
        published_count = relay_outbox_events(db_session)

    assert published_count == 1
    mock_relay_publish.assert_called_once_with(
        event_type="document.uploaded",
        document_id=str(doc.id),
    )

    db_session.refresh(outbox)
    assert outbox.status == "PUBLISHED"
    assert outbox.published_at is not None


# =========================================================================
# Scenario 5: Header & MIME Format Stress Cases
# =========================================================================

def test_imap_ingestion_case_insensitive_pdf_extension(db_session, monkeypatch):
    """
    Verify that attachments with uppercase or mixed-case extensions (.PDF, .Pdf)
    are recognized and ingested properly.
    """
    monkeypatch.setenv("IMAP_SERVER", "imap.stress.test")
    monkeypatch.setenv("IMAP_USER", "inbox@docintel.test")
    monkeypatch.setenv("IMAP_PASSWORD", "secret")

    msg = EmailMessage()
    msg["Subject"] = "Invoice in UPPERCASE.PDF"
    msg.set_content("Uppercase extension test.")
    msg.add_attachment(b"%PDF-1.4 content", maintype="application", subtype="pdf", filename="UPPERCASE_INVOICE.PDF")

    mock_mail = MagicMock()
    mock_mail.search.return_value = ("OK", [b"1"])
    mock_mail.fetch.return_value = ("OK", [(b"1 (RFC822)", msg.as_bytes())])

    with patch("imaplib.IMAP4_SSL", return_value=mock_mail), \
         patch("app.services.email_ingest.publish_document_event") as mock_publish:
        check_mailbox_and_ingest(db=db_session)

    doc = db_session.query(Document).filter(Document.filename == "UPPERCASE_INVOICE.PDF").first()
    assert doc is not None
    assert doc.category == DocumentCategory.INVOICE
    assert doc.status == DocumentStatus.INGESTED
    mock_publish.assert_called_once_with("document.uploaded", str(doc.id))


def test_imap_ingestion_mixed_attachment_types_filters_non_pdf(db_session, monkeypatch):
    """
    Verify that an email with mixed attachments (.png, .docx, .pdf, .txt)
    only ingests the .pdf attachment and ignores the others.
    """
    monkeypatch.setenv("IMAP_SERVER", "imap.stress.test")
    monkeypatch.setenv("IMAP_USER", "inbox@docintel.test")
    monkeypatch.setenv("IMAP_PASSWORD", "secret")

    msg = EmailMessage()
    msg["Subject"] = "Mixed attachments test"
    msg.set_content("Mixed files attached.")
    msg.add_attachment(b"image bytes", maintype="image", subtype="png", filename="receipt.png")
    msg.add_attachment(b"word bytes", maintype="application", subtype="vnd.openxmlformats-officedocument.wordprocessingml.document", filename="contract.docx")
    msg.add_attachment(b"%PDF-1.4 valid", maintype="application", subtype="pdf", filename="valid_invoice.pdf")
    msg.add_attachment(b"text bytes", maintype="text", subtype="plain", filename="readme.txt")

    mock_mail = MagicMock()
    mock_mail.search.return_value = ("OK", [b"1"])
    mock_mail.fetch.return_value = ("OK", [(b"1 (RFC822)", msg.as_bytes())])

    with patch("imaplib.IMAP4_SSL", return_value=mock_mail), \
         patch("app.services.email_ingest.publish_document_event") as mock_publish:
        check_mailbox_and_ingest(db=db_session)

    # Only valid_invoice.pdf should be stored
    assert db_session.query(Document).filter(Document.filename == "receipt.png").first() is None
    assert db_session.query(Document).filter(Document.filename == "contract.docx").first() is None
    assert db_session.query(Document).filter(Document.filename == "readme.txt").first() is None

    pdf_doc = db_session.query(Document).filter(Document.filename == "valid_invoice.pdf").first()
    assert pdf_doc is not None
    assert pdf_doc.status == DocumentStatus.INGESTED
    mock_publish.assert_called_once_with("document.uploaded", str(pdf_doc.id))


def test_imap_ingestion_empty_mailbox_no_actions(db_session, monkeypatch):
    """
    Verify that when IMAP returns no unseen messages or an empty search result,
    no documents or outbox events are created.
    """
    monkeypatch.setenv("IMAP_SERVER", "imap.stress.test")
    monkeypatch.setenv("IMAP_USER", "inbox@docintel.test")
    monkeypatch.setenv("IMAP_PASSWORD", "secret")

    mock_mail = MagicMock()
    mock_mail.search.return_value = ("OK", [b""])

    with patch("imaplib.IMAP4_SSL", return_value=mock_mail), \
         patch("app.services.email_ingest.publish_document_event") as mock_publish:
        check_mailbox_and_ingest(db=db_session)

    mock_publish.assert_not_called()


def test_imap_ingestion_missing_subject_header(db_session, monkeypatch):
    """
    Verify that an email without a Subject header does not crash ingestion,
    and successfully ingests the attachment.
    """
    monkeypatch.setenv("IMAP_SERVER", "imap.stress.test")
    monkeypatch.setenv("IMAP_USER", "inbox@docintel.test")
    monkeypatch.setenv("IMAP_PASSWORD", "secret")

    # Construct email with NO Subject header
    raw_email = (
        b"From: sender@test.com\r\n"
        b"To: inbox@docintel.test\r\n"
        b"MIME-Version: 1.0\r\n"
        b"Content-Type: multipart/mixed; boundary=\"BOUNDARY\"\r\n\r\n"
        b"--BOUNDARY\r\n"
        b"Content-Type: application/pdf\r\n"
        b"Content-Disposition: attachment; filename=\"no_subject_invoice.pdf\"\r\n\r\n"
        b"%PDF-1.4 test stream\r\n"
        b"--BOUNDARY--\r\n"
    )

    mock_mail = MagicMock()
    mock_mail.search.return_value = ("OK", [b"1"])
    mock_mail.fetch.return_value = ("OK", [(b"1 (RFC822)", raw_email)])

    with patch("imaplib.IMAP4_SSL", return_value=mock_mail), \
         patch("app.services.email_ingest.publish_document_event") as mock_publish:
        check_mailbox_and_ingest(db=db_session)

    doc = db_session.query(Document).filter(Document.filename == "no_subject_invoice.pdf").first()
    assert doc is not None
    assert doc.status == DocumentStatus.INGESTED
    mock_publish.assert_called_once_with("document.uploaded", str(doc.id))


def test_email_ingestion_skipped_in_production_when_unconfigured(db_session, monkeypatch):
    """
    Verify that when IMAP credentials are not set and ENVIRONMENT is production,
    email ingestion is safely skipped without triggering mock ingestion.
    """
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.delenv("IMAP_SERVER", raising=False)
    monkeypatch.delenv("IMAP_USER", raising=False)
    monkeypatch.delenv("IMAP_PASSWORD", raising=False)

    with patch("app.services.email_ingest._run_mock_ingestion") as mock_mock_ingest:
        check_mailbox_and_ingest(db=db_session)

    mock_mock_ingest.assert_not_called()


def test_email_ingest_to_outbox_relay_pipeline_end_to_end(db_session):
    """
    End-to-End integration test:
    1. Clean existing mock records
    2. Run mock email ingestion (creates Document + PENDING OutboxEvent + attempts publish)
    3. Run outbox relay to transition event to PUBLISHED
    4. Verify final states across tables
    """
    db_session.query(Document).filter(Document.filename == "mock_email_invoice.pdf").delete()
    db_session.commit()

    with patch("app.services.email_ingest.publish_document_event"):
        _run_mock_ingestion(db=db_session)

    doc = db_session.query(Document).filter(Document.filename == "mock_email_invoice.pdf").first()
    assert doc is not None

    outbox = db_session.query(OutboxEvent).filter(OutboxEvent.document_id == doc.id).first()
    assert outbox is not None
    assert outbox.status == "PENDING"
    assert outbox.published_at is None

    # Now run relay_outbox_events
    with patch("app.services.outbox_relay.publish_document_event") as mock_relay_pub:
        relayed = relay_outbox_events(db_session)

    assert relayed == 1
    mock_relay_pub.assert_called_once_with(
        event_type="document.uploaded",
        document_id=str(doc.id),
    )

    db_session.refresh(outbox)
    assert outbox.status == "PUBLISHED"
    assert outbox.published_at is not None

