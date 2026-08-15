import json
import threading
from unittest.mock import MagicMock, patch
import pika
import pytest
from fastapi import status

from app.main import app
from app.models.auth import User, UserRole
from app.routes.auth import get_current_user
from app.services.queue import (
    CRAWL_QUEUE,
    DLQ_QUEUE,
    DLX_EXCHANGE,
    publish_crawl_task,
    register_local_crawl_worker_callback,
)
from app.worker import MAX_RETRIES, on_crawl_message_callback, process_crawl_task


# Mock user factories
def mock_admin_user():
    return User(id="admin-1", email="admin@docintel.ai", role=UserRole.ADMIN)

def mock_operator_user():
    return User(id="op-1", email="operator@docintel.ai", role=UserRole.OPERATOR)

def mock_reviewer_user():
    return User(id="rev-1", email="reviewer@docintel.ai", role=UserRole.REVIEWER)

def mock_viewer_user():
    return User(id="view-1", email="viewer@docintel.ai", role=UserRole.VIEWER)


# ============================================================================
# 1. RabbitMQ Disconnection & Thread Fallback Stress Tests
# ============================================================================

@patch("app.services.queue.get_rabbitmq_connection")
def test_publish_crawl_task_rabbitmq_disconnection_fallback(mock_get_conn):
    """
    Stress test publish_crawl_task under simulated RabbitMQ disconnection.
    Verifies that AMQPConnectionError triggers thread fallback with correct arguments.
    """
    mock_get_conn.side_effect = pika.exceptions.AMQPConnectionError("RabbitMQ node down")

    mock_callback = MagicMock()
    register_local_crawl_worker_callback(mock_callback)

    with patch("threading.Thread") as mock_thread_cls:
        mock_thread_instance = MagicMock()
        mock_thread_cls.return_value = mock_thread_instance

        publish_crawl_task("https://fallback-test.com/page", max_depth=4)

        mock_thread_cls.assert_called_once()
        call_kwargs = mock_thread_cls.call_args[1]
        assert call_kwargs["target"] == mock_callback
        assert call_kwargs["args"] == ("https://fallback-test.com/page", 4)
        assert call_kwargs["daemon"] is True
        mock_thread_instance.start.assert_called_once()


@patch("app.services.queue.get_rabbitmq_connection")
def test_publish_crawl_task_disconnection_with_generic_exception(mock_get_conn):
    """
    Verifies thread fallback when get_rabbitmq_connection raises any arbitrary Exception.
    """
    mock_get_conn.side_effect = RuntimeError("Socket timeout")

    with patch("threading.Thread") as mock_thread_cls:
        mock_thread_instance = MagicMock()
        mock_thread_cls.return_value = mock_thread_instance

        publish_crawl_task("https://generic-fail.com", max_depth=1)

        mock_thread_cls.assert_called_once()
        mock_thread_instance.start.assert_called_once()


# ============================================================================
# 2. Worker Callback Payload Corruption, Exceptions & DLQ Stress Tests
# ============================================================================

@patch("app.worker._republish_with_backoff")
@patch("app.worker.process_crawl_task")
def test_on_crawl_message_callback_corrupted_json(mock_process, mock_republish):
    """
    Stress test on_crawl_message_callback with corrupted JSON payload.
    Verifies message ACK and retry republishing under retry threshold.
    """
    mock_ch = MagicMock()
    mock_method = MagicMock()
    mock_method.delivery_tag = 101
    mock_props = MagicMock()
    mock_props.headers = {"x-retry-count": 0}
    body = b"{corrupted_json: true,"

    on_crawl_message_callback(mock_ch, mock_method, mock_props, body)

    mock_process.assert_not_called()
    mock_ch.basic_ack.assert_called_once_with(delivery_tag=101)
    mock_republish.assert_called_once_with(mock_ch, body, mock_props, 0, queue_name=CRAWL_QUEUE)


@patch("app.worker.process_crawl_task")
def test_on_crawl_message_callback_corrupted_json_dlq_routing(mock_process):
    """
    Stress test on_crawl_message_callback with corrupted JSON payload when MAX_RETRIES reached.
    Verifies message ACK and DLQ routing.
    """
    mock_ch = MagicMock()
    mock_method = MagicMock()
    mock_method.delivery_tag = 102
    mock_props = MagicMock()
    mock_props.headers = {"x-retry-count": MAX_RETRIES}
    body = b"{{BAD_JSON}}"

    on_crawl_message_callback(mock_ch, mock_method, mock_props, body)

    mock_process.assert_not_called()
    mock_ch.basic_ack.assert_called_once_with(delivery_tag=102)
    mock_ch.basic_publish.assert_called_once()
    publish_args = mock_ch.basic_publish.call_args[1]
    assert publish_args["exchange"] == DLX_EXCHANGE
    assert publish_args["routing_key"] == DLQ_QUEUE
    assert publish_args["body"] == body


@patch("app.worker.process_crawl_task")
def test_on_crawl_message_callback_missing_url_field(mock_process):
    """
    Stress test on_crawl_message_callback with missing URL field.
    Verifies payload parsing handles missing URL gracefully, does not invoke process_crawl_task, and ACKs message.
    """
    mock_ch = MagicMock()
    mock_method = MagicMock()
    mock_method.delivery_tag = 103
    mock_props = MagicMock()
    mock_props.headers = {"x-retry-count": 0}
    body = json.dumps({"max_depth": 5}).encode()

    on_crawl_message_callback(mock_ch, mock_method, mock_props, body)

    mock_process.assert_not_called()
    mock_ch.basic_ack.assert_called_once_with(delivery_tag=103)


@patch("app.worker.process_crawl_task")
def test_on_crawl_message_callback_missing_max_depth_field(mock_process):
    """
    Stress test on_crawl_message_callback with missing max_depth field.
    Verifies that max_depth defaults to 2.
    """
    mock_ch = MagicMock()
    mock_method = MagicMock()
    mock_method.delivery_tag = 104
    mock_props = MagicMock()
    mock_props.headers = {"x-retry-count": 0}
    body = json.dumps({"url": "https://default-depth.com"}).encode()

    on_crawl_message_callback(mock_ch, mock_method, mock_props, body)

    mock_process.assert_called_once_with("https://default-depth.com", max_depth=2)
    mock_ch.basic_ack.assert_called_once_with(delivery_tag=104)


@patch("app.worker._republish_with_backoff")
@patch("app.worker.process_crawl_task")
def test_on_crawl_message_callback_worker_exception_retry(mock_process, mock_republish):
    """
    Stress test simulated worker exception during process_crawl_task execution.
    Verifies message ACK and exponential backoff republish call.
    """
    mock_process.side_effect = TimeoutError("HTTP Crawl timeout")

    mock_ch = MagicMock()
    mock_method = MagicMock()
    mock_method.delivery_tag = 105
    mock_props = MagicMock()
    mock_props.headers = {"x-retry-count": 1}
    body = json.dumps({"url": "https://timeout.com", "max_depth": 2}).encode()

    on_crawl_message_callback(mock_ch, mock_method, mock_props, body)

    mock_process.assert_called_once_with("https://timeout.com", max_depth=2)
    mock_ch.basic_ack.assert_called_once_with(delivery_tag=105)
    mock_republish.assert_called_once_with(mock_ch, body, mock_props, 1, queue_name=CRAWL_QUEUE)


@patch("app.worker.process_crawl_task")
def test_on_crawl_message_callback_worker_exception_dlq_exhausted(mock_process):
    """
    Stress test simulated worker exception when retries are exhausted (retry count >= MAX_RETRIES).
    Verifies message ACK and routing to DLQ.
    """
    mock_process.side_effect = ConnectionRefusedError("Target host unreachable")

    mock_ch = MagicMock()
    mock_method = MagicMock()
    mock_method.delivery_tag = 106
    mock_props = MagicMock()
    mock_props.headers = {"x-retry-count": 3}
    body = json.dumps({"url": "https://unreachable.com", "max_depth": 2}).encode()

    on_crawl_message_callback(mock_ch, mock_method, mock_props, body)

    mock_process.assert_called_once_with("https://unreachable.com", max_depth=2)
    mock_ch.basic_ack.assert_called_once_with(delivery_tag=106)
    mock_ch.basic_publish.assert_called_once()
    publish_args = mock_ch.basic_publish.call_args[1]
    assert publish_args["exchange"] == DLX_EXCHANGE
    assert publish_args["routing_key"] == DLQ_QUEUE
    assert publish_args["body"] == body


# ============================================================================
# 3. POST /api/crawl Authorization, Scheme & Payload Stress Tests
# ============================================================================

def test_post_crawl_unauthorized_roles(client):
    """
    Stress test POST /api/crawl with forbidden user roles (VIEWER, REVIEWER).
    Verifies 403 Forbidden is returned for both.
    """
    # Test VIEWER
    app.dependency_overrides[get_current_user] = mock_viewer_user
    try:
        res_viewer = client.post("/api/crawl", json={"url": "https://example.com"})
        assert res_viewer.status_code == status.HTTP_403_FORBIDDEN
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    # Test REVIEWER
    app.dependency_overrides[get_current_user] = mock_reviewer_user
    try:
        res_reviewer = client.post("/api/crawl", json={"url": "https://example.com"})
        assert res_reviewer.status_code == status.HTTP_403_FORBIDDEN
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_post_crawl_missing_payload_fields(client):
    """
    Stress test POST /api/crawl with missing required field 'url'.
    Verifies 422 Unprocessable Entity.
    """
    app.dependency_overrides[get_current_user] = mock_admin_user
    try:
        response = client.post("/api/crawl", json={"max_depth": 3})
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.parametrize("invalid_url", [
    "ftp://ftp.example.com/files",
    "file:///etc/passwd",
    "gopher://gopher.example.com",
    "javascript:alert(1)",
    "data:text/html,hello",
    "example.com/no-scheme",
])
def test_post_crawl_invalid_url_schemes(client, invalid_url):
    """
    Stress test POST /api/crawl with various non-http/https URL schemes.
    Verifies 400 Bad Request with scheme validation error detail.
    """
    app.dependency_overrides[get_current_user] = mock_admin_user
    try:
        response = client.post("/api/crawl", json={"url": invalid_url})
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "URL must start with http:// or https://" in response.json()["detail"]
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@patch("app.routes.crawl.publish_crawl_task")
def test_post_crawl_valid_schemes_http_and_https(mock_publish, client):
    """
    Verifies that both http:// and https:// URLs are accepted by POST /api/crawl.
    """
    app.dependency_overrides[get_current_user] = mock_operator_user
    try:
        res_http = client.post("/api/crawl", json={"url": "http://http-site.org"})
        assert res_http.status_code == status.HTTP_200_OK
        assert res_http.json()["status"] == "queued"

        res_https = client.post("/api/crawl", json={"url": "https://https-site.org"})
        assert res_https.status_code == status.HTTP_200_OK
        assert res_https.json()["status"] == "queued"
    finally:
        app.dependency_overrides.pop(get_current_user, None)
