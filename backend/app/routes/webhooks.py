import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.security_net import validate_safe_url
from app.database import get_db
from app.models.auth import User, UserRole
from app.models.webhook import WebhookConfig
from app.routes.auth import RoleChecker

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])
logger = logging.getLogger(__name__)

# Only Admin can manage webhooks
admin_only = RoleChecker([UserRole.ADMIN])


class WebhookCreateRequest(BaseModel):
    url: str
    event_type: str


@router.post("", status_code=status.HTTP_201_CREATED)
def register_webhook(
    req: WebhookCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_only)
):
    url_str = str(req.url).strip()
    try:
        # Check SSRF validation
        validate_safe_url(url_str)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid webhook URL (SSRF security policy): {e}"
        ) from e

    # Check for duplicate
    duplicate = db.query(WebhookConfig).filter(
        WebhookConfig.url == url_str,
        WebhookConfig.event_type == req.event_type
    ).first()
    if duplicate:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This URL is already registered for this event type."
        )

    new_sub = WebhookConfig(
        url=url_str,
        event_type=req.event_type,
        is_active=True
    )
    db.add(new_sub)
    db.commit()
    db.refresh(new_sub)
    return {"status": "success", "message": "Webhook registered successfully", "id": str(new_sub.id)}


@router.get("")
def list_webhooks(
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_only)
):
    configs = db.query(WebhookConfig).order_by(WebhookConfig.created_at.desc()).all()
    return [
        {
            "id": str(c.id),
            "url": c.url,
            "event_type": c.event_type,
            "is_active": c.is_active,
            "created_at": c.created_at.isoformat() if c.created_at else None
        }
        for c in configs
    ]


@router.delete("/{webhook_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_webhook(
    webhook_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(admin_only)
):
    sub = db.query(WebhookConfig).filter(WebhookConfig.id == webhook_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Webhook subscription not found")
    db.delete(sub)
    db.commit()
    return None
