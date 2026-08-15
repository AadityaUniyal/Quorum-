import logging

from app.database import SessionLocal
from app.models.webhook import WebhookConfig

logger = logging.getLogger(__name__)

def _send_webhook_request_sync(webhook_config_id: str, url: str, event_type: str, payload: dict, idempotency_key: str, attempt: int) -> bool:
    """
    Performs a synchronous POST for the webhook, logging it in the database.
    Returns True if successfully delivered, False otherwise.
    """
    import uuid

    import httpx

    from app.models.webhook import WebhookLog

    db = SessionLocal()
    try:
        log_entry = db.query(WebhookLog).filter(
            WebhookLog.idempotency_key == idempotency_key,
            WebhookLog.url == url
        ).first()

        if not log_entry:
            log_entry = WebhookLog(
                webhook_config_id=uuid.UUID(webhook_config_id) if webhook_config_id else None,
                url=url,
                event_type=event_type,
                idempotency_key=idempotency_key,
                status="PENDING",
                attempt_count=attempt
            )
            db.add(log_entry)
        else:
            log_entry.attempt_count = attempt

        db.commit()
        db.refresh(log_entry)

        try:
            resp = httpx.post(
                url,
                json={
                    "event": event_type,
                    "payload": payload
                },
                headers={
                    "Content-Type": "application/json",
                    "User-Agent": "GoogiWebhookStudio/1.0",
                    "X-Googi-Event-ID": idempotency_key
                },
                timeout=5.0
            )
            if resp.status_code < 300:
                logger.info(f"Webhook successfully dispatched to {url} (attempt {attempt})")
                log_entry.status = "DELIVERED"
                log_entry.error_message = None
                db.commit()
                return True
            else:
                err_msg = f"Non-success status code: {resp.status_code}"
                logger.warning(f"Webhook to {url} returned non-success status: {resp.status_code}")
                log_entry.status = "FAILED"
                log_entry.error_message = err_msg
                db.commit()
                return False
        except Exception as e:
            err_msg = str(e)
            logger.error(f"Failed to dispatch webhook to {url} (attempt {attempt}): {err_msg}")
            log_entry.status = "FAILED"
            log_entry.error_message = err_msg
            db.commit()
            return False
    finally:
        db.close()

def dispatch_webhook(event_type: str, payload: dict):
    """
    Query all active webhook subscriptions for this event_type
    and publish them to the webhook_queue in RabbitMQ.
    """
    import json
    import uuid

    import pika

    from app.config import settings

    db = SessionLocal()
    try:
        subscriptions = (
            db.query(WebhookConfig)
            .filter(WebhookConfig.event_type == event_type, WebhookConfig.is_active)
            .all()
        )
        if not subscriptions:
            return

        idempotency_key = str(uuid.uuid4())

        credentials = pika.PlainCredentials(settings.RABBITMQ_USER, settings.RABBITMQ_PASS)
        parameters = pika.ConnectionParameters(
            host=settings.RABBITMQ_HOST,
            port=settings.RABBITMQ_PORT,
            credentials=credentials,
            socket_timeout=2
        )
        connection = pika.BlockingConnection(parameters)
        channel = connection.channel()
        channel.queue_declare(queue="webhook_queue", durable=True)

        for sub in subscriptions:
            message_body = {
                "webhook_config_id": str(sub.id),
                "url": sub.url,
                "event_type": event_type,
                "payload": payload,
                "idempotency_key": idempotency_key
            }
            channel.basic_publish(
                exchange="",
                routing_key="webhook_queue",
                body=json.dumps(message_body),
                properties=pika.BasicProperties(
                    delivery_mode=2,
                    headers={"x-retry-count": 0}
                )
            )
            logger.info(f"Published webhook event {event_type} to {sub.url} in RabbitMQ.")

        connection.close()
    except Exception as e:
        logger.error(f"Error publishing webhooks to queue: {e}")
    finally:
        db.close()
