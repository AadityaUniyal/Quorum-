import pytest

from app.services.export import (
    convert_mark_tags_to_reportlab,
    export_to_csv,
    export_to_pdf,
    sanitize_csv_cell,
    strip_html_tags,
)


class TestExportService:

    @pytest.fixture
    def sample_results(self):
        return [
            {
                "id": "doc-1",
                "filename": "Invoice_2026.pdf",
                "type": "file",
                "category": "INVOICE",
                "consensus_score": 0.95,
                "created_at": "2026-06-18T10:00:00",
                "snippet": "Payment due for <mark>titanium</mark> rods.",
                "score": 0.9421,
            },
            {
                "id": "web-1",
                "filename": "Stellar Dynamics Supplier Terms",
                "type": "web",
                "category": "WEB_PAGE",
                "url": "https://example.com/terms",
                "consensus_score": 1.0,
                "created_at": "2026-06-19T12:00:00",
                "snippet": "Supplier agreement for <mark>titanium</mark> parts.",
                "score": 0.8105,
            },
        ]

    def test_strip_html_tags(self):
        assert strip_html_tags("Payment for <mark>rods</mark>.") == "Payment for rods."
        assert strip_html_tags(None) == ""

    def test_convert_mark_tags_to_reportlab(self):
        converted = convert_mark_tags_to_reportlab("Search <mark>term</mark>")
        assert '<font color="#1d4ed8"><b>term</b></font>' in converted

    def test_sanitize_csv_cell(self):
        assert sanitize_csv_cell("=1+1") == "'=1+1"
        assert sanitize_csv_cell("+cmd|' /C calc'!A0") == "'+cmd|' /C calc'!A0"
        assert sanitize_csv_cell("-2+3") == "'-2+3"
        assert sanitize_csv_cell("@SUM(1,2)") == "'@SUM(1,2)"
        assert sanitize_csv_cell("\tTabbed") == "'\tTabbed"
        assert sanitize_csv_cell("\rReturn") == "'\rReturn"
        assert sanitize_csv_cell("Normal text") == "Normal text"
        assert sanitize_csv_cell(123) == 123
        assert sanitize_csv_cell(0.95) == 0.95
        assert sanitize_csv_cell(None) == ""

    def test_export_to_csv_formula_injection_sanitized(self):
        malicious_results = [
            {
                "id": "mal-1",
                "filename": "=cmd|' /C calc'!A0.pdf",
                "type": "+file",
                "snippet": "@SUM(1,2)",
                "url": "-https://evil.com",
                "score": 0.99,
                "created_at": "\t2026-01-01",
            }
        ]
        csv_bytes = export_to_csv(malicious_results, query="=cmd|' /C calc'!A0")
        content = csv_bytes.decode("utf-8-sig")
        assert "'=cmd|' /C calc'!A0" in content
        assert "'+file" in content
        assert "'@SUM(1,2)" in content
        assert "'-https://evil.com" in content
        assert "'\t2026-01-01" in content

    def test_export_to_csv_content(self, sample_results):
        csv_bytes = export_to_csv(sample_results, query="titanium")
        assert isinstance(csv_bytes, bytes)
        content = csv_bytes.decode("utf-8-sig")

        # Check headers
        assert "Query,Title/Filename,Snippet/Content,Score,Type,Date,URL/Path" in content
        # Check rows
        assert "titanium" in content
        assert "Invoice_2026.pdf" in content
        assert "Payment due for titanium rods." in content  # HTML stripped
        assert "Stellar Dynamics Supplier Terms" in content
        assert "https://example.com/terms" in content

    def test_export_to_csv_empty_results(self):
        csv_bytes = export_to_csv([], query="empty")
        content = csv_bytes.decode("utf-8-sig")
        lines = content.strip().splitlines()
        assert len(lines) == 1  # Only header line
        assert "Query" in lines[0]
        assert "Title/Filename" in lines[0]

    def test_export_to_pdf_content(self, sample_results):
        pdf_bytes = export_to_pdf(sample_results, query="titanium")
        assert isinstance(pdf_bytes, bytes)
        assert pdf_bytes.startswith(b"%PDF-")
        assert len(pdf_bytes) > 2000  # Valid PDF size

    def test_export_to_pdf_empty_results(self):
        pdf_bytes = export_to_pdf([], query="nonexistent")
        assert isinstance(pdf_bytes, bytes)
        assert pdf_bytes.startswith(b"%PDF-")

    def test_export_pdf_special_characters_and_ampersands(self):
        query = "R&D & <script>alert(1)</script>"
        filename = "AT&T & Co. Invoice.pdf"
        sample_data = [
            {
                "id": "doc-special-1",
                "filename": filename,
                "type": "file",
                "score": 0.98,
                "created_at": "2026-08-13T10:00:00",
                "snippet": "R&D procurement & parts <script>alert(1)</script>",
                "url": "https://example.com/item?a=1&b=2",
            }
        ]
        pdf_bytes = export_to_pdf(sample_data, query=query)
        assert isinstance(pdf_bytes, bytes)
        assert pdf_bytes.startswith(b"%PDF-")
        assert len(pdf_bytes) > 1000


class TestExportEndpoint:

    def test_export_endpoint_csv_success(self, client, auth_headers):
        response = client.get("/api/search/export?query=invoice&format=csv", headers=auth_headers)
        assert response.status_code == 200
        assert "text/csv" in response.headers["content-type"]
        assert 'attachment; filename="search_results.csv"' in response.headers["content-disposition"]
        assert b"Query,Title/Filename,Snippet/Content" in response.content

    def test_export_endpoint_pdf_success(self, client, auth_headers):
        response = client.get("/api/search/export?query=invoice&format=pdf", headers=auth_headers)
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/pdf"
        assert 'attachment; filename="search_results.pdf"' in response.headers["content-disposition"]
        assert response.content.startswith(b"%PDF-")

    def test_export_endpoint_invalid_format(self, client, auth_headers):
        response = client.get("/api/search/export?query=invoice&format=xlsx", headers=auth_headers)
        assert response.status_code == 400
        assert "Unsupported export format" in response.json()["detail"]

    def test_export_endpoint_pdf_special_characters(self, client, auth_headers):
        response = client.get(
            "/api/search/export?query=R%26D%20%26%20%3Cscript%3Ealert(1)%3C%2Fscript%3E&format=pdf",
            headers=auth_headers
        )
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/pdf"
        assert response.content.startswith(b"%PDF-")
