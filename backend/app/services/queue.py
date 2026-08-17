import json
import logging
import threading

import pika

from app.config import settings

logger = logging.getLogger(__name__)

# Registry for synchronous/local worker fallback callbacks
_local_worker_callback = None
_local_crawl_worker_callback = None

# DLX and Queue constants (must match worker.py)
DLX_EXCHANGE = "document_dlx"
DLQ_QUEUE = "document_processing_dlq"
MAIN_QUEUE = "document_processing_queue"
CRAWL_QUEUE = "crawl_queue"

def register_local_worker_callback(callback):
    global _local_worker_callback
    _local_worker_callback = callback

def register_local_crawl_worker_callback(callback):
    global _local_crawl_worker_callback
    _local_crawl_worker_callback = callback

def get_rabbitmq_connection():
    credentials = pika.PlainCredentials(settings.RABBITMQ_USER, settings.RABBITMQ_PASS)
    parameters = pika.ConnectionParameters(
        host=settings.RABBITMQ_HOST,
        port=settings.RABBITMQ_PORT,
        credentials=credentials,
        connection_attempts=1,
        retry_delay=1,
        socket_timeout=2
    )
    return pika.BlockingConnection(parameters)

def publish_document_event(event_type: str, document_id: str):
    payload = {
        "event_type": event_type,
        "document_id": str(document_id)
    }
    message = json.dumps(payload)

    try:
        connection = get_rabbitmq_connection()
        channel = connection.channel()

        # Declare queue with DLX arguments (idempotent, must match worker declaration)
        channel.queue_declare(
            queue=MAIN_QUEUE,
            durable=True,
            arguments={
                "x-dead-letter-exchange": DLX_EXCHANGE,
                "x-dead-letter-routing-key": DLQ_QUEUE,
                "x-message-ttl": 86400000,
            },
        )

        # Publish persistent message with retry metadata headers
        channel.basic_publish(
            exchange="",
            routing_key=MAIN_QUEUE,
            body=message,
            properties=pika.BasicProperties(
                delivery_mode=2,  # Make message persistent
                headers={
                    "x-retry-count": 0,
                },
            )
        )
        connection.close()
        logger.info(f"Published event '{event_type}' for document {document_id} to RabbitMQ")

    except Exception as e:
        logger.warning(
            f"RabbitMQ is unavailable (Connection failed: {str(e)}). "
            f"Falling back to local in-process thread execution for event '{event_type}' on document {document_id}."
        )

        # Trigger local thread worker fallback if registered
        callback = _local_worker_callback
        if not callback:
            try:
                from app.worker import process_document
                callback = process_document
            except Exception as import_err:
                logger.error(f"Failed to import fallback process_document: {import_err}")

        if callback:
            thread = threading.Thread(
                target=callback,
                args=(document_id,),
                daemon=True
            )
            thread.start()
        else:
            logger.error("No local worker callback registered. Event dropped.")

def publish_crawl_task(url: str, max_depth: int = 2):
    """
    Publishes a web crawl task to RabbitMQ CRAWL_QUEUE.
    Falls back to a background thread if RabbitMQ connection fails.
    """
    payload = {
        "url": str(url),
        "max_depth": int(max_depth)
    }
    message = json.dumps(payload)

    try:
        connection = get_rabbitmq_connection()
        channel = connection.channel()

        # Declare queue with DLX arguments (idempotent, must match worker declaration)
        channel.queue_declare(
            queue=CRAWL_QUEUE,
            durable=True,
            arguments={
                "x-dead-letter-exchange": DLX_EXCHANGE,
                "x-dead-letter-routing-key": DLQ_QUEUE,
                "x-message-ttl": 86400000,
            },
        )

        # Publish persistent message with retry metadata headers
        channel.basic_publish(
            exchange="",
            routing_key=CRAWL_QUEUE,
            body=message,
            properties=pika.BasicProperties(
                delivery_mode=2,  # Make message persistent
                headers={
                    "x-retry-count": 0,
                },
            )
        )
        connection.close()
        logger.info(f"Published crawl task for URL '{url}' (max_depth={max_depth}) to RabbitMQ queue '{CRAWL_QUEUE}'")

    except Exception as e:
        logger.warning(
            f"RabbitMQ is unavailable (Connection failed: {str(e)}). "
            f"Falling back to local in-process thread execution for crawl task on URL '{url}'."
        )

        # Trigger local thread worker fallback if registered
        callback = _local_crawl_worker_callback
        if not callback:
            try:
                from app.worker import process_crawl_task
                callback = process_crawl_task
            except Exception as import_err:
                logger.error(f"Failed to import fallback process_crawl_task: {import_err}")

        if callback:
            thread = threading.Thread(
                target=callback,
                args=(url, max_depth),
                daemon=True
            )
            thread.start()
        else:
            logger.error("No local crawl worker callback registered. Crawl task dropped.")
