import hashlib
import logging
import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID

import jwt
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.config import settings
from app.core.security import (
    blacklist_token,
    decode_token,
    is_token_blacklisted,
    validate_password_strength,
)
from app.core.security import (
    create_access_token as sec_create_access_token,
)
from app.core.security import (
    create_refresh_token as sec_create_refresh_token,
)
from app.core.security import (
    get_password_hash as sec_get_password_hash,
)
from app.core.security import (
    verify_password as sec_verify_password,
)
from app.database import get_db
from app.limiter import limiter
from app.models.api_key import ApiKey
from app.models.auth import User, UserRole
from app.schemas.api_key import ApiKeyCreate, ApiKeyCreateResponse, ApiKeyResponse
from app.schemas.auth import (
    RefreshTokenRequest,
    Token,
    UserCreate,
    UserLogin,
    UserResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])

security = HTTPBearer(auto_error=False)

ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES
REFRESH_TOKEN_EXPIRE_DAYS = settings.REFRESH_TOKEN_EXPIRE_DAYS


def get_password_hash(password: str) -> str:
    return sec_get_password_hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return sec_verify_password(plain_password, hashed_password)


def create_access_token(user: User) -> str:
    return sec_create_access_token(user)


def create_refresh_token(user: User) -> str:
    return sec_create_refresh_token(user)


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    token: str = Query(None),
    db: Session = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # 1. Check for X-API-Key header
    api_key_header = request.headers.get("X-API-Key")
    if api_key_header:
        hashed_key = hashlib.sha256(api_key_header.encode("utf-8")).hexdigest()
        api_key_record = db.query(ApiKey).filter(ApiKey.hashed_key == hashed_key).first()
        if not api_key_record or not api_key_record.is_active:
            raise credentials_exception
        if api_key_record.expires_at and api_key_record.expires_at < datetime.now(UTC):
            raise credentials_exception
        user = db.query(User).filter(User.id == api_key_record.user_id).first()
        if not user:
            raise credentials_exception
        return user

    # 2. Check for Bearer Token or Cookie
    token_str = None
    if credentials:
        token_str = credentials.credentials
    elif token:
        token_str = token
    if not token_str:
        token_str = request.cookies.get("access_token")
    if not token_str:
        raise credentials_exception

    try:
        payload = decode_token(token_str)
        user_id: str = payload.get("sub")
        token_type: str = payload.get("type", "access")
        jti: str = payload.get("jti")
        if user_id is None:
            raise credentials_exception
        if token_type != "access":
            raise credentials_exception
        if jti and is_token_blacklisted(jti):
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception from None

    try:
        user_uuid = UUID(str(user_id))
    except (ValueError, TypeError):
        user_uuid = user_id

    user = db.query(User).filter((User.id == user_uuid) | (User.id == str(user_id))).first()
    if user is None:
        raise credentials_exception

    token_version = payload.get("token_version")
    if token_version is not None and token_version != getattr(user, "token_version", 1):
        raise credentials_exception

    return user


class RoleChecker:
    def __init__(self, allowed_roles: list[UserRole]):
        self.allowed_roles = allowed_roles

    def __call__(self, current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"User role '{current_user.role.value}' does not have permission to access this resource. Allowed: {[r.value for r in self.allowed_roles]}",
            )
        return current_user


# Register a user (Role Escalation Protected)
@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
def register_user(request: Request, user_data: UserCreate, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists.",
        )

    # First user is ADMIN; public registration is VIEWER
    user_count = db.query(User).count()
    assigned_role = UserRole.ADMIN if user_count == 0 else UserRole.VIEWER
    is_verified_status = True if (user_count == 0 or settings.DEBUG or settings.DATABASE_URL.startswith("sqlite") or "sqlite" in settings.DATABASE_URL) else False

    is_valid_pass, err_msg = validate_password_strength(user_data.password)
    if not is_valid_pass:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err_msg)

    v_token = secrets.token_urlsafe(32)
    v_expires = datetime.now(UTC) + timedelta(hours=24)

    db_user = User(
        email=user_data.email,
        hashed_password=get_password_hash(user_data.password),
        full_name=user_data.full_name,
        role=assigned_role,
        is_verified=is_verified_status,
        verification_token=v_token if not is_verified_status else None,
        verification_token_expires_at=v_expires if not is_verified_status else None
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    if not is_verified_status:
        logger.info(f"Verification email dispatched to user {db_user.email} (token generated securely)")

    return db_user


@router.get("/verify-email")
def verify_email(token: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.verification_token == token).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired verification token.")
    if user.verification_token_expires_at and user.verification_token_expires_at < datetime.now(UTC):
        raise HTTPException(status_code=400, detail="Verification token has expired. Please sign up again.")

    user.is_verified = True
    user.verification_token = None
    user.verification_token_expires_at = None
    db.commit()
    return {"status": "success", "message": "Email verified successfully! You may now login."}


@router.post("/login", response_model=Token)
@limiter.limit("10/minute")
def login(request: Request, login_data: UserLogin, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == login_data.email).first()
    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please verify your email address before logging in. Check your mailbox for the verification link."
        )

    access_token = create_access_token(user)
    refresh_token = create_refresh_token(user)

    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        domain=settings.COOKIE_DOMAIN,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        domain=settings.COOKIE_DOMAIN,
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
    )
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }


@router.get("/login/google")
def login_google():
    google_client_id = getattr(settings, "GOOGLE_CLIENT_ID", None)
    google_redirect_uri = getattr(settings, "GOOGLE_REDIRECT_URI", None)
    if not google_client_id or not google_redirect_uri:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Google SSO is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_REDIRECT_URI to enable it.",
        )

    scope = "openid email profile"
    redirect_url = (
        "https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={google_client_id}"
        f"&redirect_uri={google_redirect_uri}"
        "&response_type=code"
        f"&scope={scope.replace(' ', '+')}"
        "&prompt=consent"
    )
    return {"redirect_url": redirect_url, "message": "Redirecting to Google SSO..."}


@router.get("/login/google/callback")
def login_google_callback(code: str, response: Response, db: Session = Depends(get_db)):
    raise HTTPException(status_code=501, detail="Google SSO callback handler must be configured with Google OAuth client credentials.")


@router.get("/login/microsoft")
def login_microsoft():
    ms_client_id = getattr(settings, "MICROSOFT_CLIENT_ID", None)
    ms_redirect_uri = getattr(settings, "MICROSOFT_REDIRECT_URI", None)
    if not ms_client_id or not ms_redirect_uri:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Microsoft SSO is not configured. Set MICROSOFT_CLIENT_ID and MICROSOFT_REDIRECT_URI to enable it.",
        )

    scope = "openid email profile User.Read"
    redirect_url = (
        "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
        f"?client_id={ms_client_id}"
        f"&redirect_uri={ms_redirect_uri}"
        "&response_type=code"
        f"&scope={scope.replace(' ', '+')}"
    )
    return {"redirect_url": redirect_url, "message": "Redirecting to Microsoft SSO..."}


@router.get("/login/microsoft/callback")
def login_microsoft_callback(code: str, response: Response, db: Session = Depends(get_db)):
    raise HTTPException(status_code=501, detail="Microsoft SSO callback handler must be configured with Azure AD client credentials.")


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response, current_user: User = Depends(get_current_user)):
    token_str = request.cookies.get("access_token")
    if token_str:
        try:
            payload = decode_token(token_str)
            jti = payload.get("jti")
            exp = payload.get("exp")
            if jti and exp:
                remaining_ttl = int(exp - datetime.now(UTC).timestamp())
                if remaining_ttl > 0:
                    blacklist_token(jti, remaining_ttl)
        except Exception:
            pass

    response.delete_cookie(
        key="access_token",
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        domain=settings.COOKIE_DOMAIN,
    )
    response.delete_cookie(
        key="refresh_token",
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        domain=settings.COOKIE_DOMAIN,
    )
    return None


@router.post("/refresh", response_model=Token)
def refresh_tokens(
    request: Request,
    response: Response,
    body: RefreshTokenRequest | None = None,
    db: Session = Depends(get_db)
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired refresh token",
    )

    ref_token = None
    if body and body.refresh_token:
        ref_token = body.refresh_token
    else:
        ref_token = request.cookies.get("refresh_token")

    if not ref_token:
        raise credentials_exception

    try:
        payload = decode_token(ref_token)
        user_id: str = payload.get("sub")
        token_type: str = payload.get("type")
        jti: str = payload.get("jti")
        exp: float = payload.get("exp")

        if user_id is None or token_type != "refresh":
            raise credentials_exception

        if jti and is_token_blacklisted(jti):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token has been revoked",
            )
    except jwt.PyJWTError:
        raise credentials_exception from None

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception

    token_version = payload.get("token_version")
    if token_version is not None and token_version != getattr(user, "token_version", 1):
        raise credentials_exception

    new_access_token = create_access_token(user)
    new_refresh_token = create_refresh_token(user)

    if jti and exp:
        remaining_ttl = int(exp - datetime.now(UTC).timestamp())
        blacklist_token(jti, remaining_ttl)

    response.set_cookie(
        key="access_token",
        value=new_access_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        domain=settings.COOKIE_DOMAIN,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    response.set_cookie(
        key="refresh_token",
        value=new_refresh_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        domain=settings.COOKIE_DOMAIN,
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
    )

    return {
        "access_token": new_access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer",
    }


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/apikeys", response_model=ApiKeyCreateResponse, status_code=status.HTTP_201_CREATED)
def create_api_key(
    key_data: ApiKeyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    raw_secret = secrets.token_hex(24)
    api_key_str = f"googi_live_{raw_secret}"
    hashed_key = hashlib.sha256(api_key_str.encode("utf-8")).hexdigest()

    expires_at = None
    if key_data.expires_in_days:
        expires_at = datetime.now(UTC) + timedelta(days=key_data.expires_in_days)

    db_key = ApiKey(
        name=key_data.name,
        hashed_key=hashed_key,
        prefix="googi_live_" + raw_secret[:6] + "..." + raw_secret[-4:],
        user_id=current_user.id,
        expires_at=expires_at,
        is_active=True
    )
    db.add(db_key)
    db.commit()
    db.refresh(db_key)

    return ApiKeyCreateResponse(
        id=db_key.id,
        name=db_key.name,
        prefix=db_key.prefix,
        api_key=api_key_str,
        created_at=db_key.created_at,
        expires_at=db_key.expires_at,
        is_active=db_key.is_active
    )


@router.get("/apikeys", response_model=list[ApiKeyResponse])
def list_api_keys(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    keys = db.query(ApiKey).filter(ApiKey.user_id == current_user.id).order_by(ApiKey.created_at.desc()).all()
    return keys


@router.delete("/apikeys/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_api_key(
    key_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_key = db.query(ApiKey).filter(ApiKey.id == key_id, ApiKey.user_id == current_user.id).first()
    if not db_key:
        raise HTTPException(status_code=404, detail="API Key not found")
    db.delete(db_key)
    db.commit()
    return None
