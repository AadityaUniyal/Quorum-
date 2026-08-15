from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.auth import User, UserRole
from app.models.comment import Comment
from app.models.document import Document
from app.routes.auth import RoleChecker
from app.schemas.comment import CommentCreate, CommentResponse

router = APIRouter(prefix="/api/documents", tags=["comments"])

# Permissions
any_active_user = RoleChecker([UserRole.ADMIN, UserRole.REVIEWER, UserRole.OPERATOR, UserRole.VIEWER])
admin_or_reviewer_or_operator = RoleChecker([UserRole.ADMIN, UserRole.REVIEWER, UserRole.OPERATOR])


@router.get("/{document_id}/comments", response_model=list[CommentResponse])
def get_comments(
    document_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(any_active_user)
):
    # Verify document exists
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    comments = db.query(Comment).filter(Comment.document_id == document_id).order_by(Comment.created_at.asc()).all()

    response = []
    for c in comments:
        user_name = c.user.full_name if c.user else "System"
        response.append(
            CommentResponse(
                id=c.id,
                document_id=c.document_id,
                field_key=c.field_key,
                user_id=c.user_id,
                content=c.content,
                created_at=c.created_at,
                user_name=user_name
            )
        )
    return response


@router.post("/{document_id}/comments", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
def create_comment(
    document_id: UUID,
    comment_data: CommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_or_reviewer_or_operator)
):
    # Verify document exists
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    comment = Comment(
        document_id=document_id,
        field_key=comment_data.field_key,
        user_id=current_user.id,
        content=comment_data.content
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)

    return CommentResponse(
        id=comment.id,
        document_id=comment.document_id,
        field_key=comment.field_key,
        user_id=comment.user_id,
        content=comment.content,
        created_at=comment.created_at,
        user_name=current_user.full_name
    )


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(
    comment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_or_reviewer_or_operator)
):
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    # Only creator of the comment or ADMIN can delete it
    if current_user.role != UserRole.ADMIN and comment.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete this comment"
        )

    db.delete(comment)
    db.commit()
    return None
