import logging
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.auth import User
from app.routes.auth import get_current_user
from app.limiter import limiter

router = APIRouter(prefix="/admin", tags=["admin"])
logger = logging.getLogger(__name__)

# Admin role check dependency
def admin_user(current_user: User = Depends(get_current_user)):
    if getattr(current_user, 'role', None) != 'ADMIN':
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
def get_logs(request: Request):
    try:
        with open('backend/app/logs/app.log', 'r') as f:
            lines = f.readlines()[-500:]
        return {"logs": lines}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
