import pytest
from uuid import uuid4

def test_comments_workflow(client, auth_headers, sample_upload_file):
    # 1. First upload a document so we have a document_id
    with open(sample_upload_file, "rb") as f:
        upload_response = client.post(
            "/api/documents/upload",
            files={"file": ("test_invoice_comment.txt", f, "text/plain")},
            headers=auth_headers
        )
    assert upload_response.status_code in (200, 201)
    doc_data = upload_response.json()
    
    # Duplicate files return OK with 'id' in a wrapper
    if "duplicate" in doc_data and doc_data["duplicate"]:
        doc_id = doc_data["id"]
    else:
        doc_id = doc_data["id"]

    # 2. Add a document comment
    comment_payload = {
        "content": "This invoice looks solid.",
        "field_key": None
    }
    comment_response = client.post(
        f"/api/documents/{doc_id}/comments",
        json=comment_payload,
        headers=auth_headers
    )
    assert comment_response.status_code == 201
    comment_data = comment_response.json()
    assert comment_data["content"] == "This invoice looks solid."
    assert comment_data["field_key"] is None
    assert "id" in comment_data
    comment_id = comment_data["id"]

    # 3. Add a field-level comment
    field_comment_payload = {
        "content": "Check the tax percentage.",
        "field_key": "tax"
    }
    field_comment_response = client.post(
        f"/api/documents/{doc_id}/comments",
        json=field_comment_payload,
        headers=auth_headers
    )
    assert field_comment_response.status_code == 201
    field_comment_data = field_comment_response.json()
    assert field_comment_data["content"] == "Check the tax percentage."
    assert field_comment_data["field_key"] == "tax"

    # 4. List comments for this document
    list_response = client.get(
        f"/api/documents/{doc_id}/comments",
        headers=auth_headers
    )
    assert list_response.status_code == 200
    comments_list = list_response.json()
    assert len(comments_list) >= 2
    assert any(c["id"] == comment_id for c in comments_list)

    # 5. Delete comment
    delete_response = client.delete(
        f"/api/documents/comments/{comment_id}",
        headers=auth_headers
    )
    assert delete_response.status_code == 204

    # 6. Verify delete is effective in list
    list_response_after = client.get(
        f"/api/documents/{doc_id}/comments",
        headers=auth_headers
    )
    assert list_response_after.status_code == 200
    comments_list_after = list_response_after.json()
    assert not any(c["id"] == comment_id for c in comments_list_after)
