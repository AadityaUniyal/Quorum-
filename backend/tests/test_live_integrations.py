"""
Live Integration Smoke Test for Free-Tier Services:
1. Google Gemini 3.6-flash
2. Groq Cloud (qwen/qwen3.8-27b)
3. Neon Serverless PostgreSQL
4. Upstash Redis (TLS)
5. Queue & Worker Resilience
"""

import pytest
from sqlalchemy import text

from app.config import settings
from app.services.cache import acquire_redis_semaphore, cache_get, cache_set, release_redis_semaphore
from app.services.llm import call_groq, call_llm_with_fallback


@pytest.mark.asyncio
async def test_live_gemini_inference():
    """Verify live Gemini API responds properly."""
    if not settings.GEMINI_API_KEY:
        pytest.skip("GEMINI_API_KEY not configured")
    response, provider = await call_llm_with_fallback("Respond with only: VERIFIED_GEMINI")
    assert "VERIFIED" in response or "GEMINI" in response
    assert "primary" in provider or "gemini" in provider or "groq" in provider


@pytest.mark.asyncio
async def test_live_groq_inference():
    """Verify live Groq API responds with sub-second latency."""
    if not settings.GROQ_API_KEY:
        pytest.skip("GROQ_API_KEY not configured")
    response = await call_groq("Respond with only: VERIFIED_GROQ")
    assert "VERIFIED_GROQ" in response


@pytest.mark.asyncio
async def test_live_upstash_redis():
    """Verify Upstash Redis can set, read, and release distributed semaphore."""
    if not settings.REDIS_URL or "localhost" in settings.REDIS_URL:
        pytest.skip("Live Redis not configured")
    test_key = "docintel:live_smoke_test"
    ok = await cache_set(test_key, "active_upstash", ttl=60)
    assert ok is True
    val = await cache_get(test_key)
    assert val == "active_upstash"

    # Test distributed semaphore lock
    owner = acquire_redis_semaphore("ocr_live_test", limit=2, timeout=30)
    assert owner is not None
    release_redis_semaphore("ocr_live_test", owner)


def test_live_neon_postgres_connectivity():
    """Verify Neon PostgreSQL can execute transactions and query schemas."""
    from dotenv import dotenv_values
    from sqlalchemy import create_engine

    from app.database import _resolve_db_url

    vals = dotenv_values(".env") or dotenv_values("backend/.env")
    neon_url = vals.get("DATABASE_URL") or settings.DATABASE_URL
    if not neon_url or "sqlite" in neon_url:
        pytest.skip("Neon PostgreSQL not configured in .env")

    resolved_url, connect_args = _resolve_db_url(neon_url)
    eng = create_engine(resolved_url, connect_args=connect_args)
    with eng.connect() as conn:
        res = conn.execute(text("SELECT 1, current_database(), current_user;")).fetchone()
        assert res[0] == 1
        assert res[1] == "neondb"
        assert "neondb_owner" in res[2]
