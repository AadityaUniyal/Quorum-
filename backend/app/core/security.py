import logging
import uuid
from datetime import datetime, timedelta

import bcrypt
import jwt

from app.config import settings
from app.services.cache import get_redis_client

logger = logging.getLogger(__name__)

_in_memory_blacklist: set[str] = set()


def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user, expires_delta: timedelta | None = None) -> str:
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    jti = str(uuid.uuid4())
    to_encode = {
        "sub": str(user.id),
        "email": getattr(user, "email", ""),
        "role": getattr(user.role, "value", str(user.role)) if hasattr(user, "role") else "VIEWER",
        "type": "access",
        "jti": jti,
        "exp": expire,
    }
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt


def create_refresh_token(user, expires_delta: timedelta | None = None) -> str:
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    jti = str(uuid.uuid4())
    to_encode = {
        "sub": str(user.id),
        "type": "refresh",
        "jti": jti,
        "exp": expire,
    }
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt


def blacklist_token(jti: str, ttl: int) -> None:
    """
    Blacklist a JWT jti in Redis (with TTL in seconds).
    
    WARNING: Falls back gracefully to an in-memory set if Redis is unreachable.
    In multi-replica/multi-instance deployments, this fallback is localized to
    the current process/pod. A token blacklisted on instance A will remain valid 
    on instance B until Redis connectivity is restored.
    """
    if not jti or ttl <= 0:
        return
    try:
        client = get_redis_client()
        client.setex(f"bl:token:{jti}", max(1, int(ttl)), "revoked")
    except Exception as err:
        logger.warning(
            f"Redis unavailable for blacklisting jti '{jti}' ({err}). Using localized in-memory fallback. "
            "Note: This token revocation will NOT propagate to other replicas."
        )
        _in_memory_blacklist.add(jti)


def is_token_blacklisted(jti: str) -> bool:
    """
    Check if a JWT jti is blacklisted in Redis (or in-memory fallback).
    """
    if not jti:
        return False
    if jti in _in_memory_blacklist:
        return True
    try:
        client = get_redis_client()
        return bool(client.exists(f"bl:token:{jti}"))
    except Exception as err:
        logger.warning(
            f"Redis unavailable for checking blacklisted jti '{jti}' ({err}). Using in-memory fallback."
        )
        return jti in _in_memory_blacklist
