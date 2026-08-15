"""
DocIntel AI — Application Entry Point

Production-grade FastAPI application with:
- Structured JSON logging with trace_id correlation
- Security headers middleware (CSP, HSTS, X-Frame-Options)
- Rate limiting via slowapi
- Real health checks (DB, Redis, RabbitMQ connectivity)
- Prometheus-compatible metrics endpoint
- CORS with configurable origins
"""

import time
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

import app.models.audit

# Import all models to register with Base metadata
import app.models.auth
import app.models.document
import app.models.search
import app.models.notification
import app.models.webhook
import app.models.bookmark
from app.config import settings
from app.database import Base, engine
from app.limiter import limiter
from app.logging_config import generate_trace_id, get_logger, setup_logging, trace_id_var
from app.services.cache import cache

logger = get_logger(__name__)

# ─── Metrics Collector ──────────────────────────────────────────────────────

class MetricsCollector:
    """Simple in-memory metrics for Prometheus-style /metrics endpoint."""

    def __init__(self):
        self.request_count: int = 0
        self.request_latency_sum: float = 0.0
        self.request_latencies: list = []  # Keep last 1000 for percentiles
        self.documents_processed: int = 0
        self.documents_failed: int = 0
        self.status_codes: dict[int, int] = {}
        self.agent_latencies: dict[str, list[float]] = {}

    def record_request(self, duration_ms: float, status_code: int):
        self.request_count += 1
        self.request_latency_sum += duration_ms
        self.request_latencies.append(duration_ms)
        if len(self.request_latencies) > 1000:
            self.request_latencies = self.request_latencies[-1000:]
        self.status_codes[status_code] = self.status_codes.get(status_code, 0) + 1

    def record_agent_latency(self, agent_name: str, duration_sec: float):
        if agent_name not in self.agent_latencies:
            self.agent_latencies[agent_name] = []
        self.agent_latencies[agent_name].append(duration_sec)
        if len(self.agent_latencies[agent_name]) > 100:
            self.agent_latencies[agent_name] = self.agent_latencies[agent_name][-100:]

    def get_percentile(self, p: float) -> float:
        if not self.request_latencies:
            return 0.0
        sorted_latencies = sorted(self.request_latencies)
        idx = int(len(sorted_latencies) * p / 100)
        return sorted_latencies[min(idx, len(sorted_latencies) - 1)]

    def to_dict(self) -> dict[str, Any]:
        return {
            "requests_total": self.request_count,
            "request_latency_avg_ms": round(
                self.request_latency_sum / max(self.request_count, 1), 2
            ),
            "request_latency_p50_ms": round(self.get_percentile(50), 2),
            "request_latency_p95_ms": round(self.get_percentile(95), 2),
            "request_latency_p99_ms": round(self.get_percentile(99), 2),
            "documents_processed": self.documents_processed,
            "documents_failed": self.documents_failed,
            "status_codes": self.status_codes,
        }


metrics = MetricsCollector()

# ─── Lifespan ────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle."""
    setup_logging("DEBUG" if settings.DEBUG else "INFO")
    
    # Optional: Sentry & OpenTelemetry (non-critical)
    try:
        from app.error_handling import init_sentry
        init_sentry()
    except Exception as e:
        logger.warning(f"Sentry initialization skipped: {e}")
    try:
        from app.observability import init_tracing
        init_tracing(app)
    except Exception as e:
        logger.warning(f"OpenTelemetry initialization skipped: {e}")
    
    logger.info("DocIntel AI starting up", extra={"trace_id": "startup"})

    # Create database tables
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables initialized", extra={"trace_id": "startup"})
    except Exception as e:
        logger.error(f"Database table creation failed: {e}", extra={"trace_id": "startup"})

    yield

    logger.info("DocIntel AI shutting down", extra={"trace_id": "shutdown"})


# ─── Application ─────────────────────────────────────────────────────────────

app = FastAPI(
    title=settings.APP_NAME,
    description="Production-grade Distributed AI Document Intelligence Platform",
    version="1.0.0",
    debug=settings.DEBUG,
    lifespan=lifespan,
)

# Initialize SlowAPI rate limiter (imported from app.limiter)
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)
# Register exception handler for rate limit exceeded
app.add_exception_handler(RateLimitExceeded, lambda request, exc: JSONResponse(
    status_code=429,
    content={"detail": "Rate limit exceeded"},
))


# ─── Middleware: Trace ID + Request Logging ──────────────────────────────────

class TraceIDMiddleware(BaseHTTPMiddleware):
    """Assigns a trace_id to every request for distributed tracing."""

    async def dispatch(self, request: Request, call_next):
        trace_id = request.headers.get("X-Trace-ID", generate_trace_id())
        trace_id_var.set(trace_id)

        start_time = time.time()
        response = await call_next(request)
        duration_ms = (time.time() - start_time) * 1000

        # Record metrics
        metrics.record_request(duration_ms, response.status_code)

        # Add trace_id to response headers
        response.headers["X-Trace-ID"] = trace_id

        # Log the request
        logger.info(
            f"{request.method} {request.url.path} → {response.status_code} ({duration_ms:.1f}ms)",
            extra={
                "trace_id": trace_id,
                "method": request.method,
                "path": str(request.url.path),
                "status_code": response.status_code,
                "duration_ms": round(duration_ms, 1),
            }
        )

        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Adds security headers to every response (OWASP best practices)."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        if not settings.DEBUG:
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains"
            )
        return response


# Add middleware (order matters — outermost first)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(TraceIDMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Include Routers ─────────────────────────────────────────────────────────

from app.routes import analytics, auth, crawl, documents, review, search, streaming, comments, rag, notifications, webhooks, bookmarks  # noqa: E402

app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(review.router)
app.include_router(search.router)
app.include_router(analytics.router)
app.include_router(streaming.router)
app.include_router(crawl.router)
app.include_router(comments.router)
app.include_router(rag.router)
app.include_router(notifications.router)
app.include_router(webhooks.router)
app.include_router(bookmarks.router)


# ─── Health & System Endpoints ───────────────────────────────────────────────

@app.get("/")
def root():
    """Root endpoint — basic liveness check."""
    return {
        "status": "healthy",
        "app_name": settings.APP_NAME,
        "version": "1.0.0"
    }


@cache(ttl_seconds=10)
@app.get("/health")
def health_check():
    """
    Comprehensive health check that verifies connectivity to all
    backing services: PostgreSQL, Redis, RabbitMQ.
    """
    health: dict[str, Any] = {
        "status": "healthy",
        "checks": {}
    }

    # Check PostgreSQL
    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        health["checks"]["database"] = {"status": "connected", "type": "postgresql"}
    except Exception as e:
        health["checks"]["database"] = {"status": "disconnected", "error": str(e)}
        health["status"] = "degraded"

    # Check Redis
    try:
        import redis as redis_lib
        r = redis_lib.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            password=settings.REDIS_PASSWORD,
            socket_timeout=2
        )
        r.ping()
        health["checks"]["redis"] = {"status": "connected"}
        r.close()
    except Exception:
        health["checks"]["redis"] = {"status": "disconnected"}
        health["status"] = "degraded"

    # Check RabbitMQ
    try:
        import pika
        connection = pika.BlockingConnection(
            pika.ConnectionParameters(
                host=settings.RABBITMQ_HOST,
                port=settings.RABBITMQ_PORT,
                credentials=pika.PlainCredentials(
                    settings.RABBITMQ_USER, settings.RABBITMQ_PASS
                ),
                connection_attempts=1,
                socket_timeout=2,
            )
        )
        connection.close()
        health["checks"]["rabbitmq"] = {"status": "connected"}
    except Exception:
        health["checks"]["rabbitmq"] = {"status": "disconnected"}
        health["status"] = "degraded"

    # Check ChromaDB
    try:
        from app.services.vector_store import chroma_client
        chroma_client.heartbeat()
        health["checks"]["chroma"] = {"status": "connected"}
    except Exception as e:
        health["checks"]["chroma"] = {"status": "disconnected", "error": str(e)}
        health["status"] = "degraded"

    status_code = 200 if health["checks"].get("database", {}).get("status") == "connected" else 503
    return JSONResponse(content=health, status_code=status_code)


from fastapi.responses import PlainTextResponse

def get_queue_depth() -> int:
    try:
        import pika
        from app.config import settings
        credentials = pika.PlainCredentials(settings.RABBITMQ_USER, settings.RABBITMQ_PASS)
        parameters = pika.ConnectionParameters(
            host=settings.RABBITMQ_HOST,
            port=settings.RABBITMQ_PORT,
            credentials=credentials,
            socket_timeout=1,
        )
        connection = pika.BlockingConnection(parameters)
        channel = connection.channel()
        res = channel.queue_declare(queue="document_processing_queue", passive=True)
        message_count = res.method.message_count
        connection.close()
        return message_count
    except Exception:
        return 0

@app.get("/metrics", response_class=PlainTextResponse)
def prometheus_metrics():
    """
    Prometheus metrics endpoint.
    Exposes HTTP latency metrics, RabbitMQ queue depth, document counters, and agent latencies in standard exposition format.
    """
    data = metrics.to_dict()
    q_depth = get_queue_depth()
    
    agent_latencies = getattr(metrics, "agent_latencies", {})
    agent_lines = []
    for agent_name, latency_list in agent_latencies.items():
        if latency_list:
            avg_lat = sum(latency_list) / len(latency_list)
            agent_lines.append(f'googi_agent_latency_seconds{{agent="{agent_name}"}} {round(avg_lat, 4)}')
            
    lines = [
        f'# HELP googi_http_requests_total Total HTTP requests',
        f'# TYPE googi_http_requests_total counter',
        f'googi_http_requests_total {data["requests_total"]}',
        
        f'# HELP googi_http_request_latency_avg_ms Average HTTP request latency in ms',
        f'# TYPE googi_http_request_latency_avg_ms gauge',
        f'googi_http_request_latency_avg_ms {data["request_latency_avg_ms"]}',
        
        f'# HELP googi_http_request_latency_p50_ms P50 HTTP request latency in ms',
        f'# TYPE googi_http_request_latency_p50_ms gauge',
        f'googi_http_request_latency_p50_ms {data["request_latency_p50_ms"]}',
        
        f'# HELP googi_http_request_latency_p95_ms P95 HTTP request latency in ms',
        f'# TYPE googi_http_request_latency_p95_ms gauge',
        f'googi_http_request_latency_p95_ms {data["request_latency_p95_ms"]}',
        
        f'# HELP googi_http_request_latency_p99_ms P99 HTTP request latency in ms',
        f'# TYPE googi_http_request_latency_p99_ms gauge',
        f'googi_http_request_latency_p99_ms {data["request_latency_p99_ms"]}',
        
        f'# HELP googi_rabbitmq_queue_depth RabbitMQ queue depth',
        f'# TYPE googi_rabbitmq_queue_depth gauge',
        f'googi_rabbitmq_queue_depth{{queue="documents"}} {q_depth}',
        
        f'# HELP googi_documents_processed_total Total documents successfully processed',
        f'# TYPE googi_documents_processed_total counter',
        f'googi_documents_processed_total {data["documents_processed"]}',
        
        f'# HELP googi_documents_failed_total Total documents failed in processing',
        f'# TYPE googi_documents_failed_total counter',
        f'googi_documents_failed_total {data["documents_failed"]}',
        
        f'# HELP googi_agent_latency_seconds Average agent processing latency in seconds',
        f'# TYPE googi_agent_latency_seconds gauge',
    ] + agent_lines
    
    return "\n".join(lines)
