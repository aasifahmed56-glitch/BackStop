"""
Integration tests for ingest, upload, derive, and claims pipeline.
"""
from datetime import date
import io
import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.main import app
from app.models import Project, Source, Chunk, Claim, ClaimKind, ClaimStatus, ClaimType
from app.db import create_db_and_tables


@pytest.fixture(scope="module")
def client():
    create_db_and_tables()
    with TestClient(app) as c:
        yield c


class TestPipelineEndpoints:
    def test_sample_load(self, client):
        resp = client.post("/api/sample/load")
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["project_name"] == "Campus Event App"
        assert data["git_commits"] > 0
        assert data["issue_chunks"] > 0
        assert data["task_rows"] > 0
        assert data["chat_messages"] > 0
        assert data["note_paragraphs"] > 0

    def test_get_project(self, client):
        resp = client.get("/api/projects/1")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == 1
        assert data["name"] == "Campus Event App"
        assert data["leaver_name"] == "Riya"
        assert data["source_count"] >= 5
        assert data["chunk_count"] > 100

    def test_derive_claims(self, client):
        resp = client.post("/api/projects/1/derive")
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["claims_created"] > 0
        breakdown = data["breakdown"]
        assert breakdown["ownership"] > 0
        assert breakdown["sole_knowledge_risk"] > 0
        assert breakdown["stale_modules"] > 0
        assert breakdown["contact_overlap"] > 0
        assert breakdown["reverted_commits"] > 0
        assert breakdown["missing_task_owners"] > 0

        # Check knowledge at risk scores
        scores = data["knowledge_at_risk_scores"]
        assert "deploy" in scores or "auth" in scores

    def test_claims_list_and_details(self, client):
        resp = client.get("/api/projects/1/claims")
        assert resp.status_code == 200
        claims = resp.json()
        assert len(claims) > 0

        # Verify all claims have valid kind and status
        for c in claims:
            if not c.get("withheld"):
                assert c["kind"] in ("derived", "interpreted")
                assert c["status"] in ("verified", "inferred", "conflicting", "missing")
                assert len(c["evidence"]) > 0

    def test_upload_sanitized_and_limited(self, client):
        # 1. Valid upload: two paragraphs separated by blank line
        content = b"# Extra Note\n\nThis is a supplementary handover paragraph.\n"
        files = {"file": ("my extra note.md", io.BytesIO(content), "text/markdown")}
        data = {"access_level": "team"}
        resp = client.post("/api/projects/1/upload", files=files, data=data)
        assert resp.status_code == 200, resp.text
        res_data = resp.json()
        assert res_data["name"] == "my_extra_note.md"
        assert res_data["chunk_count"] == 2

        # 2. Disallowed extension
        files = {"file": ("malicious.exe", io.BytesIO(b"binary"), "application/octet-stream")}
        resp = client.post("/api/projects/1/upload", files=files, data=data)
        assert resp.status_code == 400

        # 3. Size limit exceeded
        large_content = b"x" * (6 * 1024 * 1024)  # 6 MB > 5 MB
        files = {"file": ("large.txt", io.BytesIO(large_content), "text/plain")}
        resp = client.post("/api/projects/1/upload", files=files, data=data)
        assert resp.status_code == 413
