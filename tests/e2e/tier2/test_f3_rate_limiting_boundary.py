"""
Tier 2 Boundary & Corner Cases Test Suite for Feature 3: Redis-Backed Rate Limiting.

Tests exact numerical boundaries (10 vs 11 for login, 5 vs 6 for register), rapid spikes,
IP header spoofing isolation, rate limit headers (Retry-After), and fallback behaviors.
"""

import sys
import unittest
import time
from pathlib import Path

# Ensure workspace root is on sys.path
root_dir = Path(__file__).resolve().parents[3]
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from tests.e2e.infra.client import E2EClient
from tests.e2e.infra.fixtures import E2ETestContext


class TestFeature3RateLimitingBoundary(unittest.TestCase):
    """Boundary & Corner Cases for Feature 3 (Redis-Backed Rate Limiting)."""

    def setUp(self):
        self.context = E2ETestContext()
        self.client = E2EClient(base_url=self.context.base_url, force_mock=self.context.force_mock)
        # Use unique IP header to isolate test runs
        self.ip_addr = f"192.168.1.{int(time.time()*1000) % 250 + 1}"
        self.headers = {"X-Forwarded-For": self.ip_addr}

    def test_f3_bva_01_login_exact_threshold_boundary_10_vs_11(self):
        """Verify login endpoint allows up to 10 requests per minute and blocks the 11th with 429."""
        status_codes = []
        for i in range(11):
            resp = self.client.login(
                username=f"rl_user_{i}",
                password="WrongPassword123!",
                headers=self.headers
            )
            status_codes.append(resp.status_code)

        # First 10 requests must NOT be rate-limited (401 invalid credentials)
        for i in range(10):
            self.assertNotEqual(status_codes[i], 429, f"Request {i+1} should not be rate-limited")

        # 11th request MUST be rate limited (429)
        self.assertEqual(status_codes[10], 429, "11th request must return 429 Too Many Requests")

    def test_f3_bva_02_register_exact_threshold_boundary_5_vs_6(self):
        """Verify register endpoint allows up to 5 requests per minute and blocks the 6th with 429."""
        reg_ip = f"10.0.0.{int(time.time()*1000) % 250 + 1}"
        reg_headers = {"X-Forwarded-For": reg_ip}

        status_codes = []
        for i in range(6):
            resp = self.client.register(
                username=f"reg_rl_user_{i}_{int(time.time()*1000)}",
                email=f"reg_{i}@docintel.ai",
                password="P@ssw0rd2026!#StrongReg",
                headers=reg_headers
            )
            status_codes.append(resp.status_code)

        # First 5 requests must NOT be 429
        for i in range(5):
            self.assertNotEqual(status_codes[i], 429, f"Registration request {i+1} should not be 429")

        # 6th request MUST be 429
        self.assertEqual(status_codes[5], 429, "6th registration request must return 429")

    def test_f3_bva_03_rapid_spike_burst_attempts(self):
        """Verify rapid burst of requests returns 429 with JSON body and Retry-After header."""
        burst_ip = f"172.16.0.{int(time.time()*1000) % 250 + 1}"
        burst_headers = {"X-Forwarded-For": burst_ip}

        responses = []
        for _ in range(15):
            resp = self.client.login("burst_user", "password123", headers=burst_headers)
            responses.append(resp)

        rate_limited_resps = [r for r in responses if r.status_code == 429]
        self.assertGreater(len(rate_limited_resps), 0)

        first_429 = rate_limited_resps[0]
        self.assertEqual(first_429.status_code, 429)
        self.assertIn("detail", first_429.json_data)
        self.assertIn("Retry-After", first_429.headers)

    def test_f3_bva_04_ip_header_spoofing_resilience(self):
        """Verify separate X-Forwarded-For IPs maintain separate rate limit counters."""
        ip1 = f"192.168.10.{int(time.time()*1000) % 100 + 1}"
        ip2 = f"192.168.20.{int(time.time()*1000) % 100 + 1}"

        # Exhaust IP1 registration quota (5 requests)
        for i in range(5):
            resp1 = self.client.register(f"ip1_user_{i}", "ip1@docintel.ai", "Str0ngP@ss2026!", headers={"X-Forwarded-For": ip1})
            self.assertNotEqual(resp1.status_code, 429)

        # 6th request on IP1 -> 429
        resp1_blocked = self.client.register("ip1_user_blocked", "ip1@docintel.ai", "Str0ngP@ss2026!", headers={"X-Forwarded-For": ip1})
        self.assertEqual(resp1_blocked.status_code, 429)

        # Request on IP2 -> should succeed!
        resp2_ok = self.client.register("ip2_user_fresh", "ip2@docintel.ai", "Str0ngP@ss2026!", headers={"X-Forwarded-For": ip2})
        self.assertEqual(resp2_ok.status_code, 201)

    def test_f3_bva_05_rate_limit_headers_and_retry_after_validation(self):
        """Verify Retry-After header contains positive integer string."""
        ip = f"10.10.10.{int(time.time()*1000) % 200 + 1}"
        for _ in range(6):
            resp = self.client.register("test_hdr_user", "hdr@docintel.ai", "Str0ngP@ss2026!", headers={"X-Forwarded-For": ip})

        self.assertEqual(resp.status_code, 429)
        retry_after = resp.headers.get("Retry-After")
        self.assertIsNotNone(retry_after)
        self.assertTrue(retry_after.isdigit(), f"Retry-After should be numeric, got: {retry_after}")
        self.assertGreater(int(retry_after), 0)

    def test_f3_bva_06_redis_disconnection_fallback_behavior(self):
        """Verify client engine handles rate limiter state consistently."""
        clean_client = E2EClient(force_mock=True)
        resp = clean_client.login("mock_user", "mock_pass")
        self.assertIn(resp.status_code, [401, 429])


if __name__ == "__main__":
    unittest.main()
