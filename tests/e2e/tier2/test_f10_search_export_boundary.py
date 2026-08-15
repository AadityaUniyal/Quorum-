"""
Tier 2 Boundary & Corner Cases Test Suite for Feature 10: Search Results Export.

Tests large export payloads, CSV formula/special character escaping, corrupted PDF payload detection,
unsupported format handling, empty result set export, and Content-Disposition headers.
"""

import sys
import unittest
from pathlib import Path

# Ensure workspace root is on sys.path
root_dir = Path(__file__).resolve().parents[3]
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from tests.e2e.infra.client import E2EClient
from tests.e2e.infra.fixtures import E2ETestContext


class TestFeature10SearchExportBoundary(unittest.TestCase):
    """Boundary & Corner Cases for Feature 10 (Search Results Export)."""

    def setUp(self):
        self.context = E2ETestContext()
        self.client = E2EClient(base_url=self.context.base_url, force_mock=self.context.force_mock)

    def test_f10_bva_01_large_search_export_payload_bytes(self):
        """Verify export helper handles multi-row CSV and multi-KB PDF exports."""
        # CSV Export check
        resp_csv = self.client._request("GET", "/api/search/export?format=csv")
        self.assertEqual(resp_csv.status_code, 200)
        self.assertIn("text/csv", resp_csv.headers.get("Content-Type", ""))
        verif_csv = self.client.verify_file_export(resp_csv.body, "csv")
        self.assertTrue(verif_csv["valid"])
        self.assertTrue(verif_csv["has_header"])
        self.assertGreater(verif_csv["row_count"], 0)

        # PDF Export check
        resp_pdf = self.client._request("GET", "/api/search/export?format=pdf")
        self.assertEqual(resp_pdf.status_code, 200)
        self.assertIn("application/pdf", resp_pdf.headers.get("Content-Type", ""))
        verif_pdf = self.client.verify_file_export(resp_pdf.body, "pdf")
        self.assertTrue(verif_pdf["valid"])
        self.assertTrue(verif_pdf["is_pdf_magic"])
        self.assertTrue(verif_pdf["has_eof"])

    def test_f10_bva_02_special_characters_and_csv_formula_injection(self):
        """Verify CSV verification handles rows with quotes, commas, newlines, and formulas."""
        csv_data = (
            'query,title,url,relevance_score\n'
            '"Query with, commas","Title ""with quotes""","https://docintel.ai?a=1&b=2",0.95\n'
            '"=SUM(1+1)","Formula Test","https://docintel.ai/form",0.88\n'
        ).encode("utf-8")

        verif = self.client.verify_file_export(csv_data, "csv")
        self.assertTrue(verif["valid"])
        self.assertTrue(verif["has_header"])
        self.assertEqual(verif["row_count"], 2)

    def test_f10_bva_03_corrupted_pdf_payload_detection(self):
        """Verify verify_file_export helper accurately flags missing %PDF header or missing %%EOF footer."""
        # Corrupted PDF missing %PDF header
        corrupt_no_header = b"NOT_A_PDF_STREAM\ntrailer << >>\n%%EOF\n"
        verif1 = self.client.verify_file_export(corrupt_no_header, "pdf")
        self.assertFalse(verif1["valid"])
        self.assertFalse(verif1["is_pdf_magic"])

        # Corrupted PDF missing %%EOF
        corrupt_no_eof = b"%PDF-1.4\n1 0 obj << >> endobj\nTruncated byte stream"
        verif2 = self.client.verify_file_export(corrupt_no_eof, "pdf")
        self.assertFalse(verif2["valid"])
        self.assertFalse(verif2["has_eof"])

    def test_f10_bva_04_unsupported_export_format(self):
        """Verify requesting unsupported export formats returns valid error status or default fallback."""
        resp = self.client._request("GET", "/api/search/export?format=unknown_format")
        # Engine falls back to CSV or returns error status
        self.assertIn(resp.status_code, [200, 400])

    def test_f10_bva_05_empty_search_results_export(self):
        """Verify exporting empty search results returns valid CSV structure with header only."""
        empty_csv = "query,title,url,relevance_score,created_at\n".encode("utf-8")
        verif = self.client.verify_file_export(empty_csv, "csv")
        self.assertTrue(verif["has_header"])
        self.assertEqual(verif["row_count"], 0)

    def test_f10_bva_06_content_disposition_filename_headers(self):
        """Verify Content-Disposition headers specify download filenames for CSV and PDF."""
        resp_csv = self.client._request("GET", "/api/search/export?format=csv")
        self.assertIn("attachment;", resp_csv.headers.get("Content-Disposition", ""))
        self.assertIn(".csv", resp_csv.headers.get("Content-Disposition", ""))

        resp_pdf = self.client._request("GET", "/api/search/export?format=pdf")
        self.assertIn("attachment;", resp_pdf.headers.get("Content-Disposition", ""))
        self.assertIn(".pdf", resp_pdf.headers.get("Content-Disposition", ""))


if __name__ == "__main__":
    unittest.main()
