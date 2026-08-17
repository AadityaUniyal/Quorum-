import os
import sys
import time
from pathlib import Path

# Ensure environment variables are set before importing the app
os.environ.setdefault('DATABASE_URL', 'sqlite:///./test_e2e.db')
os.environ.setdefault('JWT_SECRET_KEY', 'test-secret-key')
os.environ.setdefault('DEBUG', 'true')
os.environ.setdefault('RABBITMQ_HOST', 'localhost')
os.environ.setdefault('REDIS_HOST', 'localhost')

# Import FastAPI app after env vars are set
from app.database import Base, engine
from app.models.auth import User
from app.models.document import Document
from app.models.search import CrawledPage, SearchLog
Base.metadata.create_all(bind=engine)

from fastapi.testclient import TestClient
from app.main import app
client = TestClient(app)

def log(msg: str):
    print(f"[END2END] {msg}")

def register_user(email: str, password: str):
    # Include required full_name field for registration
    resp = client.post('/api/auth/register', json={'email': email, 'password': password, 'full_name': 'E2E Test User'})
    log(f"Register status: {resp.status_code}")
    assert resp.status_code == 201, f"Register failed: {resp.text}"
    return resp.json()

def login_user(email: str, password: str):
    resp = client.post('/api/auth/login', json={'email': email, 'password': password})
    log(f"Login status: {resp.status_code}")
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    data = resp.json()
    assert 'access_token' in data, "Missing access token"
    return data['access_token']

def auth_headers(token: str):
    return {'Authorization': f'Bearer {token}'}

def create_document(token: str, title: str, content: str):
    # Use the upload endpoint which expects a file.
    # Create an in‑memory file payload.
    files = {"file": (f"{title}.txt", content.encode())}
    resp = client.post('/api/documents/upload', files=files, headers=auth_headers(token))
    log(f"Create document status: {resp.status_code}")
    assert resp.status_code == 201, f"Create doc failed: {resp.text}"
    return resp.json()['id']

def search_documents(token: str, query: str):
    resp = client.get(f'/api/search?query={query}', headers=auth_headers(token))
    log(f"Search status: {resp.status_code}")
    assert resp.status_code == 200, f"Search failed: {resp.text}"
    return resp.json()

def export_pdf(token: str, query: str):
    resp = client.get('/api/search/export', params={'query': query, 'format': 'pdf'}, headers=auth_headers(token))
    log(f"Export PDF status: {resp.status_code}")
    assert resp.status_code == 200, f"Export failed: {resp.text}"
    # Ensure we got PDF content (bytes start with %PDF)
    assert resp.content.startswith(b'%PDF'), "Export did not return PDF"
    return resp.content

def get_analytics(token: str):
    resp = client.get('/api/analytics/charts', headers=auth_headers(token))
    log(f"Analytics status: {resp.status_code}")
    assert resp.status_code == 200, f"Analytics failed: {resp.text}"
    return resp.json()

def main():
    email = 'e2e_test@example.com'
    password = 'StrongPass!123'
    # Register (ignore if already exists)
    try:
        register_user(email, password)
    except AssertionError as e:
        if 'already exists' in str(e):
            log('User already exists, proceeding')
        else:
            raise
    token = login_user(email, password)
    doc_id = create_document(token, 'End2End Doc', 'This is a test document for end‑to‑end verification.')
    search_res = search_documents(token, 'test')
    log(f"Search results count: {len(search_res)}")
    pdf_content = export_pdf(token, 'test')
    log(f"PDF size: {len(pdf_content)} bytes")
    analytics = get_analytics(token)
    log('Analytics fetched')
    print('[SUCCESS] All steps passed')

if __name__ == '__main__':
    main()
