import json
from unittest.mock import MagicMock, patch

from app.worker import CRAWL_QUEUE, on_crawl_message_callback, process_crawl_task


@patch("app.services.crawler.crawl_url_task")
def test_process_crawl_task(mock_crawl_url_task):
    mock_crawl_url_task.return_value = ["https://example.com/page1", "https://example.com/page2"]
    
    process_crawl_task(url="https://example.com", max_depth=2)
    mock_crawl_url_task.assert_called_once()
    assert mock_crawl_url_task.call_args[1]["seed_url"] == "https://example.com"
    assert mock_crawl_url_task.call_args[1]["max_depth"] == 2


@patch("app.worker.process_crawl_task")
def test_on_crawl_message_callback_success(mock_process):
    mock_ch = MagicMock()
    mock_method = MagicMock()
    mock_method.delivery_tag = 42
    mock_props = MagicMock()
    mock_props.headers = {"x-retry-count": 0}
    body = json.dumps({"url": "https://example.com", "max_depth": 3}).encode()

    on_crawl_message_callback(mock_ch, mock_method, mock_props, body)

    mock_process.assert_called_once_with("https://example.com", max_depth=3)
    mock_ch.basic_ack.assert_called_once_with(delivery_tag=42)


@patch("app.worker._republish_with_backoff")
@patch("app.worker.process_crawl_task")
def test_on_crawl_message_callback_retry_on_error(mock_process, mock_republish):
    mock_process.side_effect = RuntimeError("Crawl network failure")
    mock_ch = MagicMock()
    mock_method = MagicMock()
    mock_method.delivery_tag = 100
    mock_props = MagicMock()
    mock_props.headers = {"x-retry-count": 1}
    body = json.dumps({"url": "https://example.com", "max_depth": 2}).encode()

    on_crawl_message_callback(mock_ch, mock_method, mock_props, body)

    mock_ch.basic_ack.assert_called_once_with(delivery_tag=100)
    mock_republish.assert_called_once_with(mock_ch, body, mock_props, 1, queue_name=CRAWL_QUEUE)


@patch("app.worker.process_crawl_task")
def test_on_crawl_message_callback_max_retries_exceeded(mock_process):
    mock_process.side_effect = RuntimeError("Persistent failure")
    mock_ch = MagicMock()
    mock_method = MagicMock()
    mock_method.delivery_tag = 200
    mock_props = MagicMock()
    mock_props.headers = {"x-retry-count": 3}  # MAX_RETRIES reached
    body = json.dumps({"url": "https://example.com", "max_depth": 2}).encode()

    on_crawl_message_callback(mock_ch, mock_method, mock_props, body)

    mock_ch.basic_ack.assert_called_once_with(delivery_tag=200)
    mock_ch.basic_publish.assert_called_once()
    call_kwargs = mock_ch.basic_publish.call_args[1]
    assert call_kwargs["exchange"] == "document_dlx"
    assert call_kwargs["routing_key"] == "document_processing_dlq"
