import logging
import re
from collections import deque
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.limiter import limiter
from app.models.auth import User
from app.routes.auth import get_current_user

router = APIRouter(prefix="/admin", tags=["admin"])
logger = logging.getLogger(__name__)

BASE_LOGS_DIR = Path(getattr(settings, "LOG_DIR", Path(__file__).resolve().parent.parent / "logs")).resolve()
BASE_LOGS_DIR.mkdir(parents=True, exist_ok=True)
LOG_FILENAME_REGEX = re.compile(r"^[a-zA-Z0-9_\-][a-zA-Z0-9_\-\.]*\.log$")

# Admin role check dependency
def admin_user(current_user: User = Depends(get_current_user)):
    role = getattr(current_user, "role", None)
    role_value = getattr(role, "value", role)
    if role_value != "ADMIN":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")
    return current_user

@router.get("/users", response_model=list[dict])
@limiter.limit("10/minute")
def list_users(request: Request, db: Session = Depends(get_db), _: User = Depends(admin_user)):
    users = db.query(User).all()
    return [{"id": str(u.id), "email": u.email, "role": u.role.value if hasattr(u.role, 'value') else u.role} for u in users]

@router.delete("/users/{user_id}")
@limiter.limit("10/minute")
def delete_user(request: Request, user_id: str, db: Session = Depends(get_db), _: User = Depends(admin_user)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.profile:
        db.delete(user.profile)
    db.delete(user)
    db.commit()
    return {"detail": "User deleted"}

@router.get("/logs")
@limiter.limit("10/minute")
def get_logs(
    request: Request,
    file: str = Query("app.log", description="Log filename to view"),
    lines: int = Query(500, ge=1, le=5000, description="Number of tail lines to retrieve"),
    _: User = Depends(admin_user),
):
    if not LOG_FILENAME_REGEX.match(file):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid log filename. Must be alphanumeric, end with .log, and cannot contain path separators.",
        )

    try:
        target_path = (BASE_LOGS_DIR / file).resolve()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid path specified.",
        )

    if not target_path.is_relative_to(BASE_LOGS_DIR) or target_path == BASE_LOGS_DIR:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Path traversal detected.",
        )

    if not target_path.is_file():
        return {"logs": []}

    try:
        with open(target_path, encoding="utf-8", errors="replace") as f:
            log_lines = [line.rstrip("\r\n") for line in deque(f, maxlen=lines)]
        return {"logs": log_lines}
    except Exception as e:
        logger.exception(f"Error reading log file {target_path}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to read log file.",
        )
