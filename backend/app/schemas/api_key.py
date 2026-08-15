from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class ApiKeyCreate(BaseModel):
    name: str
    expires_in_days: int | None = None


class ApiKeyResponse(BaseModel):
    id: UUID
    name: str
    prefix: str
    created_at: datetime
    expires_at: datetime | None = None
    is_active: bool

    class Config:
        from_attributes = True


class ApiKeyCreateResponse(ApiKeyResponse):
    api_key: str
