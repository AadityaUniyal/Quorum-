import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Enum, String
from sqlalchemy.orm import relationship

from app.database import GUID, Base


class UserRole(enum.StrEnum):
    ADMIN = "ADMIN"
    REVIEWER = "REVIEWER"
    OPERATOR = "OPERATOR"
    VIEWER = "VIEWER"

class User(Base):
    __tablename__ = "users"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    role = Column(Enum(UserRole), default=UserRole.VIEWER, nullable=False)
    profile = relationship('UserProfile', back_populates='user', uselist=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # 2FA / TOTP fields (Roadmap 1.2)
    totp_secret = Column(String, nullable=True)       # base32 TOTP secret
    totp_enabled = Column(Boolean, default=False, nullable=False)  # whether 2FA is active

    # Email Verification fields (Roadmap 1.2)
    is_verified = Column(Boolean, default=False, nullable=False)
    verification_token = Column(String, nullable=True)
    verification_token_expires_at = Column(DateTime, nullable=True)
