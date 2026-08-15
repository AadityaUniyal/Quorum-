from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class BookmarkCreate(BaseModel):
    name: str | None = Field(default=None, description="Display name for the saved search bookmark")
    title: str | None = Field(default=None, description="Alias for name")
    query_text: str | None = Field(default=None, description="Search query string")
    query: str | None = Field(default=None, description="Alias for query_text")
    filters: dict[str, Any] | None = Field(default=None, description="Optional search filter parameters")
    tags: list[str] | None = Field(default=None, description="Alias for filters or filter tags")

    @model_validator(mode="after")
    def populate_aliases(self) -> "BookmarkCreate":
        # Resolve query_text and query
        if not self.query_text and self.query:
            self.query_text = self.query
        elif not self.query and self.query_text:
            self.query = self.query_text

        # Resolve name and title
        if not self.name and self.title:
            self.name = self.title
        elif not self.title and self.name:
            self.title = self.name
        elif not self.name and not self.title and self.query_text:
            self.name = self.query_text
            self.title = self.query_text

        # Resolve filters and tags
        if self.filters is None and self.tags is not None:
            self.filters = {"tags": self.tags}
        elif self.filters is not None and self.tags is None:
            if isinstance(self.filters, dict) and "tags" in self.filters and isinstance(self.filters["tags"], list):
                self.tags = self.filters["tags"]

        return self


class BookmarkUpdate(BaseModel):
    name: str | None = None
    title: str | None = None
    query_text: str | None = None
    query: str | None = None
    filters: dict[str, Any] | None = None
    tags: list[str] | None = None

    @model_validator(mode="after")
    def populate_aliases(self) -> "BookmarkUpdate":
        if not self.query_text and self.query:
            self.query_text = self.query
        elif not self.query and self.query_text:
            self.query = self.query_text

        if not self.name and self.title:
            self.name = self.title
        elif not self.title and self.name:
            self.title = self.name

        if self.filters is None and self.tags is not None:
            self.filters = {"tags": self.tags}
        elif self.filters is not None and self.tags is None:
            if isinstance(self.filters, dict) and "tags" in self.filters and isinstance(self.filters["tags"], list):
                self.tags = self.filters["tags"]

        return self


class BookmarkResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    name: str
    title: str | None = None
    query_text: str
    query: str | None = None
    filters: dict[str, Any] | None = None
    tags: list[str] | None = None
    created_at: datetime

    @model_validator(mode="after")
    def populate_aliases(self) -> "BookmarkResponse":
        if not self.title and self.name:
            self.title = self.name
        elif not self.name and self.title:
            self.name = self.title

        if not self.query and self.query_text:
            self.query = self.query_text
        elif not self.query_text and self.query:
            self.query_text = self.query

        if self.tags is None and isinstance(self.filters, dict):
            tags_val = self.filters.get("tags")
            if isinstance(tags_val, list):
                self.tags = tags_val
        elif self.filters is None and self.tags is not None:
            self.filters = {"tags": self.tags}

        return self
