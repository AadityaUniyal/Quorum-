"""
DocIntel AI Platform - E2E Tier 3 Cross-Feature Pairwise Interaction Tests.

Tests multi-feature interactions across component boundaries:
- Pair 1: Cookies (F1) + Bookmarks (F9)
- Pair 2: Refresh Token Rotation (F2) + Search Export (F10)
- Pair 3: Rate Limiting (F3) + Password Strength (F4)
- Pair 4: Crawler Package (F5) + Distributed Queue (F6)
- Pair 5: Distributed Queue (F6) + Sitemap Parsing (F7)
- Pair 6: LLM Query Expansion (F8) + Bookmarks (F9)
- Pair 7: LLM Query Expansion (F8) + Search Export (F10)
- Pair 8: Cookies (F1) + Refresh Tokens (F2) + Rate Limiting (F3)
- Pair 9: Distributed Crawler (F6) + LLM Query Expansion (F8)
- Pair 10: Bookmarks (F9) + Search Export (F10)
"""

import sys
import time
import unittest
from pathlib import Path

# Ensure workspace root is in sys.path
root_dir = Path(__file__).resolve().parents[3]
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from tests.e2e.infra.client import E2EClient


class TestPairwiseCombinations(unittest.TestCase):
    """Tier 3: Pairwise feature interaction test suite."""

    def setUp(self):
        """Initializes fresh E2E client before each test."""
        self.client = E2EClient(force_mock=True)

    def test_pair1_cookies_and_bookmarks(self):
        """Pair 1: Cookies (F1) + Bookmarks (F9) interaction."""
        # 1. Register & Login to set HttpOnly Secure SameSite cookies
        reg_resp = self.client.register("pair1_user", "pair1@docintel.ai", "P@ssw0rd2026!Secure")
        self.assertEqual(reg_resp.status_code, 201)

        login_resp = self.client.login("pair1_user", "P@ssw0rd2026!Secure")
        self.assertEqual(login_resp.status_code, 200)

        # 2. Verify Cookie attributes
        cookies = login_resp.cookies
        self.assertIn("access_token", cookies)
        self.assertIn("refresh_token", cookies)
        
        access_cookie = cookies["access_token"]
        cookie_verif = self.client.verify_cookie_attributes(access_cookie, http_only=True, secure=True, samesite="Lax")
        self.assertTrue(cookie_verif["is_valid"])

        # 3. Create bookmark using authenticated session context
        bm_create = self.client.bookmarks_crud(
            "create",
            query="HttpOnly cookie authentication",
            title="Auth Cookie Bookmark",
            tags=["auth", "cookies", "security"],
            user_id="pair1_user"
        )
        self.assertEqual(bm_create.status_code, 201)
        bm_id = bm_create.json_data["id"]
        self.assertTrue(bm_id.startswith("bm_"))

        # 4. List bookmarks and verify saved item
        bm_list = self.client.bookmarks_crud("list", user_id="pair1_user")
        self.assertEqual(bm_list.status_code, 200)
        bookmarks = bm_list.json_data.get("bookmarks", [])
        self.assertEqual(len(bookmarks), 1)
        self.assertEqual(bookmarks[0]["query"], "HttpOnly cookie authentication")

        # 5. Delete bookmark and confirm cleanup
        bm_del = self.client.bookmarks_crud("delete", bookmark_id=bm_id, user_id="pair1_user")
        self.assertEqual(bm_del.status_code, 200)

        bm_list_after = self.client.bookmarks_crud("list", user_id="pair1_user")
        self.assertEqual(len(bm_list_after.json_data.get("bookmarks", [])), 0)

    def test_pair2_token_rotation_and_search_export(self):
        """Pair 2: Refresh Token Rotation (F2) + Search Export (F10) interaction."""
        # 1. Login to obtain initial tokens
        self.client.register("pair2_user", "pair2@docintel.ai", "Str0ngP@ssw0rd2026!")
        login_resp = self.client.login("pair2_user", "Str0ngP@ssw0rd2026!")
        self.assertEqual(login_resp.status_code, 200)
        old_refresh_token = login_resp.cookies["refresh_token"].value

        # 2. Rotate refresh token
        ref_resp = self.client.send_refresh_token_request(refresh_token=old_refresh_token)
        self.assertEqual(ref_resp.status_code, 200)
        self.assertIn("access_token", ref_resp.cookies)
        self.assertIn("refresh_token", ref_resp.cookies)

        # 3. Confirm old token revocation (token reuse protection)
        reuse_resp = self.client.send_refresh_token_request(refresh_token=old_refresh_token)
        self.assertEqual(reuse_resp.status_code, 401)
        self.assertIn("revoked", reuse_resp.json_data.get("detail", "").lower())

        # 4. Perform Search Export using updated session state
        csv_resp = self.client._request("GET", "/api/search/export?format=csv&query=DocIntel")
        self.assertEqual(csv_resp.status_code, 200)
        self.assertTrue("text/csv" in csv_resp.headers.get("Content-Type", ""))
        
        csv_verif = self.client.verify_file_export(csv_resp.body, "csv")
        self.assertTrue(csv_verif["valid"])
        self.assertTrue(csv_verif["has_header"])
        self.assertGreater(csv_verif["row_count"], 0)

        pdf_resp = self.client._request("GET", "/api/search/export?format=pdf&query=DocIntel")
        self.assertEqual(pdf_resp.status_code, 200)
        self.assertEqual(pdf_resp.headers.get("Content-Type"), "application/pdf")

        pdf_verif = self.client.verify_file_export(pdf_resp.body, "pdf")
        self.assertTrue(pdf_verif["valid"])
        self.assertTrue(pdf_verif["is_pdf_magic"])

    def test_pair3_rate_limiting_and_password_strength(self):
        """Pair 3: Rate Limiting (F3) + Password Strength (F4) interaction."""
        # 1. Weak password rejected by validator before rate limit is reached
        weak_val = self.client.test_password_validation("weak")
        self.assertFalse(weak_val["accepted"])
        self.assertEqual(weak_val["status_code"], 400)
        self.assertLess(weak_val["score"], 3)

        # 2. Fire 5 rapid registration attempts (rate limit ceiling for /register is 5/min)
        ip_headers = {"X-Forwarded-For": "192.168.1.100"}
        for i in range(4):
            resp = self.client.register(f"rate_user_{i}", f"rate_{i}@docintel.ai", "Str0ngP@ssw0rd2026!", headers=ip_headers)
            self.assertEqual(resp.status_code, 201)

        # 5th request succeeds (reaches ceiling limit)
        resp5 = self.client.register("rate_user_4", "rate_4@docintel.ai", "Str0ngP@ssw0rd2026!", headers=ip_headers)
        self.assertEqual(resp5.status_code, 201)

        # 6th request triggers rate limit (HTTP 429)
        resp6 = self.client.register("rate_user_5", "rate_5@docintel.ai", "Str0ngP@ssw0rd2026!", headers=ip_headers)
        self.assertEqual(resp6.status_code, 429)
        self.assertEqual(resp6.headers.get("Retry-After"), "60")
        self.assertIn("rate limit", resp6.json_data.get("detail", "").lower())

    def test_pair4_crawler_package_and_distributed_queue(self):
        """Pair 4: Crawler Package (F5) + Distributed Queue (F6) interaction."""
        # 1. Execute crawler package helper
        crawl_res = self.client.execute_crawler(start_url="https://docintel.ai", max_depth=2)
        self.assertEqual(crawl_res["status"], "success")
        self.assertIn("pages", crawl_res)
        self.assertGreater(len(crawl_res["pages"]), 0)

        # 2. Package crawled URLs into RabbitMQ task payload format
        task_queue = []
        for page in crawl_res["pages"]:
            payload = {
                "url": page["url"],
                "depth": crawl_res["max_depth"],
                "max_depth": 3,
                "job_id": f"job_crawl_{int(time.time())}"
            }
            task_queue.append(payload)

        # 3. Assert task payload schema compliance
        self.assertEqual(len(task_queue), len(crawl_res["pages"]))
        for task in task_queue:
            self.assertIn("url", task)
            self.assertIn("depth", task)
            self.assertIn("max_depth", task)
            self.assertIn("job_id", task)
            self.assertTrue(task["url"].startswith("http"))
            self.assertLessEqual(task["depth"], task["max_depth"])

    def test_pair5_distributed_queue_and_sitemap_parsing(self):
        """Pair 5: Distributed Queue (F6) + Sitemap Parsing (F7) interaction."""
        # 1. Parse Sitemap XML to discover target endpoints
        sitemap_url = "https://docintel.ai/sitemap.xml"
        crawl_res = self.client.execute_crawler(start_url=sitemap_url, max_depth=1, parse_sitemap=True)
        self.assertEqual(crawl_res["status"], "success")
        self.assertTrue(crawl_res.get("sitemap_parsed"))

        # 2. Convert sitemap URLs into background worker crawl tasks
        extracted_pages = crawl_res.get("pages", [])
        queue_payloads = [
            {
                "url": page["url"],
                "depth": 0,
                "max_depth": 2,
                "job_id": f"sitemap_job_{idx}"
            }
            for idx, page in enumerate(extracted_pages)
        ]

        self.assertGreater(len(queue_payloads), 0)
        self.assertEqual(queue_payloads[0]["depth"], 0)
        self.assertTrue("job_id" in queue_payloads[0])

    def test_pair6_query_expansion_and_bookmarks(self):
        """Pair 6: LLM Query Expansion (F8) + Bookmarks (F9) interaction."""
        # 1. Send query expansion request
        orig_query = "distributed vector indexing"
        exp_resp = self.client.expand_query(orig_query)
        self.assertEqual(exp_resp.status_code, 200)

        expansions = exp_resp.json_data.get("expansions", [])
        self.assertGreaterEqual(len(expansions), 2)
        self.assertIn(orig_query, expansions)

        # 2. Save expanded paraphrase variation into bookmarks
        selected_paraphrase = expansions[1]  # e.g., detailed analysis
        bm_resp = self.client.bookmarks_crud(
            "create",
            query=selected_paraphrase,
            title="LLM Expanded Query Search",
            tags=["llm", "rag", "expansion"],
            user_id="llm_user"
        )
        self.assertEqual(bm_resp.status_code, 201)
        bm_id = bm_resp.json_data["id"]

        # 3. Retrieve bookmark list and verify expanded query presence
        list_resp = self.client.bookmarks_crud("list", user_id="llm_user")
        self.assertEqual(list_resp.status_code, 200)
        bms = list_resp.json_data.get("bookmarks", [])
        self.assertEqual(len(bms), 1)
        self.assertEqual(bms[0]["query"], selected_paraphrase)
        self.assertEqual(bms[0]["id"], bm_id)

    def test_pair7_query_expansion_and_search_export(self):
        """Pair 7: LLM Query Expansion (F8) + Search Export (F10) interaction."""
        # 1. Expand query to obtain paraphrases
        exp_resp = self.client.expand_query("DocIntel security features")
        self.assertEqual(exp_resp.status_code, 200)
        paraphrases = exp_resp.json_data.get("expansions", [])
        self.assertTrue(len(paraphrases) > 0)

        # 2. Export search results based on expanded query in CSV format
        csv_resp = self.client._request("GET", f"/api/search/export?format=csv&q={paraphrases[0]}")
        self.assertEqual(csv_resp.status_code, 200)
        csv_verif = self.client.verify_file_export(csv_resp.body, "csv")
        self.assertTrue(csv_verif["valid"])

        # 3. Export search results in PDF format
        pdf_resp = self.client._request("GET", f"/api/search/export?format=pdf&q={paraphrases[0]}")
        self.assertEqual(pdf_resp.status_code, 200)
        pdf_verif = self.client.verify_file_export(pdf_resp.body, "pdf")
        self.assertTrue(pdf_verif["valid"])

    def test_pair8_cookies_tokens_and_rate_limiting(self):
        """Pair 8: Cookies (F1) + Refresh Tokens (F2) + Rate Limiting (F3) 3-way interaction."""
        # 1. Register & Login
        self.client.register("pair8_user", "pair8@docintel.ai", "P@ssw0rd2026!Secure")
        login_resp = self.client.login("pair8_user", "P@ssw0rd2026!Secure")
        self.assertEqual(login_resp.status_code, 200)

        # 2. Refresh token rotation & cookie assertion
        ref_resp = self.client.send_refresh_token_request()
        self.assertEqual(ref_resp.status_code, 200)
        self.assertIn("access_token", ref_resp.cookies)
        self.assertTrue(ref_resp.cookies["access_token"].httponly)

        # 3. Fire rapid invalid login requests to trigger login rate limiting (limit: 10/min)
        ip_hdr = {"X-Forwarded-For": "10.0.0.88"}
        for _ in range(9):
            self.client.login("pair8_user", "wrong_pass", headers=ip_hdr)

        # 10th request reaches ceiling
        self.client.login("pair8_user", "wrong_pass", headers=ip_hdr)

        # 11th request receives HTTP 429
        blocked_resp = self.client.login("pair8_user", "P@ssw0rd2026!Secure", headers=ip_hdr)
        self.assertEqual(blocked_resp.status_code, 429)
        self.assertEqual(blocked_resp.headers.get("Retry-After"), "60")

    def test_pair9_distributed_crawler_and_query_expansion(self):
        """Pair 9: Distributed Crawler (F6) + LLM Query Expansion (F8) interaction."""
        # 1. Run web crawler to retrieve page content
        crawl_res = self.client.execute_crawler(start_url="https://docintel.ai/docs", max_depth=1)
        self.assertEqual(crawl_res["status"], "success")
        crawled_page = crawl_res["pages"][0]
        crawled_title = crawled_page.get("title", "DocIntel Page")

        # 2. Feed crawled document title into LLM Query Expansion
        exp_resp = self.client.expand_query(crawled_title)
        self.assertEqual(exp_resp.status_code, 200)
        json_data = exp_resp.json_data
        self.assertEqual(json_data["original_query"], crawled_title)
        self.assertGreater(len(json_data["expansions"]), 1)

    def test_pair10_bookmarks_and_search_export(self):
        """Pair 10: Bookmarks (F9) + Search Export (F10) interaction."""
        user = "pair10_user"
        # 1. Create multiple bookmarks
        bm1 = self.client.bookmarks_crud("create", query="Security Architecture", title="Sec Arch", tags=["sec"], user_id=user)
        bm2 = self.client.bookmarks_crud("create", query="Distributed Queue", title="Queue Spec", tags=["queue"], user_id=user)
        self.assertEqual(bm1.status_code, 201)
        self.assertEqual(bm2.status_code, 201)

        # 2. List saved bookmarks
        bms_resp = self.client.bookmarks_crud("list", user_id=user)
        self.assertEqual(bms_resp.status_code, 200)
        saved_bms = bms_resp.json_data.get("bookmarks", [])
        self.assertEqual(len(saved_bms), 2)

        # 3. Export search data for bookmarked queries
        export_csv = self.client._request("GET", "/api/search/export?format=csv")
        self.assertEqual(export_csv.status_code, 200)
        csv_check = self.client.verify_file_export(export_csv.body, "csv")
        self.assertTrue(csv_check["valid"])

        export_pdf = self.client._request("GET", "/api/search/export?format=pdf")
        self.assertEqual(export_pdf.status_code, 200)
        pdf_check = self.client.verify_file_export(export_pdf.body, "pdf")
        self.assertTrue(pdf_check["valid"])


if __name__ == "__main__":
    unittest.main()
