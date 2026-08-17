# Import all models here so SQLAlchemy metadata is aware of them
from app.database import Base
from app.models.api_key import ApiKey
from app.models.audit import AuditLog
from app.models.auth import User, UserRole
from app.models.bookmark import Bookmark
from app.models.comment import Comment
from app.models.document import Document, DocumentCategory, DocumentStatus, ExtractedField, FieldValidationStatus
from app.models.notification import Notification
from app.models.search import CrawledPage, PageLink, SearchLog
from app.models.user_profile import UserProfile
from app.models.webhook import WebhookConfig, WebhookLog

__all__ = [
    "Base",
    "AuditLog",
    "User",
    "UserRole",
    "UserProfile",
    "Document",
    "DocumentCategory",
    "DocumentStatus",
    "ExtractedField",
    "FieldValidationStatus",
    "CrawledPage",
    "PageLink",
    "SearchLog",
    "Comment",
    "ApiKey",
    "Bookmark",
    "Notification",
    "WebhookConfig",
    "WebhookLog",
]


