"""
Tier 1 Feature 3: Redis-Backed Rate Limiting Test Suite.
Verifies rate limiting on /login (10/min) and /register (5/min) endpoints.
"""

import sys
import unittest
from pathlib import Path

# Ensure workspace root is in sys.path
root_dir = Path(__file__).resolve().parents[3]
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from tests.e2e.infra.client import E2EClient
from tests.e2e.infra.fixtures import E2ETestContext


class TestFeature3RateLimiting(unittest.TestCase):
    """Test case suite for Feature 3: Redis-Backed Rate Limiting."""

    def setUp(self):
        self.context = E2ETestContext()
        self.client = E2EClient(base_url=self.context.base_url, force_mock=self.context.force_mock)

    def test_f3_01_register_within_rate_limit_succeeds(self):
        """Verify registration attempts within the 5 req/min rate limit proceed normally."""
        custom_headers = {"X-Forwarded-For": "192.168.1.10"}
        for i in range(5):
            resp = self.client.register(
                username=f"ratelimit_reg_{i}",
                email=f"ratelimit_{i}@docintel.ai",
                password="P@ssw0rd2026!#RateLimit",
                headers=custom_headers
            )
            # Response should either succeed (201) or report user error, but not rate limited (429)
            self.assertNotEqual(resp.status_code, 429, f"Attempt {i+1} was unexpectedly rate limited")

    def test_f3_02_register_exceeding_rate_limit_returns_429(self):
        """Verify that sending more than 5 registration attempts triggers HTTP 429."""
        custom_headers = {"X-Forwarded-For": "192.168.1.20"}
        responses = []
        for i in range(6):
            resp = self.client.register(
                username=f"reg_exceed_{i}",
                email=f"reg_exceed_{i}@docintel.ai",
                password="P@ssw0rd2026!#RateLimitExceed",
                headers=custom_headers
            )
            responses.append(resp)

        last_resp = responses[-1]
        self.assertEqual(last_resp.status_code, 429, "6th registration request must return HTTP 429 Too Many Requests")

    def test_f3_03_login_within_rate_limit_succeeds(self):
        """Verify login attempts within the 10 req/min rate limit proceed normally."""
        custom_headers = {"X-Forwarded-For": "192.168.1.30"}
        for i in range(10):
            resp = self.client.login(
                username="nonexistent_user",
                password="P@ssw0rd2026!#LoginRateLimit",
                headers=custom_headers
            )
            self.assertNotEqual(resp.status_code, 429, f"Login attempt {i+1} was unexpectedly rate limited")

    def test_f3_04_login_exceeding_rate_limit_returns_429(self):
        """Verify that sending more than 10 login attempts triggers HTTP 429."""
        custom_headers = {"X-Forwarded-For": "192.168.1.40"}
        responses = []
        for i in range(11):
            resp = self.client.login(
                username="flood_user",
                password="P@ssw0rd2026!#LoginFlood",
                headers=custom_headers
            )
            responses.append(resp)

        last_resp = responses[-1]
        self.assertEqual(last_resp.status_code, 429, "11th login request must return HTTP 429 Too Many Requests")

    def test_f3_05_rate_limit_429_response_headers(self):
        """Verify that 429 Too Many Requests response includes Retry-After header or json detail."""
        custom_headers = {"X-Forwarded-For": "192.168.1.50"}
        for _ in range(6):
            resp = self.client.register(
                username="hdr_user",
                email="hdr@docintel.ai",
                password="P@ssw0rd2026!#HdrLimit",
                headers=custom_headers
            )
        self.assertEqual(resp.status_code, 429)
        self.assertTrue(
            "Retry-After" in resp.headers or "detail" in (resp.json_data or {}),
            "429 response should include Retry-After header or json error detail"
        )

    def test_f3_06_rate_limit_isolation_per_client_ip(self):
        """Verify rate limiting is isolated per client IP address."""
        ip1_headers = {"X-Forwarded-For": "192.168.1.61"}
        ip2_headers = {"X-Forwarded-For": "192.168.1.62"}

        # Exceed rate limit for IP 1
        for _ in range(6):
            self.client.register("user_ip1", "ip1@docintel.ai", "P@ssw0rd2026!#IP1", headers=ip1_headers)

        # IP 1 should be rate limited
        resp_ip1 = self.client.register("user_ip1_again", "ip1_again@docintel.ai", "P@ssw0rd2026!#IP1", headers=ip1_headers)
        self.assertEqual(resp_ip1.status_code, 429)

        # IP 2 should NOT be rate limited
        resp_ip2 = self.client.register("user_ip2", "ip2@docintel.ai", "P@ssw0rd2026!#IP2", headers=ip2_headers)
        self.assertNotEqual(resp_ip2.status_code, 429)


if __name__ == "__main__":
    unittest.main()
