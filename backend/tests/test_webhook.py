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
@patch("app.services.webhook.asyncio.get_event_loop")
def test_dispatch_webhook_no_subs(mock_get_loop, mock_session_local):
    # Mock db query returning empty list
    mock_db = MagicMock()
    mock_session_local.return_value = mock_db
    mock_db.query.return_value.filter.return_value.all.return_value = []

    dispatch_webhook("document.processed", {"id": "123"})
    
    mock_db.query.assert_called_once()
    mock_get_loop.assert_not_called()

@patch("app.services.webhook.SessionLocal")
@patch("app.services.webhook.asyncio.get_event_loop")
def test_dispatch_webhook_with_subs(mock_get_loop, mock_session_local):
    # Mock db query returning one active subscription
    mock_db = MagicMock()
    mock_session_local.return_value = mock_db
    
    sub = WebhookConfig(url="https://example.com/hook", event_type="document.processed", is_active=True)
    mock_db.query.return_value.filter.return_value.all.return_value = [sub]
    
    mock_loop = MagicMock()
    mock_loop.is_running.return_value = True
    mock_get_loop.return_value = mock_loop

    dispatch_webhook("document.processed", {"id": "123"})
    
    mock_loop.create_task.assert_called_once()
