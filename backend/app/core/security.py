import hashlib
import logging
import uuid
from datetime import UTC, datetime, timedelta

import bcrypt
import jwt
from zxcvbn import zxcvbn

from app.config import settings

logger = logging.getLogger(__name__)

# In-memory token blacklist for development / fallback if Redis is unavailable
_in_memory_blacklist = set()


def get_password_hash(password: str) -> str:
    """Hash password securely using bcrypt with automatic salt generation."""
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain-text password against a bcrypt hash."""
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False


def validate_password_strength(password: str, min_score: int = 3) -> tuple[bool, str]:
    """
    Validates password strength using zxcvbn realistic password strength estimator.
    Score ranges 0 (too guessable) to 4 (very strong).
    """
    if len(password) < 8:
        return False, "Password too weak. Must be at least 8 characters long."

    strength = zxcvbn(password)
    score = strength.get("score", 0)
    if score < min_score:
        feedback = strength.get("feedback", {})
        warning = feedback.get("warning") or "Password too weak."
        suggestions = feedback.get("suggestions", [])
        detail = f"Password too weak: {warning} " + " ".join(suggestions)
        return False, detail.strip()

    return True, "Password meets complexity requirements."


def create_access_token(user, expires_delta: timedelta | None = None, session_id: str | None = None) -> str:
    now = datetime.now(UTC)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    jti = str(uuid.uuid4())
    token_version = getattr(user, "token_version", 1)
    org_id = str(user.organization_id) if getattr(user, "organization_id", None) else None

    to_encode = {
        "sub": str(user.id),
        "email": getattr(user, "email", ""),
        "role": getattr(user.role, "value", str(user.role)) if hasattr(user, "role") else "VIEWER",
        "org_id": org_id,
        "token_version": token_version,
        "session_id": session_id,
        "type": "access",
        "jti": jti,
        "exp": expire,
    }
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt


def create_refresh_token(user, expires_delta: timedelta | None = None, family_id: str | None = None) -> str:
    now = datetime.now(UTC)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    jti = str(uuid.uuid4())
    token_version = getattr(user, "token_version", 1)
    family = family_id or str(uuid.uuid4())

    to_encode = {
        "sub": str(user.id),
        "token_version": token_version,
        "family_id": family,
        "type": "refresh",
        "jti": jti,
        "exp": expire,
    }
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt


def decode_token(token: str) -> dict:
    """
    Decodes and verifies a JWT token.
    Supports JWT key rotation by attempting verification against all configured secrets.
    """
    secrets_to_try = settings.get_all_jwt_secrets()
    last_err = None

    for secret in secrets_to_try:
        try:
            return jwt.decode(
                token,
                secret,
                algorithms=[settings.JWT_ALGORITHM],
                options={"verify_signature": True, "verify_exp": True, "verify_aud": False},
            )
        except jwt.InvalidSignatureError as err:
            last_err = err
            continue
        except jwt.PyJWTError as err:
            raise err

    if last_err:
        raise last_err
    raise jwt.PyJWTError("Token verification failed.")


def hash_token(token: str) -> str:
    """Generates SHA-256 hash of a token for secure database storage."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def blacklist_token(jti: str, ttl_seconds: int = 86400, ttl: int | None = None) -> bool:
    """Blacklist a JWT token using its unique ID (JTI)."""
    effective_ttl = ttl if ttl is not None else ttl_seconds
    try:
        from app.routes.review import get_redis_client
        r = get_redis_client()
        r.set(f"blacklist:{jti}", "revoked", ex=effective_ttl)
        return True
    except Exception:
        _in_memory_blacklist.add(jti)
        return True


def is_token_blacklisted(jti: str) -> bool:
    """Checks if a JWT token ID (JTI) has been blacklisted."""
    try:
        from app.routes.review import get_redis_client
        r = get_redis_client()
        val = r.get(f"blacklist:{jti}")
        return val is not None
    except Exception:
        return jti in _in_memory_blacklist
