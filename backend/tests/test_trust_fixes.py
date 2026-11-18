"""
Tests for the trust fixes: fail-closed support check, no planted AI claims,
code-detected schedule conflicts, duplicate merging, and conflict approval rules.
"""
from datetime import datetime

import pytest
from fastapi.testclient import TestClient

from app import llm, verify
from app.derived import compute_schedule_conflicts
from app.main import app
from app.models import AccessLevel, Chunk, Source, SourceKind


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        c.post("/api/sample/reset")
        yield c


def _claims(client):
    return client.get("/api/claims?project_id=1&role=admin").json()


def test_support_check_fails_closed_on_error(monkeypatch):
    def boom(*a, **k):
        raise RuntimeError("no cache")
    monkeypatch.setattr(verify, "complete_json", boom)
    res = verify.check_claim_support("Riya owns payments", "Riya owns payments")
    assert res["supports"] == "unchecked"


def test_support_check_fails_closed_on_unreadable_answer(monkeypatch):
    monkeypatch.setattr(verify, "complete_json", lambda *a, **k: {"supports": "maybe"})
    assert verify.check_claim_support("x", "y")["supports"] == "unchecked"


def test_seeded_claims_are_labelled_and_never_verified(client):
    seeded = [c for c in _claims(client) if any(e.get("origin") == "seeded" for e in c["evidence"])]
    assert seeded, "sample should include labelled seeded fixtures for the role demo"
    for c in seeded:
        assert c["status"] != "verified"
        assert c["kind"] == "interpreted"


def test_no_empty_open_questions(client):
    assert not [c for c in _claims(client) if "Regarding ''" in c["text"]]


def test_schedule_conflict_is_detected_by_code_with_two_quotes(client):
    conflicts = [c for c in _claims(client) if c["status"] == "conflicting"]
    assert conflicts
    c = conflicts[0]
    assert c["kind"] == "derived"
    quotes = [e["quote"] for e in c["evidence"]]
    assert len(quotes) == 2
    assert "20 Feb 2026" in quotes[0]
    assert "postponed" in quotes[1].lower()


def test_conflicting_claim_needs_a_note_to_approve(client):
    c = [c for c in _claims(client) if c["status"] == "conflicting"][0]
    r = client.post(f"/api/claims/{c['id']}/approve", json={"role": "lead"})
    assert r.status_code == 422
    r = client.post(f"/api/claims/{c['id']}/approve", json={"role": "lead", "note": "Conflict resolved: meeting-07 is current"})
    assert r.status_code == 200


def test_duplicates_are_merged_into_one_claim(client):
    texts = [verify._normalise_claim_text(c["text"]) + c["type"] for c in _claims(client) if c["kind"] == "interpreted"]
    assert len(texts) == len(set(texts))


def test_normalise_ignores_issue_references():
    a = verify._normalise_claim_text("Migration postponed — not enough testing time. Per issue #31.")
    b = verify._normalise_claim_text("Migration postponed — not enough testing time.")
    assert a == b


def test_schedule_conflict_needs_two_different_sources():
    s1 = Source(id=1, project_id=1, kind=SourceKind.note, name="a.md", access_level=AccessLevel.team, raw_text="")
    plan = Chunk(id=1, source_id=1, text="- Payments migration is on 20 Feb 2026.")
    same_src = Chunk(id=2, source_id=1, text="- Payments migration postponed.")
    assert compute_schedule_conflicts([(s1, plan), (s1, same_src)]) == []
    s2 = Source(id=2, project_id=1, kind=SourceKind.chat, name="chat.json", access_level=AccessLevel.team, raw_text="")
    later = Chunk(id=3, source_id=2, text="Payments migration postponed, sorry")
    out = compute_schedule_conflicts([(s1, plan), (s2, later)])
    assert len(out) == 1 and out[0]["date"] == "20 Feb 2026"
