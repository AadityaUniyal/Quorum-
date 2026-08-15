"""
DocIntel AI Platform - E2E Test Infrastructure Package.
Provides client helpers, fixture definitions, and verification utilities for E2E testing.
"""

from tests.e2e.infra.client import ApiResponse, E2EClient, E2EResponse
from tests.e2e.infra.fixtures import E2ETestContext

__all__ = ["ApiResponse", "E2EClient", "E2EResponse", "E2ETestContext"]
