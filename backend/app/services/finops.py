import logging
from typing import Any
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.finops import TokenUsage

logger = logging.getLogger(__name__)

# Model cost per 1000 tokens (USD)
MODEL_PRICING: dict[str, dict[str, float]] = {
    "gemini-1.5-flash": {"input": 0.000075, "output": 0.0003},
    "gemini-1.5-pro": {"input": 0.00125, "output": 0.005},
    "gemini-2.0-flash": {"input": 0.0001, "output": 0.0004},
    "default": {"input": 0.0001, "output": 0.0003},
}


def calculate_cost(model_name: str, prompt_tokens: int, completion_tokens: int) -> float:
    """Calculates estimated USD cost for LLM invocation."""
    pricing = MODEL_PRICING.get(model_name.lower(), MODEL_PRICING["default"])
    input_cost = (prompt_tokens / 1000.0) * pricing["input"]
    output_cost = (completion_tokens / 1000.0) * pricing["output"]
    return round(input_cost + output_cost, 6)


def record_token_usage(
    db: Session,
    model_name: str,
    prompt_tokens: int,
    completion_tokens: int,
    user_id: UUID | str | None = None,
    organization_id: UUID | str | None = None,
) -> TokenUsage:
    """Records token usage entry in the database."""
    try:
        user_uuid = UUID(str(user_id)) if user_id else None
        org_uuid = UUID(str(organization_id)) if organization_id else None

        total_tokens = prompt_tokens + completion_tokens
        cost = calculate_cost(model_name, prompt_tokens, completion_tokens)

        usage = TokenUsage(
            organization_id=org_uuid,
            user_id=user_uuid,
            model_name=model_name,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            estimated_cost_usd=cost,
        )
        db.add(usage)
        db.commit()
        db.refresh(usage)
        return usage
    except Exception as e:
        logger.error(f"Failed to record token usage: {e}")
        db.rollback()
        raise e


def get_finops_summary(db: Session, organization_id: UUID | str | None = None) -> dict[str, Any]:
    """Returns FinOps cost and token summary breakdown."""
    query = db.query(TokenUsage)
    if organization_id:
        try:
            org_uuid = UUID(str(organization_id))
            query = query.filter((TokenUsage.organization_id == org_uuid) | (TokenUsage.organization_id.is_(None)))
        except Exception:
            pass

    total_records = query.count()
    total_tokens = db.query(func.coalesce(func.sum(TokenUsage.total_tokens), 0)).scalar() or 0
    total_cost = db.query(func.coalesce(func.sum(TokenUsage.estimated_cost_usd), 0.0)).scalar() or 0.0

    model_breakdown = (
        db.query(
            TokenUsage.model_name,
            func.count(TokenUsage.id).label("calls"),
            func.sum(TokenUsage.total_tokens).label("tokens"),
            func.sum(TokenUsage.estimated_cost_usd).label("cost"),
        )
        .group_by(TokenUsage.model_name)
        .all()
    )

    return {
        "total_invocations": total_records,
        "total_tokens": int(total_tokens),
        "total_estimated_cost_usd": round(float(total_cost), 4),
        "model_breakdown": [
            {
                "model": row.model_name,
                "calls": row.calls,
                "tokens": int(row.tokens or 0),
                "cost_usd": round(float(row.cost or 0.0), 4),
            }
            for row in model_breakdown
        ],
    }
