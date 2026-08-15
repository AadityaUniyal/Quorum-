import json
from unittest.mock import MagicMock, patch
import pika
import pytest

from app.services.queue import CRAWL_QUEUE, publish_crawl_task, register_local_crawl_worker_callback


@patch("app.services.queue.get_rabbitmq_connection")
def test_publish_crawl_task_success(mock_get_conn):
    mock_conn = MagicMock()
    mock_channel = MagicMock()
    mock_get_conn.return_value = mock_conn
    mock_conn.channel.return_value = mock_channel

    url = "https://example.com/test-seed"
    max_depth = 3

    publish_crawl_task(url=url, max_depth=max_depth)

    # Verify connection and channel creation
    mock_get_conn.assert_called_once()
    mock_conn.channel.assert_called_once()

    # Verify queue declaration for CRAWL_QUEUE
    mock_channel.queue_declare.assert_called_once_with(
        queue=CRAWL_QUEUE,
        durable=True,
        arguments={
            "x-dead-letter-exchange": "document_dlx",
            "x-dead-letter-routing-key": "document_processing_dlq",
            "x-message-ttl": 86400000,
        },
    )

    # Verify basic_publish call
    mock_channel.basic_publish.assert_called_once()
    call_args = mock_channel.basic_publish.call_args[1]
    assert call_args["routing_key"] == CRAWL_QUEUE
    payload = json.loads(call_args["body"])
    assert payload == {"url": url, "max_depth": max_depth}
    assert call_args["properties"].delivery_mode == 2
    assert call_args["properties"].headers == {"x-retry-count": 0}

    mock_conn.close.assert_called_once()


@patch("app.services.queue.get_rabbitmq_connection")
def test_publish_crawl_task_fallback(mock_get_conn):
    # Simulate RabbitMQ connection failure
    mock_get_conn.side_effect = pika.exceptions.AMQPConnectionError("Connection refused")

    fallback_called = False
    captured_args = ()

    def mock_callback(url, max_depth):
        nonlocal fallback_called, captured_args
        fallback_called = True
        captured_args = (url, max_depth)

    register_local_crawl_worker_callback(mock_callback)

    with patch("threading.Thread") as mock_thread_cls:
        mock_thread_instance = MagicMock()
        mock_thread_cls.return_value = mock_thread_instance

        publish_crawl_task("https://fallback-example.com", max_depth=2)

        mock_thread_cls.assert_called_once()
        target_fn = mock_thread_cls.call_args[1]["target"]
        args = mock_thread_cls.call_args[1]["args"]

        assert args == ("https://fallback-example.com", 2)
        mock_thread_instance.start.assert_called_once()
