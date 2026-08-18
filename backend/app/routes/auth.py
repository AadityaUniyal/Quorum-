import logging
from datetime import UTC, datetime, timedelta

import bcrypt
import jwt
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.auth import User, UserRole
from app.schemas.auth import (
    ChangePassword,
    RefreshTokenRequest,
    Token,
    UserCreate,
    UserLogin,
    UserResponse,
    UserRoleUpdate,
    UserUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Rate limiter — imported from dedicated module to avoid circular import with main.py
from fastapi import Request, Response

from app.limiter import limiter

security = HTTPBearer(auto_error=False)

from app.core.security import (
    blacklist_token,
    is_token_blacklisted,
)
from app.core.security import (
    create_access_token as sec_create_access_token,
)
from app.core.security import (
    create_refresh_token as sec_create_refresh_token,
)

# Token expiry constants sourced from settings
ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES
REFRESH_TOKEN_EXPIRE_DAYS = settings.REFRESH_TOKEN_EXPIRE_DAYS

def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False

def create_access_token(user: User) -> str:
    return sec_create_access_token(user)

def create_refresh_token(user: User) -> str:
    return sec_create_refresh_token(user)

# Dependency to get current user from token or API Key
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

    # 1. Check for X-API-Key header (for scripts and integrations)
    api_key_header = request.headers.get("X-API-Key")
    if api_key_header:
        import hashlib
        hashed_key = hashlib.sha256(api_key_header.encode('utf-8')).hexdigest()
        from app.models.api_key import ApiKey
        api_key_record = db.query(ApiKey).filter(ApiKey.hashed_key == hashed_key).first()
        if not api_key_record or not api_key_record.is_active:
            raise credentials_exception
        if api_key_record.expires_at and api_key_record.expires_at < datetime.now(UTC):
            raise credentials_exception
        user = db.query(User).filter(User.id == api_key_record.user_id).first()
        if not user:
            raise credentials_exception
        return user

    # 2. Check for Bearer Token or Cookie (for browser UI users)
    token_str = None
    if credentials:
        token_str = credentials.credentials
    elif token:
        token_str = token
    # Check HttpOnly cookie for access token
    if not token_str:
        token_str = request.cookies.get("access_token")
    if not token_str:
        raise credentials_exception

    try:
        payload = jwt.decode(
            token_str,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        user_id: str = payload.get("sub")
        token_type: str = payload.get("type", "access")
        jti: str = payload.get("jti")
        if user_id is None:
            raise credentials_exception
        # Only access tokens are valid for API authentication
        if token_type != "access":
            raise credentials_exception
        if jti and is_token_blacklisted(jti):
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception from None

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception
    return user

# Helper dependency creator for RBAC verification
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

# Register a user
@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")  # Prevent abuse
def register_user(request: Request, user_data: UserCreate, db: Session = Depends(get_db)):
    import secrets
    # Check if user email already exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists.",
        )

    # If it is the first user in the database, promote them to ADMIN
    user_count = db.query(User).count()
    assigned_role = UserRole.ADMIN if user_count == 0 else user_data.role
    is_verified_status = True if (user_count == 0 or settings.DEBUG or settings.DATABASE_URL.startswith("sqlite") or "sqlite" in settings.DATABASE_URL) else False

    # Enforce password strength using zxcvbn (score >= 3)
    from zxcvbn import zxcvbn
    strength = zxcvbn(user_data.password)
    if strength["score"] < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password too weak. Please choose a stronger password."
        )

    # Verification token generation (Roadmap 1.2)
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
        # Simulate sending verification email (Roadmap 1.2)
        logger.info(f"Verification Email Link Sent to {db_user.email}: http://localhost:8000/api/auth/verify-email?token={v_token}")

    return db_user

# Email verification activation endpoint (Roadmap 1.2)
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

# Login endpoint
@router.post("/login", response_model=Token)
@limiter.limit("10/minute")  # Rate limit login attempts
def login(request: Request, login_data: UserLogin, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == login_data.email).first()
    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # Enforce email verification (Roadmap 1.2)
    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please verify your email address before logging in. Check your mailbox for the verification link."
        )

    access_token = create_access_token(user)
    refresh_token = create_refresh_token(user)
    # Set HttpOnly Secure cookie for access token
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        domain=settings.COOKIE_DOMAIN,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    # Also set refresh token as HttpOnly cookie
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

# ─── OAuth2 SSO Endpoints (Roadmap 1.2) ──────────────────────────────────────

@router.get("/login/google")
def login_google():
    """Start Google OAuth if configured, otherwise return a clear unsupported response."""
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
    """Handle callback from Google OAuth.

    The app does not currently exchange the authorization code for identity
    claims. Until that flow is wired to Google's token endpoint, we fail
    explicitly instead of fabricating a user.
    """
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Google OAuth callback handling is not implemented yet.",
    )

@router.get("/login/microsoft")
def login_microsoft():
    """Start Microsoft OAuth if configured, otherwise return a clear unsupported response."""
    microsoft_client_id = getattr(settings, "MICROSOFT_CLIENT_ID", None)
    microsoft_redirect_uri = getattr(settings, "MICROSOFT_REDIRECT_URI", None)
    if not microsoft_client_id or not microsoft_redirect_uri:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Microsoft SSO is not configured. Set MICROSOFT_CLIENT_ID and MICROSOFT_REDIRECT_URI to enable it.",
        )

    redirect_url = (
        "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
        f"?client_id={microsoft_client_id}"
        f"&redirect_uri={microsoft_redirect_uri}"
        "&response_type=code"
        "&scope=openid+email+profile"
        "&prompt=select_account"
    )
    return {"redirect_url": redirect_url, "message": "Redirecting to Microsoft SSO..."}

@router.get("/login/microsoft/callback")
def login_microsoft_callback(code: str, response: Response, db: Session = Depends(get_db)):
    """Handle callback from Microsoft OAuth.

    The app does not currently exchange the authorization code for identity
    claims. Until that flow is wired to Microsoft's token endpoint, we fail
    explicitly instead of fabricating a user.
    """
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Microsoft OAuth callback handling is not implemented yet.",
    )

# Refresh token endpoint — accepts a refresh token, returns new access + refresh tokens (rotation)
# Logout endpoint – clears auth cookies and revokes refresh token
@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response, current_user: User = Depends(get_current_user)):
    # Revoke refresh token if provided in cookie or body
    ref_token = request.cookies.get("refresh_token")
    if ref_token:
        try:
            payload = jwt.decode(
                ref_token,
                settings.JWT_SECRET_KEY,
                algorithms=[settings.JWT_ALGORITHM],
            )
            jti = payload.get("jti")
            exp = payload.get("exp")
            if jti and exp:
                remaining_ttl = int(exp - datetime.now(UTC).timestamp())
                blacklist_token(jti, remaining_ttl)
        except Exception:
            pass

    # Remove HttpOnly cookies
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

    # Extract refresh token from body or cookie
    ref_token = None
    if body and body.refresh_token:
        ref_token = body.refresh_token
    else:
        ref_token = request.cookies.get("refresh_token")

    if not ref_token:
        raise credentials_exception

    try:
        payload = jwt.decode(
            ref_token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
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

    new_access_token = create_access_token(user)
    new_refresh_token = create_refresh_token(user)

    # Blacklist the old refresh token (rotation)
    if jti and exp:
        remaining_ttl = int(exp - datetime.now(UTC).timestamp())
        blacklist_token(jti, remaining_ttl)

    # Set new HttpOnly cookies on the response (rotation)
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


# Get info of currently logged in user
@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


# API Keys management
from uuid import UUID

from app.schemas.api_key import ApiKeyCreate, ApiKeyCreateResponse, ApiKeyResponse


@router.post("/apikeys", response_model=ApiKeyCreateResponse, status_code=status.HTTP_201_CREATED)
def create_api_key(
    key_data: ApiKeyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    import hashlib
    import secrets

    # Generate random key: googi_live_xxxxxxxx
    raw_secret = secrets.token_hex(24) # 48 chars hex
    api_key_str = f"googi_live_{raw_secret}"
    hashed_key = hashlib.sha256(api_key_str.encode('utf-8')).hexdigest()

    expires_at = None
    if key_data.expires_in_days:
        expires_at = datetime.now(UTC) + timedelta(days=key_data.expires_in_days)

    from app.models.api_key import ApiKey
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
        api_key=api_key_str,  # Plain text key returned only ONCE
        created_at=db_key.created_at,
        expires_at=db_key.expires_at,
        is_active=db_key.is_active
    )

@router.get("/apikeys", response_model=list[ApiKeyResponse])
def list_api_keys(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.models.api_key import ApiKey
    keys = db.query(ApiKey).filter(ApiKey.user_id == current_user.id).order_by(ApiKey.created_at.desc()).all()
    return keys

@router.delete("/apikeys/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_api_key(
    key_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.models.api_key import ApiKey
    db_key = db.query(ApiKey).filter(ApiKey.id == key_id).first()
    if not db_key:
        raise HTTPException(status_code=404, detail="API Key not found")

    # Check permissions (only owner or Admin can delete)
    if db_key.user_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Forbidden")

    db.delete(db_key)
    db.commit()
    return None


# ─── Profile Management ──────────────────────────────────────────────────────

@router.patch("/me", response_model=UserResponse)
def update_profile(
    update_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update the current user's display name and/or email."""
    if update_data.email and update_data.email != current_user.email:
        conflict = db.query(User).filter(User.email == update_data.email).first()
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email address already in use by another account.",
            )
        current_user.email = update_data.email

    if update_data.full_name:
        current_user.full_name = update_data.full_name

    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/me/password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    data: ChangePassword,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Change the current user's password after verifying the existing one."""
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )
    from zxcvbn import zxcvbn as _zxcvbn
    strength = _zxcvbn(data.new_password)
    if strength["score"] < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password is too weak. Choose a stronger password (score ≥ 3).",
        )
    current_user.hashed_password = get_password_hash(data.new_password)
    db.commit()
    return None


# ─── Team Management (Admin only) ────────────────────────────────────────────

admin_only_dep = RoleChecker([UserRole.ADMIN])


@router.get("/users", response_model=list[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_only_dep),
):
    """List all registered users (Admin only)."""
    return db.query(User).order_by(User.created_at.asc()).all()


@router.patch("/users/{user_id}/role", response_model=UserResponse)
def update_user_role(
    user_id: UUID,
    body: UserRoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_only_dep),
):
    """Change a user's role (Admin only)."""
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found.")
    if str(target.id) == str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admins cannot change their own role.",
        )
    target.role = body.role
    db.commit()
    db.refresh(target)
    return target


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_only_dep),
):
    """Remove a user account (Admin only)."""
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found.")
    if str(target.id) == str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account.",
        )
    db.delete(target)
    db.commit()
    return None


# ─── 2FA / TOTP (Roadmap 1.2) ────────────────────────────────────────────────

@router.post("/2fa/setup")
def setup_totp(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate a new TOTP secret and return a QR code URI.
    The user must verify with a valid TOTP code before 2FA is enabled.
    """
    try:
        import base64
        import io

        import pyotp
        import qrcode
    except ImportError:
        raise HTTPException(
            status_code=501,
            detail="TOTP libraries not installed. Run: pip install pyotp qrcode[pil]",
        )

    # Generate new secret (even if one exists — allows reset)
    secret = pyotp.random_base32()
    current_user.totp_secret = secret
    current_user.totp_enabled = False   # not active until verified
    db.commit()

    # Build OTPAuth URI for QR code
    totp = pyotp.TOTP(secret)
    uri = totp.provisioning_uri(name=current_user.email, issuer_name="Googi")

    # Generate QR code as base64 PNG
    img = qrcode.make(uri)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    qr_b64 = base64.b64encode(buf.getvalue()).decode()

    return {
        "secret": secret,
        "qr_code_uri": uri,
        "qr_code_image": f"data:image/png;base64,{qr_b64}",
        "message": "Scan the QR code with your authenticator app. Then call POST /2fa/verify to activate.",
    }


@router.post("/2fa/verify")
def verify_and_enable_totp(
    totp_code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Verify a TOTP code and enable 2FA for the account."""
    try:
        import pyotp
    except ImportError:
        raise HTTPException(status_code=501, detail="pyotp not installed.")

    if not current_user.totp_secret:
        raise HTTPException(status_code=400, detail="2FA setup not initiated. Call POST /2fa/setup first.")

    totp = pyotp.TOTP(current_user.totp_secret)
    if not totp.verify(totp_code, valid_window=1):
        raise HTTPException(status_code=400, detail="Invalid TOTP code. Please try again.")

    current_user.totp_enabled = True
    db.commit()
    return {"message": "2FA successfully enabled.", "totp_enabled": True}


@router.post("/2fa/disable")
def disable_totp(
    totp_code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Disable 2FA after verifying one last TOTP code."""
    try:
        import pyotp
    except ImportError:
        raise HTTPException(status_code=501, detail="pyotp not installed.")

    if not current_user.totp_enabled:
        raise HTTPException(status_code=400, detail="2FA is not currently enabled.")

    totp = pyotp.TOTP(current_user.totp_secret)
    if not totp.verify(totp_code, valid_window=1):
        raise HTTPException(status_code=400, detail="Invalid TOTP code.")

    current_user.totp_enabled = False
    current_user.totp_secret = None
    db.commit()
    return {"message": "2FA disabled successfully.", "totp_enabled": False}


@router.post("/2fa/validate")
def validate_totp_on_login(
    totp_code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Validate a TOTP code during login when 2FA is enabled.
    Called after successful password login when totp_enabled=True.
    """
    try:
        import pyotp
    except ImportError:
        raise HTTPException(status_code=501, detail="pyotp not installed.")

    if not current_user.totp_enabled or not current_user.totp_secret:
        raise HTTPException(status_code=400, detail="2FA not enabled for this account.")

    totp = pyotp.TOTP(current_user.totp_secret)
    if not totp.verify(totp_code, valid_window=1):
        raise HTTPException(status_code=401, detail="Invalid 2FA code.")

    return {"valid": True, "message": "2FA code accepted."}
