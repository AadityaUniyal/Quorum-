from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import get_password_hash, validate_password_strength
from app.database import get_db
from app.models.auth import User
from app.routes.auth import get_current_user
from app.schemas.user import UserProfileRead, UserProfileUpdate

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/me", response_model=UserProfileRead)
def read_profile(current_user: User = Depends(get_current_user)):
    if not current_user.profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")
    return current_user.profile


@router.put("/me", response_model=UserProfileRead)
def update_profile(
    update: UserProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    profile = current_user.profile
    if not profile:
        from app.models.user_profile import UserProfile
        profile = UserProfile(user_id=current_user.id)
        db.add(profile)
    if update.full_name is not None:
        profile.full_name = update.full_name
    if update.avatar_url is not None:
        profile.avatar_url = update.avatar_url
    if update.bio is not None:
        profile.bio = update.bio
    db.commit()
    db.refresh(profile)
    return profile


@router.put("/me/password")
def change_password(
    new_password: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    is_valid, err_msg = validate_password_strength(new_password)
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err_msg)

    current_user.hashed_password = get_password_hash(new_password)
    # Invalidate all existing token families on password change
    current_user.token_version = getattr(current_user, "token_version", 1) + 1
    db.commit()
    return {"detail": "Password updated successfully. All active sessions invalidated."}
