"""
Tier 1 Feature Coverage: Feature 7 — Next.js Config Sanitization
Verifies next.config.ts sanitization: removal of invalid 'eslint' option,
removal of 'ignoreBuildErrors: true', and inclusion of /admin/:path* rewrite proxy.
"""

import pytest
from tests.e2e.helpers import read_frontend_file


@pytest.mark.tier(1)
@pytest.mark.feature(7)
@pytest.mark.milestone("M2")
class TestFeature07NextConfigSanitization:
    """Verifies that next.config.ts is clean of invalid options and properly proxies backend routes."""

    def test_f07_01_no_invalid_eslint_key(self):
        """Verify next.config.ts does not contain invalid 'eslint' top-level option."""
        content = read_frontend_file("next.config.ts")
        # Matches eslint: { ... } at top level
        assert "eslint:" not in content, "Invalid 'eslint' key must be removed from next.config.ts"

    def test_f07_02_no_ignore_build_errors(self):
        """Verify next.config.ts does not suppress type errors via ignoreBuildErrors: true."""
        content = read_frontend_file("next.config.ts")
        assert (
            "ignoreBuildErrors: true" not in content
        ), "typescript.ignoreBuildErrors must not be set to true in next.config.ts"

    def test_f07_03_admin_rewrite_proxy_configured(self):
        """Verify next.config.ts includes a rewrite rule for /admin/:path*."""
        content = read_frontend_file("next.config.ts")
        assert (
            "/admin/:path*" in content or "/admin/" in content
        ), "next.config.ts must include rewrite rule proxying /admin/:path* to backend"

    def test_f07_04_api_rewrite_proxy_configured(self):
        """Verify next.config.ts includes rewrite proxy for /api/:path*."""
        content = read_frontend_file("next.config.ts")
        assert (
            "/api/:path*" in content
        ), "next.config.ts must include rewrite rule proxying /api/:path* to backend"

    def test_f07_05_health_and_metrics_proxy_configured(self):
        """Verify next.config.ts rewrites /health and /metrics endpoints."""
        content = read_frontend_file("next.config.ts")
        assert (
            "/health" in content and "/metrics" in content
        ), "next.config.ts must proxy /health and /metrics observability endpoints"
