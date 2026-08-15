import pytest
import io
from app.models.document import Document
from app.services.crawler import compute_pagerank

def test_lock_race_condition(client, auth_headers):
    # 1. Create a dummy document in DB
    response = client.post(
        "/api/documents/upload",
        files={"file": ("test_invoice_lock.txt", io.BytesIO(b"invoice details here"), "text/plain")},
        headers=auth_headers
    )
    assert response.status_code in (200, 201)
    doc_id = response.json().get("id") or response.json().get("duplicate") and response.json().get("id")
    assert doc_id is not None
    
    # 2. Lock the document to acquire a token
    lock_resp = client.post(f"/api/review/{doc_id}/lock", headers=auth_headers)
    assert lock_resp.status_code == 200
    lock_data = lock_resp.json()
    token = lock_data["lock_token"]
    assert token is not None

    # 3. Simulate heartbeat with wrong token -> assert 403 or error
    hb_wrong = client.post(f"/api/review/{doc_id}/heartbeat?lock_token=wrong-token-123", headers=auth_headers)
    assert hb_wrong.status_code == 403

    # 4. Simulate heartbeat with correct token -> assert 200
    hb_correct = client.post(f"/api/review/{doc_id}/heartbeat?lock_token={token}", headers=auth_headers)
    assert hb_correct.status_code == 200

    # 5. Unlock using the lock token
    unlock_resp = client.post(f"/api/review/{doc_id}/unlock?lock_token={token}", headers=auth_headers)
    assert unlock_resp.status_code == 200


def test_composite_hash_deduplication(client, auth_headers):
    # 1. Upload a file first time
    file_data = b"Some unique content that represents document data for composite hashing checks."
    response1 = client.post(
        "/api/documents/upload",
        files={"file": ("invoice_hash_test.txt", io.BytesIO(file_data), "text/plain")},
        headers=auth_headers
    )
    assert response1.status_code in (200, 201)
    doc_id1 = response1.json().get("id")
    
    # 2. Upload same file second time -> assert duplicate is detected (status 200)
    response2 = client.post(
        "/api/documents/upload",
        files={"file": ("invoice_hash_test.txt", io.BytesIO(file_data), "text/plain")},
        headers=auth_headers
    )
    assert response2.status_code == 200
    data2 = response2.json()
    assert data2.get("duplicate") is True
    assert data2.get("id") == doc_id1


def test_pagerank_disconnected_graphs(db_session):
    from app.models.search import CrawledPage, PageLink
    # Setup two disconnected circular components
    # Component 1: A -> B -> A
    # Component 2: C -> D -> C
    db_session.query(PageLink).delete()
    db_session.query(CrawledPage).delete()
    db_session.commit()

    page_a = CrawledPage(url="https://site.com/a", title="Page A", pagerank=1.0)
    page_b = CrawledPage(url="https://site.com/b", title="Page B", pagerank=1.0)
    page_c = CrawledPage(url="https://site.com/c", title="Page C", pagerank=1.0)
    page_d = CrawledPage(url="https://site.com/d", title="Page D", pagerank=1.0)
    db_session.add_all([page_a, page_b, page_c, page_d])
    db_session.commit()

    links = [
        PageLink(source_url="https://site.com/a", target_url="https://site.com/b"),
        PageLink(source_url="https://site.com/b", target_url="https://site.com/a"),
        PageLink(source_url="https://site.com/c", target_url="https://site.com/d"),
        PageLink(source_url="https://site.com/d", target_url="https://site.com/c"),
    ]
    db_session.add_all(links)
    db_session.commit()

    compute_pagerank(db_session, d=0.85, max_iter=50, tol=1e-6)
    db_session.expire_all()

    updated_a = db_session.query(CrawledPage).filter(CrawledPage.url == "https://site.com/a").first()
    updated_c = db_session.query(CrawledPage).filter(CrawledPage.url == "https://site.com/c").first()
    
    assert updated_a.pagerank > 0.0
    assert updated_c.pagerank > 0.0
    assert abs(updated_a.pagerank - 0.25) < 1e-4
    assert abs(updated_c.pagerank - 0.25) < 1e-4
