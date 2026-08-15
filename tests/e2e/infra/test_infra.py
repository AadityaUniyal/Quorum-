"""
Unit and integration tests for E2E Test Infrastructure & Client helpers.
Verifies:
- Cookie parsing & attribute verification (HttpOnly, Secure, SameSite)
- Refresh token request helper
- Password validation scoring
- Googi crawler execution helper
- LLM query expansion helper
- Bookmarks CRUD helper
- CSV and PDF export verification helpers
"""

import sys
from pathlib import Path

# Ensure root is on sys.path
root_dir = Path(__file__).resolve().parents[3]
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from tests.e2e.infra.client import E2EClient, CookieInfo
from tests.e2e.infra.fixtures import E2ETestContext


def test_infra_cookie_parsing():
    client = E2EClient(force_mock=True)
    header = "access_token=token123; HttpOnly; Secure; SameSite=Lax; Path=/"
    cookies = client.parse_cookies(header)
    
    assert "access_token" in cookies
    c = cookies["access_token"]
    assert c.name == "access_token"
    assert c.value == "token123"
    assert c.httponly is True
    assert c.secure is True
    assert c.samesite == "Lax"


def test_infra_cookie_attribute_verification():
    client = E2EClient(force_mock=True)
    cookie_info = CookieInfo(name="refresh_token", value="ref123", httponly=True, secure=True, samesite="Lax")
    res = client.verify_cookie_attributes(cookie_info, http_only=True, secure=True, samesite="Lax")
    
    assert res["is_valid"] is True
    assert res["checks"]["httponly_valid"] is True
    assert res["checks"]["secure_valid"] is True
    assert res["checks"]["samesite_valid"] is True


def test_infra_password_validation_testing():
    client = E2EClient(force_mock=True)
    weak_res = client.test_password_validation("weak")
    assert weak_res["score"] < 3
    assert weak_res["accepted"] is False

    strong_res = client.test_password_validation("P@ssw0rd2026!#DocIntelSecure")
    assert strong_res["score"] >= 3
    assert strong_res["accepted"] is True


def test_infra_login_and_token_refresh():
    client = E2EClient(force_mock=True)
    reg_resp = client.register("infra_user", "infra@docintel.ai", "Str0ngP@ssw0rd2026!")
    assert reg_resp.status_code == 201

    login_resp = client.login("infra_user", "Str0ngP@ssw0rd2026!")
    assert login_resp.status_code == 200
    assert "access_token" in login_resp.cookies
    assert "refresh_token" in login_resp.cookies

    refresh_token_val = login_resp.cookies["refresh_token"].value
    ref_resp = client.send_refresh_token_request(refresh_token=refresh_token_val)
    assert ref_resp.status_code == 200
    assert "access_token" in ref_resp.cookies


def test_infra_crawler_execution():
    client = E2EClient(force_mock=True)
    crawl_result = client.execute_crawler(start_url="https://docintel.ai", max_depth=2, parse_sitemap=True)
    assert crawl_result["status"] == "success"
    assert "pages" in crawl_result
    assert len(crawl_result["pages"]) >= 1


def test_infra_query_expansion():
    client = E2EClient(force_mock=True)
    exp_resp = client.expand_query("DocIntel AI architecture")
    assert exp_resp.status_code == 200
    json_data = exp_resp.json_data
    assert json_data["original_query"] == "DocIntel AI architecture"
    assert len(json_data["expansions"]) > 1


def test_infra_bookmarks_crud():
    client = E2EClient(force_mock=True)
    create_resp = client.bookmarks_crud("create", query="security features", title="Security Docs", tags=["sec"])
    assert create_resp.status_code == 201
    bm_id = create_resp.json_data["id"]

    list_resp = client.bookmarks_crud("list")
    assert list_resp.status_code == 200
    assert len(list_resp.json_data["bookmarks"]) == 1

    del_resp = client.bookmarks_crud("delete", bookmark_id=bm_id)
    assert del_resp.status_code == 200

    list_after = client.bookmarks_crud("list")
    assert len(list_after.json_data["bookmarks"]) == 0


def test_infra_export_verification():
    client = E2EClient(force_mock=True)
    
    # CSV export check
    csv_bytes = (
        "query,title,url,relevance_score\n"
        "DocIntel,DocIntel System,https://docintel.ai,0.99\n"
    ).encode("utf-8")
    csv_verif = client.verify_file_export(csv_bytes, "csv")
    assert csv_verif["valid"] is True
    assert csv_verif["has_header"] is True
    assert csv_verif["row_count"] == 1

    # PDF export check
    pdf_bytes = b"%PDF-1.4\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n"
    pdf_verif = client.verify_file_export(pdf_bytes, "pdf")
    assert pdf_verif["valid"] is True
    assert pdf_verif["is_pdf_magic"] is True
    assert pdf_verif["has_eof"] is True


if __name__ == "__main__":
    test_infra_cookie_parsing()
    test_infra_cookie_attribute_verification()
    test_infra_password_validation_testing()
    test_infra_login_and_token_refresh()
    test_infra_crawler_execution()
    test_infra_query_expansion()
    test_infra_bookmarks_crud()
    test_infra_export_verification()
    print("ALL INFRASTRUCTURE TESTS PASSED!")
