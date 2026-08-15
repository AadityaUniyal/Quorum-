import json
import logging
from collections.abc import Callable
from functools import wraps

import redis
from redis import asyncio as aioredis

from app.config import settings

logger = logging.getLogger(__name__)

# Synchronous Redis client (used for cache decorator, semaphore, etc.)
_redis_client = None

def get_redis_client() -> redis.Redis:
    """Return a singleton synchronous Redis client."""
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            password=settings.REDIS_PASSWORD,
            decode_responses=True,
            socket_connect_timeout=2,
        )
    return _redis_client

# Asynchronous Redis client for general async operations (e.g., SSE reads)
_redis_async_client = None

def get_redis_async_client() -> aioredis.Redis:
    """Return a singleton async Redis client for regular async commands."""
    global _redis_async_client
    if _redis_async_client is None:
        _redis_async_client = aioredis.from_url(
            settings.get_redis_url(),
            decode_responses=True,
        )
    return _redis_async_client

# Dedicated async client for Pub/Sub (subscriber mode only)
_redis_pubsub_client = None

def get_redis_pubsub_client() -> aioredis.Redis:
    """Return a singleton async Redis client dedicated to Pub/Sub.
    This client is kept separate because a connection in subscriber mode
    cannot execute regular Redis commands.
    """
    global _redis_pubsub_client
    if _redis_pubsub_client is None:
        _redis_pubsub_client = aioredis.from_url(
            settings.get_redis_url(),
            decode_responses=True,
        )
    return _redis_pubsub_client

def _serialize(obj) -> str:
    """JSON‑serialize *obj* safely, falling back to ``str`` for unsupported types."""
    try:
        return json.dumps(obj, sort_keys=True, default=str)
    except TypeError:
        return str(obj)

def cache(ttl_seconds: int = 300):
    """Caching decorator for FastAPI route functions.

    The result is cached under a key derived from the function name and the
    JSON‑serialisable arguments. If Redis is unavailable the original function
    is executed and its result is returned un‑cached.
    """
    def decorator(func: Callable):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Build a deterministic cache key while ignoring non‑serialisable
            # dependency‑injected objects.
            try:
                safe_args = [a for a in args if isinstance(a, (str, int, float, bool, type(None)))]
                safe_kwargs = {k: v for k, v in kwargs.items() if isinstance(v, (str, int, float, bool, type(None)))}
                cache_key = (
                    f"cache:{func.__name__}"
                    f":{_serialize(safe_args)}"
                    f":{_serialize(safe_kwargs)}"
                )
            except Exception:
                return func(*args, **kwargs)

            # Attempt to read from Redis
            try:
                client = get_redis_client()
                cached = client.get(cache_key)
                if cached:
                    return json.loads(cached)
            except Exception as exc:
                logger.debug(f"Cache read miss/error for {func.__name__}: {exc}")

            # Execute the wrapped function
            result = func(*args, **kwargs)

            # Write the result back to Redis
            try:
                client = get_redis_client()
                client.setex(cache_key, ttl_seconds, json.dumps(result, default=str))
            except Exception as exc:
                logger.debug(f"Cache write error for {func.__name__}: {exc}")

            return result
        return wrapper
    return decorator

def invalidate_cache_prefix(prefix: str) -> int:
    """Delete all cache keys that start with the supplied *prefix*.
    Returns the number of keys removed.
    """
    try:
        client = get_redis_client()
        keys = client.keys(f"cache:{prefix}*")
        if keys:
            return client.delete(*keys)
    except Exception as exc:
        logger.debug(f"Cache invalidation error for prefix '{prefix}': {exc}")
    return 0

def acquire_redis_semaphore(name: str, limit: int, timeout: int = 180) -> str | None:
    """Acquire a Redis‑backed semaphore.
    Returns a unique ``owner_id`` if the semaphore could be acquired, otherwise ``None``.
    """
    import time
    import uuid
    try:
        client = get_redis_client()
        sem_key = f"semaphore:{name}"
        owner_id = str(uuid.uuid4())
        now = time.time()
        # Clean up stale entries
        client.zremrangebyscore(sem_key, "-inf", now - timeout)
        if client.zcard(sem_key) < limit:
            client.zadd(sem_key, {owner_id: now})
            client.setex(f"semaphore:{name}:{owner_id}:ttl", timeout, "1")
            return owner_id
        return None
    except Exception as exc:
        logger.warning(f"Error acquiring Redis semaphore '{name}': {exc}")
        # Fallback that allows processing to continue when Redis is down
        return f"fallback:{uuid.uuid4()}"

def release_redis_semaphore(name: str, owner_id: str):
    """Release a previously acquired semaphore slot."""
    try:
        client = get_redis_client()
        sem_key = f"semaphore:{name}"
        client.zrem(sem_key, owner_id)
        client.delete(f"semaphore:{name}:{owner_id}:ttl")
    except Exception as exc:
        logger.warning(f"Error releasing Redis semaphore '{name}': {exc}")
