"""
DocIntel AI Platform - E2E Common Test Fixtures & Context Setup.

Provides reusable Pytest fixtures and context state management for E2E testing:
- e2e_client: Opaque-box E2E HTTP client wrapper
- authenticated_client: Pre-logged-in client instance with HttpOnly cookies
- e2e_context: Test execution context and environment settings
- sample_sitemap_xml: Valid sitemap XML fixture
- sample_search_query: Search query fixture
- sample_bookmark_data: Search bookmark fixture payload
"""

from dataclasses import dataclass, field
from typing import Any, Dict, Generator, Optional

try:
    import pytest
except ImportError:
    # Decorator fallback when pytest is used via custom runner
    class PytestMock:
        def fixture(self, *args, **kwargs):
            def decorator(func):
                return func
            return decorator
    pytest = PytestMock()

from tests.e2e.infra.client import E2EClient


@dataclass
class E2ETestContext:
    """Encapsulates E2E test execution context and environment parameters."""
    base_url: str = "http://localhost:8000"
    force_mock: bool = True
    test_username: str = "e2e_test_user"
    test_password: str = "StrongP@ssw0rd2026!#Secure"
    test_email: str = "e2e_user@docintel.ai"
    metadata: Dict[str, Any] = field(default_factory=dict)


@pytest.fixture
def e2e_context() -> E2ETestContext:
    """Fixture providing E2E test configuration context."""
    return E2ETestContext()


@pytest.fixture
def e2e_client(e2e_context: E2ETestContext) -> E2EClient:
    """Fixture providing an unauthenticated E2E API client."""
    client = E2EClient(base_url=e2e_context.base_url, force_mock=e2e_context.force_mock)
    return client


@pytest.fixture
def authenticated_client(e2e_context: E2ETestContext) -> E2EClient:
    """Fixture providing a pre-authenticated E2E API client with HttpOnly cookies."""
    client = E2EClient(base_url=e2e_context.base_url, force_mock=e2e_context.force_mock)
    client.register(
        username=e2e_context.test_username,
        email=e2e_context.test_email,
        password=e2e_context.test_password
    )
    client.login(username=e2e_context.test_username, password=e2e_context.test_password)
    return client


SAMPLE_SITEMAP_XML = (
    '<?xml version="1.0" encoding="UTF-8"?>\n'
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    '  <url>\n'
    '    <loc>https://docintel.ai/</loc>\n'
    '    <lastmod>2026-08-13</lastmod>\n'
    '    <changefreq>daily</changefreq>\n'
    '    <priority>1.0</priority>\n'
    '  </url>\n'
    '  <url>\n'
    '    <loc>https://docintel.ai/docs/api</loc>\n'
    '    <lastmod>2026-08-12</lastmod>\n'
    '    <changefreq>weekly</changefreq>\n'
    '    <priority>0.8</priority>\n'
    '  </url>\n'
    '</urlset>'
)


@pytest.fixture
def sample_sitemap_xml() -> str:
    """Fixture providing a standard valid sitemap.xml payload."""
    return SAMPLE_SITEMAP_XML


@pytest.fixture
def sample_search_query() -> str:
    """Fixture providing a sample search query for expansion and search tests."""
    return "DocIntel AI authentication security architecture"


@pytest.fixture
def sample_bookmark_data() -> Dict[str, Any]:
    """Fixture providing search bookmark creation payload."""
    return {
        "query": "DocIntel AI authentication security architecture",
        "title": "Auth Architecture Research",
        "tags": ["security", "auth", "httpOnly"]
    }
