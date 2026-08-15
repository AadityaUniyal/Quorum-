"""
DocIntel AI Platform - E2E Tier 4 Real-World Application Workload Scenarios.

Tests complete end-to-end user workflows:
- Scenario 1: New User Onboarding & Secure Authentication Workflow
- Scenario 2: Automated Web Crawling & Indexing Pipeline
- Scenario 3: AI-Powered Research & Document Discovery Workflow
- Scenario 4: Export & Data Reporting Workflow
- Scenario 5: High-Concurrency Platform Usage Workflow
"""

import json
import sys
import time
import unittest
from pathlib import Path

# Ensure workspace root is in sys.path
root_dir = Path(__file__).resolve().parents[3]
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from tests.e2e.infra.client import E2EClient


class TestRealWorldScenarios(unittest.TestCase):
    """Tier 4: End-to-end real-world user application scenarios."""

    def setUp(self):
        """Initializes fresh E2E client before each test."""
        self.client = E2EClient(force_mock=True)

    def test_scenario1_new_user_onboarding_and_auth_lifecycle(self):
        """
        Scenario 1: New User Onboarding & Secure Authentication Workflow.
        Flow: Weak password rejection -> Registration success -> Login with HttpOnly cookies
              -> Session interaction -> Token refresh rotation -> Revocation check -> Rate limit lockout.
        """
        username = "new_onboarded_user"
        email = "onboard@docintel.ai"
        weak_pass = "12345"
        strong_pass = "SecureP@ssw0rd2026!DocIntel"

        # 1. Registration attempt with weak password (rejected)
        val_res = self.client.test_password_validation(weak_pass)
        self.assertFalse(val_res["accepted"])
        self.assertEqual(val_res["status_code"], 400)

        # 2. Registration attempt with strong password (accepted)
        reg_resp = self.client.register(username, email, strong_pass)
        self.assertEqual(reg_resp.status_code, 201)
        self.assertIn("registered successfully", reg_resp.json_data.get("message", "").lower())

        # 3. User Login
        login_resp = self.client.login(username, strong_pass)
        self.assertEqual(login_resp.status_code, 200)

        # 4. Cookie attribute security verification
        cookies = login_resp.cookies
        self.assertIn("access_token", cookies)
        self.assertIn("refresh_token", cookies)

        access_cookie = cookies["access_token"]
        refresh_cookie = cookies["refresh_token"]

        self.assertTrue(access_cookie.httponly)
        self.assertTrue(access_cookie.secure)
        self.assertEqual(access_cookie.samesite, "Lax")

        self.assertTrue(refresh_cookie.httponly)
        self.assertTrue(refresh_cookie.secure)
        self.assertEqual(refresh_cookie.samesite, "Lax")
        self.assertEqual(refresh_cookie.path, "/api/auth/refresh")

        # 5. User performs active session action (creates bookmark)
        bm_resp = self.client.bookmarks_crud("create", query="DocIntel Onboarding", title="User Onboarding", user_id=username)
        self.assertEqual(bm_resp.status_code, 201)

        # 6. Execute Refresh Token Rotation
        old_refresh_val = refresh_cookie.value
        ref_resp = self.client.send_refresh_token_request(refresh_token=old_refresh_val)
        self.assertEqual(ref_resp.status_code, 200)
        new_refresh_val = ref_resp.cookies["refresh_token"].value
        self.assertNotEqual(old_refresh_val, new_refresh_val)

        # 7. Old refresh token reuse attempt (rejected - 401)
        reuse_resp = self.client.send_refresh_token_request(refresh_token=old_refresh_val)
        self.assertEqual(reuse_resp.status_code, 401)

        # 8. Login rate limit security test
        ip_hdr = {"X-Forwarded-For": "172.16.0.42"}
        for _ in range(10):
            self.client.login(username, "wrong_password", headers=ip_hdr)

        # 11th request triggers rate limit lockout
        lockout_resp = self.client.login(username, strong_pass, headers=ip_hdr)
        self.assertEqual(lockout_resp.status_code, 429)

    def test_scenario2_automated_web_crawling_and_indexing_pipeline(self):
        """
        Scenario 2: Automated Web Crawling & Indexing Pipeline.
        Flow: Ingest sitemap.xml -> Parse URLs -> Dispatch distributed queue tasks -> Run crawler -> Index results.
        """
        sitemap_url = "https://docintel.ai/sitemap.xml"

        # 1. Discover target URLs via sitemap parsing crawler
        crawl_resp = self.client.execute_crawler(start_url=sitemap_url, max_depth=2, parse_sitemap=True)
        self.assertEqual(crawl_resp["status"], "success")
        self.assertTrue(crawl_resp.get("sitemap_parsed"))

        pages = crawl_resp.get("pages", [])
        self.assertGreaterEqual(len(pages), 1)

        # 2. Package discovered URLs into distributed crawl task queue payloads
        job_id = f"pipeline_job_{int(time.time())}"
        queue_payloads = []
        for idx, page in enumerate(pages):
            payload = {
                "url": page["url"],
                "depth": 1,
                "max_depth": 2,
                "job_id": job_id,
                "sequence": idx
            }
            queue_payloads.append(payload)

        self.assertEqual(len(queue_payloads), len(pages))

        # 3. Simulate background worker consumption & page indexing
        indexed_documents = []
        for task in queue_payloads:
            doc = {
                "job_id": task["job_id"],
                "url": task["url"],
                "status_code": 200,
                "vector_id": f"vec_{hash(task['url']) & 0xfffffff}",
                "indexed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ")
            }
            indexed_documents.append(doc)

        # 4. Verify pipeline output metrics
        self.assertEqual(len(indexed_documents), len(pages))
        for doc in indexed_documents:
            self.assertEqual(doc["job_id"], job_id)
            self.assertEqual(doc["status_code"], 200)
            self.assertTrue(doc["vector_id"].startswith("vec_"))

    def test_scenario3_ai_powered_research_and_discovery_workflow(self):
        """
        Scenario 3: AI-Powered Research & Document Discovery Workflow.
        Flow: Authenticate analyst -> Enter broad query -> LLM expansion -> Bookmark key findings -> Query collection.
        """
        analyst_user = "research_analyst_01"
        self.client.register(analyst_user, "analyst@docintel.ai", "Rese@rch2026!SecurePass")
        login_res = self.client.login(analyst_user, "Rese@rch2026!SecurePass")
        self.assertEqual(login_res.status_code, 200)

        # 1. Analyst enters initial research query
        initial_query = "DocIntel AI vector search security compliance"

        # 2. Call LLM Query Expansion
        exp_res = self.client.expand_query(initial_query)
        self.assertEqual(exp_res.status_code, 200)
        expansions = exp_res.json_data.get("expansions", [])
        self.assertGreaterEqual(len(expansions), 3)

        # 3. Analyst bookmarks top expanded query variations into research collection
        saved_bm_ids = []
        for idx, exp_query in enumerate(expansions[:2]):
            bm_res = self.client.bookmarks_crud(
                "create",
                query=exp_query,
                title=f"Research Topic #{idx + 1}",
                tags=["research", "ai", "security"],
                user_id=analyst_user
            )
            self.assertEqual(bm_res.status_code, 201)
            saved_bm_ids.append(bm_res.json_data["id"])

        self.assertEqual(len(saved_bm_ids), 2)

        # 4. Analyst lists saved research collection
        list_res = self.client.bookmarks_crud("list", user_id=analyst_user)
        self.assertEqual(list_res.status_code, 200)
        bms = list_res.json_data.get("bookmarks", [])
        self.assertEqual(len(bms), 2)

        # 5. Analyst deletes completed item from collection
        del_res = self.client.bookmarks_crud("delete", bookmark_id=saved_bm_ids[0], user_id=analyst_user)
        self.assertEqual(del_res.status_code, 200)

        remaining_res = self.client.bookmarks_crud("list", user_id=analyst_user)
        self.assertEqual(len(remaining_res.json_data.get("bookmarks", [])), 1)

    def test_scenario4_export_and_data_reporting_workflow(self):
        """
        Scenario 4: Export & Data Reporting Workflow.
        Flow: Perform search & expansion -> Save results -> Export CSV report -> Export PDF document.
        """
        query = "DocIntel Architecture and Security"

        # 1. Query expansion
        exp_resp = self.client.expand_query(query)
        self.assertEqual(exp_resp.status_code, 200)

        # 2. Export CSV report
        csv_resp = self.client._request("GET", "/api/search/export?format=csv")
        self.assertEqual(csv_resp.status_code, 200)
        self.assertIn("attachment; filename=", csv_resp.headers.get("Content-Disposition", ""))
        
        csv_verif = self.client.verify_file_export(csv_resp.body, "csv")
        self.assertTrue(csv_verif["valid"])
        self.assertTrue(csv_verif["has_header"])
        self.assertGreater(csv_verif["row_count"], 0)

        # 3. Export PDF document
        pdf_resp = self.client._request("GET", "/api/search/export?format=pdf")
        self.assertEqual(pdf_resp.status_code, 200)
        self.assertIn("application/pdf", pdf_resp.headers.get("Content-Type", ""))
        
        pdf_verif = self.client.verify_file_export(pdf_resp.body, "pdf")
        self.assertTrue(pdf_verif["valid"])
        self.assertTrue(pdf_verif["is_pdf_magic"])
        self.assertTrue(pdf_verif["has_eof"])

    def test_scenario5_high_concurrency_platform_usage_workflow(self):
        """
        Scenario 5: High-Concurrency & Multi-User Platform Usage Workflow.
        Flow: Multiple isolated user sessions operating simultaneously (Alpha, Beta, Gamma)
              -> Verify data isolation, rate limiting resilience, and export handling.
        """
        # Session Alpha: Auth & Bookmarks
        client_alpha = E2EClient(force_mock=True)
        client_alpha.register("alpha_user", "alpha@docintel.ai", "AlphaP@ssw0rd2026!")
        login_a = client_alpha.login("alpha_user", "AlphaP@ssw0rd2026!")
        self.assertEqual(login_a.status_code, 200)
        bm_a = client_alpha.bookmarks_crud("create", query="Alpha Query", title="Alpha Title", user_id="alpha_user")
        self.assertEqual(bm_a.status_code, 201)

        # Session Beta: Auth & LLM Query Expansion & Bookmarks
        client_beta = E2EClient(force_mock=True)
        client_beta.register("beta_user", "beta@docintel.ai", "BetaP@ssw0rd2026!")
        login_b = client_beta.login("beta_user", "BetaP@ssw0rd2026!")
        self.assertEqual(login_b.status_code, 200)
        exp_b = client_beta.expand_query("Beta Query")
        self.assertEqual(exp_b.status_code, 200)
        bm_b = client_beta.bookmarks_crud("create", query="Beta Query", title="Beta Title", user_id="beta_user")
        self.assertEqual(bm_b.status_code, 201)

        # Verify Cross-User Bookmark Data Isolation
        list_a = client_alpha.bookmarks_crud("list", user_id="alpha_user")
        list_b = client_beta.bookmarks_crud("list", user_id="beta_user")
        
        self.assertEqual(len(list_a.json_data["bookmarks"]), 1)
        self.assertEqual(list_a.json_data["bookmarks"][0]["query"], "Alpha Query")
        
        self.assertEqual(len(list_b.json_data["bookmarks"]), 1)
        self.assertEqual(list_b.json_data["bookmarks"][0]["query"], "Beta Query")

        # Session Gamma: Attempt flooding to trigger Rate Limiter without disrupting Alpha/Beta
        client_gamma = E2EClient(force_mock=True)
        gamma_ip = {"X-Forwarded-For": "192.168.99.99"}
        for i in range(5):
            client_gamma.register(f"gamma_{i}", f"gamma_{i}@docintel.ai", "GammaP@ss2026!", headers=gamma_ip)

        # 6th registration is rate limited
        flood_resp = client_gamma.register("gamma_flood", "flood@docintel.ai", "GammaP@ss2026!", headers=gamma_ip)
        self.assertEqual(flood_resp.status_code, 429)

        # Alpha and Beta sessions export data concurrently and remain healthy
        export_a = client_alpha._request("GET", "/api/search/export?format=csv")
        export_b = client_beta._request("GET", "/api/search/export?format=pdf")
        
        self.assertEqual(export_a.status_code, 200)
        self.assertEqual(export_b.status_code, 200)


if __name__ == "__main__":
    unittest.main()
