import pytest
from unittest.mock import patch, MagicMock
from app.services.email_ingest import _run_mock_ingestion, check_mailbox_and_ingest
from app.models.document import Document

@patch("app.services.email_ingest.SessionLocal")
@patch("app.services.email_ingest.open")
@patch("app.services.email_ingest.os.makedirs")
def test_mock_ingestion_registers_document(mock_makedirs, mock_open, mock_session_local):
    mock_db = MagicMock()
    mock_session_local.return_value = mock_db
    
    # Simulate that the document does not exist yet
    mock_db.query.return_value.filter.return_value.first.return_value = None
    
    _run_mock_ingestion()
    
    # Should create and add the mock document
    mock_db.add.assert_called_once()
    mock_db.commit.assert_called_once()
    
    added_doc = mock_db.add.call_args[0][0]
    assert isinstance(added_doc, Document)
    assert added_doc.filename == "mock_email_invoice.pdf"

@patch("app.services.email_ingest.SessionLocal")
@patch("app.services.email_ingest.imaplib.IMAP4_SSL")
def test_check_mailbox_no_credentials_fallback(mock_imap, mock_session_local):
    mock_db = MagicMock()
    mock_session_local.return_value = mock_db
    mock_db.query.return_value.filter.return_value.first.return_value = None
    
    # When IMAP credentials are empty, it should run mock ingestion fallback
    with patch.dict("os.environ", {"IMAP_SERVER": "", "IMAP_USER": "", "IMAP_PASSWORD": ""}):
        check_mailbox_and_ingest()
        mock_imap.assert_not_called()
        mock_db.add.assert_called_once()
