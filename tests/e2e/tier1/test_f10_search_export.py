"""
Tier 1 Feature 10: Search Results Export Test Suite.
Verifies exporting search results to CSV and PDF formats, HTTP headers, magic bytes, and schema validation.
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


class TestFeature10SearchExport(unittest.TestCase):
    """Test case suite for Feature 10: Search Results Export to CSV & PDF."""

    def setUp(self):
        self.context = E2ETestContext()
        self.client = E2EClient(base_url=self.context.base_url, force_mock=self.context.force_mock)

    def test_f10_01_export_csv_returns_200_and_content_type(self):
        """Verify GET /api/search/export?format=csv returns 200 OK and CSV content-type."""
        resp = self.client._request("GET", "/api/search/export?format=csv&query=security")
        self.assertEqual(resp.status_code, 200)
        content_type = resp.headers.get("Content-Type", "")
        self.assertIn("text/csv", content_type.lower())

    def test_f10_02_export_csv_headers_and_rows_valid(self):
        """Verify that CSV export contains valid CSV headers and data rows."""
        resp = self.client._request("GET", "/api/search/export?format=csv&query=architecture")
        self.assertEqual(resp.status_code, 200)
        csv_text = resp.text
        lines = [line for line in csv_text.strip().split("\n") if line.strip()]

        self.assertGreater(len(lines), 1, "CSV export must contain at least a header row and 1 data row")
        header = lines[0].lower()
        self.assertIn("query", header)
        self.assertIn("title", header)

    def test_f10_03_export_pdf_returns_200_and_content_type(self):
        """Verify GET /api/search/export?format=pdf returns 200 OK and PDF content-type."""
        resp = self.client._request("GET", "/api/search/export?format=pdf&query=security")
        self.assertEqual(resp.status_code, 200)
        content_type = resp.headers.get("Content-Type", "")
        self.assertIn("application/pdf", content_type.lower())

    def test_f10_04_export_pdf_magic_bytes_and_structure(self):
        """Verify that PDF export payload starts with %PDF magic bytes and contains %%EOF."""
        resp = self.client._request("GET", "/api/search/export?format=pdf&query=architecture")
        self.assertEqual(resp.status_code, 200)
        pdf_bytes = resp.body

        self.assertTrue(pdf_bytes.startswith(b"%PDF"), "PDF export payload must start with %PDF magic header")
        self.assertIn(b"%%EOF", pdf_bytes, "PDF export payload must end with %%EOF marker")

    def test_f10_05_verify_file_export_client_helper(self):
        """Verify file export payloads using E2EClient export verification helper."""
        csv_resp = self.client._request("GET", "/api/search/export?format=csv")
        csv_verif = self.client.verify_file_export(csv_resp.body, "csv")
        self.assertTrue(csv_verif["valid"], f"CSV export verification failed: {csv_verif}")
        self.assertTrue(csv_verif["has_header"])
        self.assertGreater(csv_verif["row_count"], 0)

        pdf_resp = self.client._request("GET", "/api/search/export?format=pdf")
        pdf_verif = self.client.verify_file_export(pdf_resp.body, "pdf")
        self.assertTrue(pdf_verif["valid"], f"PDF export verification failed: {pdf_verif}")
        self.assertTrue(pdf_verif["is_pdf_magic"])
        self.assertTrue(pdf_verif["has_eof"])

    def test_f10_06_export_content_disposition_header(self):
        """Verify response headers include Content-Disposition attachment header."""
        csv_resp = self.client._request("GET", "/api/search/export?format=csv")
        cd_header = csv_resp.headers.get("Content-Disposition", "")
        self.assertIn("attachment", cd_header.lower())
        self.assertIn("search_results.csv", cd_header.lower())

        pdf_resp = self.client._request("GET", "/api/search/export?format=pdf")
        cd_header_pdf = pdf_resp.headers.get("Content-Disposition", "")
        self.assertIn("attachment", cd_header_pdf.lower())
        self.assertIn("search_results.pdf", cd_header_pdf.lower())


if __name__ == "__main__":
    unittest.main()
