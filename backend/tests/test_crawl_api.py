from unittest.mock import patch

from app.main import app
from app.models.auth import User, UserRole
from app.routes.auth import get_current_user


def mock_admin_user():
    return User(id="admin-123", email="admin@docintel.ai", role=UserRole.ADMIN)


def mock_operator_user():
    return User(id="op-123", email="op@docintel.ai", role=UserRole.OPERATOR)


def mock_viewer_user():
    return User(id="viewer-123", email="viewer@docintel.ai", role=UserRole.VIEWER)


@patch("app.routes.crawl.publish_crawl_task")
def test_post_crawl_admin_success(mock_publish, client):
    app.dependency_overrides[get_current_user] = mock_admin_user
    try:
        response = client.post("/api/crawl", json={"url": "https://example.com", "max_depth": 3})
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "queued"
        assert data["url"] == "https://example.com"
        assert data["max_depth"] == 3
        mock_publish.assert_called_once_with(url="https://example.com", max_depth=3)
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@patch("app.routes.crawl.publish_crawl_task")
def test_post_crawl_operator_success(mock_publish, client):
    app.dependency_overrides[get_current_user] = mock_operator_user
    try:
        response = client.post("/api/crawl", json={"url": "https://testdomain.com"})
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "queued"
        assert data["url"] == "https://testdomain.com"
        assert data["max_depth"] == 2
        mock_publish.assert_called_once_with(url="https://testdomain.com", max_depth=2)
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_post_crawl_viewer_forbidden(client):
    app.dependency_overrides[get_current_user] = mock_viewer_user
    try:
        response = client.post("/api/crawl", json={"url": "https://example.com"})
        assert response.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_post_crawl_invalid_scheme(client):
    app.dependency_overrides[get_current_user] = mock_admin_user
    try:
        response = client.post("/api/crawl", json={"url": "ftp://invalid-scheme.com"})
        assert response.status_code == 400
        assert "URL must start with http:// or https://" in response.json()["detail"]
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_get_crawled_pages(client):
    app.dependency_overrides[get_current_user] = mock_viewer_user
    try:
        response = client.get("/api/crawl/pages")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@patch("app.routes.crawl.compute_pagerank")
def test_force_pagerank(mock_pagerank, client):
    app.dependency_overrides[get_current_user] = mock_admin_user
    try:
        response = client.post("/api/crawl/pagerank")
        assert response.status_code == 200
        assert response.json()["message"] == "PageRank calculation completed successfully."
        mock_pagerank.assert_called_once()
    finally:
        app.dependency_overrides.pop(get_current_user, None)
