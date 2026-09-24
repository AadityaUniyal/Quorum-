"""
Document Authorization & Tenant Access Service

Enforces role-based and organization-scoped multi-tenant data boundaries.
Prevents Insecure Direct Object References (IDOR) across documents, RAG queries,
reviews, exports, and comments.
"""

from app.models.auth import User, UserRole
from app.models.document import Document
from fastapi import HTTPException, status
from sqlalchemy.orm import Query


def can_read_document(user: User, doc: Document) -> bool:
    """
    Determines whether a user has read access to a document.
    """
    if not user or not doc:
        return False

    # Admins have global or organizational read privileges
    if user.role == UserRole.ADMIN:
        if user.organization_id and doc.organization_id:
            return user.organization_id == doc.organization_id
        return True

    # Check direct ownership
    if doc.uploaded_by and doc.uploaded_by == user.id:
        return True

    # Check organizational boundary
    if user.organization_id and doc.organization_id:
        return user.organization_id == doc.organization_id

    # Fallback for single-tenant / local development
    if not user.organization_id and not doc.organization_id:
        return True

    return False


def can_write_document(user: User, doc: Document) -> bool:
    """
    Determines whether a user has write/modification access to a document.
    """
    if not user or not doc:
        return False

    # VIEWER cannot modify documents
    if user.role == UserRole.VIEWER:
        return False

    # Check read permission first
    if not can_read_document(user, doc):
        return False

    # Reviewers & Operators can write documents within their organization
    return user.role in (UserRole.ADMIN, UserRole.OPERATOR, UserRole.REVIEWER)


def require_document_read(user: User, doc: Document | None) -> Document:
    """
    Validates document existence and read authorization.
    Raises 404 if not found, 403 if unauthorized.
    """
    if not doc or doc.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found."
        )
    if not can_read_document(user, doc):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this document."
        )
    return doc


def require_document_write(user: User, doc: Document | None) -> Document:
    """
    Validates document existence and write authorization.
    Raises 404 if not found, 403 if unauthorized.
    """
    if not doc or doc.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found."
        )
    if not can_write_document(user, doc):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to modify this document."
        )
    return doc


def filter_documents_for_user(query: Query, user: User) -> Query:
    """
    Applies multi-tenant filters to a SQLAlchemy document query based on user's organization.
    """
    # Exclude soft-deleted documents
    query = query.filter(Document.deleted_at.is_(None))

    if user.role == UserRole.ADMIN and not user.organization_id:
        return query

    if user.organization_id:
        return query.filter(
            (Document.organization_id == user.organization_id) | (Document.uploaded_by == user.id)
        )

    # In single-tenant mode without org_id, show unassigned org documents or user's own uploads
    return query.filter(
        (Document.organization_id.is_(None)) | (Document.uploaded_by == user.id)
    )
