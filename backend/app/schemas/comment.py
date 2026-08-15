from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class CommentCreate(BaseModel):
    content: str
    field_key: str | None = None


class CommentResponse(BaseModel):
    id: UUID
    document_id: UUID
    field_key: str | None = None
    user_id: UUID | None = None
    content: str
    created_at: datetime
    user_name: str | None = None

    class Config:
        from_attributes = True
