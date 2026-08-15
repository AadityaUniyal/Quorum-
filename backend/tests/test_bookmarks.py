import pytest
from uuid import uuid4


def test_create_bookmark(client, auth_headers):
    payload = {
        "name": "Quarterly Invoices",
        "query_text": "type:invoice vendor:Apex",
        "filters": {"category": "INVOICE", "year": 2026}
    }
    response = client.post("/api/bookmarks", json=payload, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Quarterly Invoices"
    assert data["query_text"] == "type:invoice vendor:Apex"
    assert data["filters"] == {"category": "INVOICE", "year": 2026}
    assert "id" in data
    assert "user_id" in data
    assert "created_at" in data


def test_list_bookmarks(client, auth_headers):
    bm1 = {"name": "Search A", "query_text": "query A", "filters": None}
    bm2 = {"name": "Search B", "query_text": "query B", "filters": {"type": "WEB"}}
    client.post("/api/bookmarks", json=bm1, headers=auth_headers)
    client.post("/api/bookmarks", json=bm2, headers=auth_headers)

    response = client.get("/api/bookmarks", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 2
    names = [b["name"] for b in data]
    assert "Search A" in names
    assert "Search B" in names


def test_get_bookmark_by_id(client, auth_headers):
    payload = {"name": "Single Bookmark", "query_text": "test search"}
    create_res = client.post("/api/bookmarks", json=payload, headers=auth_headers)
    assert create_res.status_code == 201
    bm_id = create_res.json()["id"]

    get_res = client.get(f"/api/bookmarks/{bm_id}", headers=auth_headers)
    assert get_res.status_code == 200
    assert get_res.json()["id"] == bm_id
    assert get_res.json()["name"] == "Single Bookmark"


def test_delete_bookmark(client, auth_headers):
    payload = {"name": "To Delete", "query_text": "delete search"}
    create_res = client.post("/api/bookmarks", json=payload, headers=auth_headers)
    bm_id = create_res.json()["id"]

    del_res = client.delete(f"/api/bookmarks/{bm_id}", headers=auth_headers)
    assert del_res.status_code == 204

    # Verify deleted
    get_res = client.get(f"/api/bookmarks/{bm_id}", headers=auth_headers)
    assert get_res.status_code == 404


def test_bookmark_unauthorized(client):
    res = client.get("/api/bookmarks")
    assert res.status_code == 401

    post_res = client.post("/api/bookmarks", json={"name": "X", "query_text": "Y"})
    assert post_res.status_code == 401


def test_delete_nonexistent_bookmark(client, auth_headers):
    fake_id = str(uuid4())
    res = client.delete(f"/api/bookmarks/{fake_id}", headers=auth_headers)
    assert res.status_code == 404


def test_delete_bookmark_forbidden_foreign_user(client, auth_headers):
    # User A creates a bookmark
    payload = {"name": "User A Bookmark", "query_text": "secret search"}
    create_res = client.post("/api/bookmarks", json=payload, headers=auth_headers)
    assert create_res.status_code == 201
    bm_id = create_res.json()["id"]

    # Register and log in User B
    user_b_data = {
        "email": "user_b_forbidden@docintel.ai",
        "password": "UserBPassword!2026Secure",
        "full_name": "User B",
        "role": "VIEWER"
    }
    reg_res = client.post("/api/auth/register", json=user_b_data)
    assert reg_res.status_code == 201

    login_res = client.post("/api/auth/login", json={
        "email": user_b_data["email"],
        "password": user_b_data["password"]
    })
    assert login_res.status_code == 200
    token_b = login_res.json()["access_token"]
    user_b_headers = {"Authorization": f"Bearer {token_b}"}

    # User B attempts to delete User A's bookmark
    del_res = client.delete(f"/api/bookmarks/{bm_id}", headers=user_b_headers)
    assert del_res.status_code == 403


def test_create_bookmark_with_aliases(client, auth_headers):
    payload = {
        "title": "Alias Title",
        "query": "alias search query",
        "tags": ["security", "auth"]
    }
    response = client.post("/api/bookmarks", json=payload, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Alias Title"
    assert data["title"] == "Alias Title"
    assert data["query_text"] == "alias search query"
    assert data["query"] == "alias search query"
    assert data["tags"] == ["security", "auth"]
    assert data["filters"] == {"tags": ["security", "auth"]}


def test_create_bookmark_empty_query_fails(client, auth_headers):
    payload = {
        "title": "Empty Bookmark",
        "query": "   "
    }
    response = client.post("/api/bookmarks", json=payload, headers=auth_headers)
    assert response.status_code == 400
