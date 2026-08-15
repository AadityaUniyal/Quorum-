"""
Rate limiter singleton — imported by main.py and route modules.
Uses Redis backend storage when available, with graceful fallback to in-memory storage.
"""
import logging

from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import settings

logger = logging.getLogger("app.limiter")


def _init_limiter() -> Limiter:
    redis_url = settings.REDIS_URL
    if redis_url:
        try:
            import redis
            # Test connectivity to Redis with short socket connect timeout
            r = redis.Redis.from_url(redis_url, socket_connect_timeout=1.5)
            r.ping()
            logger.info(
                f"Initialized SlowAPI Limiter with Redis storage backend: {settings.REDIS_HOST}:{settings.REDIS_PORT}"
            )
            return Limiter(key_func=get_remote_address, storage_uri=redis_url)
        except Exception as err:
            logger.warning(
                f"Could not connect to Redis at {redis_url} ({err}). Falling back to in-memory rate limiting."
            )
    return Limiter(key_func=get_remote_address)


limiter = _init_limiter()
