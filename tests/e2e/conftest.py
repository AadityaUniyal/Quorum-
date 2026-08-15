"""
Pytest configuration and top-level fixture loading for E2E test suite.
"""

from tests.e2e.infra.fixtures import (
    authenticated_client,
    e2e_client,
    e2e_context,
    sample_bookmark_data,
    sample_search_query,
    sample_sitemap_xml,
)

__all__ = [
    "e2e_context",
    "e2e_client",
    "authenticated_client",
    "sample_sitemap_xml",
    "sample_search_query",
    "sample_bookmark_data",
]
