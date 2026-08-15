import pytest
from unittest.mock import patch, MagicMock
from app.models.webhook import WebhookConfig
from app.services.webhook import dispatch_webhook

def test_webhook_config_creation():
    config = WebhookConfig(
        url="https://example.com/webhook",
        event_type="document.processed",
        is_active=True
    )
    assert config.url == "https://example.com/webhook"
    assert config.event_type == "document.processed"
    assert config.is_active is True

@patch("app.services.webhook.SessionLocal")
@patch("pika.BlockingConnection")
def test_dispatch_webhook_no_subs(mock_pika, mock_session_local):
    mock_db = MagicMock()
    mock_session_local.return_value = mock_db
    mock_db.query.return_value.filter.return_value.all.return_value = []

    dispatch_webhook("document.processed", {"id": "123"})
    
    mock_db.query.assert_called_once()
    mock_pika.assert_not_called()

@patch("app.services.webhook.SessionLocal")
@patch("pika.BlockingConnection")
def test_dispatch_webhook_with_subs(mock_pika, mock_session_local):
    mock_db = MagicMock()
    mock_session_local.return_value = mock_db
    
    sub = WebhookConfig(url="https://example.com/hook", event_type="document.processed", is_active=True)
    mock_db.query.return_value.filter.return_value.all.return_value = [sub]
    
    mock_conn = MagicMock()
    mock_channel = MagicMock()
    mock_conn.channel.return_value = mock_channel
    mock_pika.return_value = mock_conn

    dispatch_webhook("document.processed", {"id": "123"})
    
    mock_channel.basic_publish.assert_called_once()
