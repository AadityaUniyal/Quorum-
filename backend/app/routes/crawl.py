
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.auth import UserRole
from app.models.search import CrawledPage
from app.routes.auth import RoleChecker
from app.services.crawler import compute_pagerank
from app.services.queue import publish_crawl_task

router = APIRouter(prefix="/api/crawl", tags=["crawl"])

# Permissions (Only Operator/Admin can trigger crawls)
operator_or_admin = RoleChecker([UserRole.ADMIN, UserRole.OPERATOR])
any_user = RoleChecker([UserRole.ADMIN, UserRole.OPERATOR, UserRole.REVIEWER, UserRole.VIEWER])

class CrawlRequest(BaseModel):
    url: str
    max_depth: int | None = 2

class CrawledPageResponse(BaseModel):
    url: str
    title: str | None
    pagerank: float
    last_crawled_at: str

    model_config = ConfigDict(from_attributes=True)

@router.post("")
def start_crawl(
    request: CrawlRequest,
    current_user: str = Depends(operator_or_admin)
):
    """
    Triggers a distributed crawl task by publishing to RabbitMQ crawl_queue.
    """
    url_str = str(request.url).strip()
    if not url_str.startswith(("http://", "https://")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="URL must start with http:// or https://"
        )
    max_depth = request.max_depth if request.max_depth is not None else 2
    publish_crawl_task(url=url_str, max_depth=max_depth)
    return {
        "message": f"Crawl task queued successfully for: {url_str}",
        "status": "queued",
        "url": url_str,
        "max_depth": max_depth
    }

@router.get("/pages")
def list_crawled_pages(
    db: Session = Depends(get_db),
    current_user: str = Depends(any_user)
):
    """
    Returns list of all crawled pages and their PageRank score.
    """
    pages = db.query(CrawledPage).order_by(CrawledPage.pagerank.desc()).all()
    results = []
    for p in pages:
        results.append({
            "id": p.id,
            "url": p.url,
            "title": p.title,
            "pagerank": round(p.pagerank, 6),
            "last_crawled_at": p.last_crawled_at.isoformat()
        })
    return results

@router.post("/pagerank")
def force_pagerank(
    db: Session = Depends(get_db),
    current_user: str = Depends(operator_or_admin)
):
    """
    Forces recalculation of PageRank scores across all crawled URLs.
    """
    compute_pagerank(db)
    return {"message": "PageRank calculation completed successfully."}
