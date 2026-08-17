
from pydantic import BaseModel, ConfigDict, Field


class UserProfileRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    full_name: str | None = None
    avatar_url: str | None = None
    bio: str | None = None


class UserProfileUpdate(BaseModel):
    full_name: str | None = Field(None, max_length=255)
    avatar_url: str | None = Field(None, max_length=1024)
    bio: str | None = Field(None, max_length=1024)
