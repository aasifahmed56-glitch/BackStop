"""Debrief questions, readiness score, and the answer loop (plain code, no AI)."""
import json

import pytest
from fastapi.testclient import TestClient

from app.db import create_db_and_tables
from app.debrief import build_readiness, question_for
from app.main import app
from app.models import AccessLevel, Claim, ClaimKind, ClaimStatus, ClaimType, ReviewState

PLANTED = ["performance concern", "FictionalCloud", "1,20,000", "sk_test_FAKE"]


@pytest.fixture(scope="module")
def client():
    create_db_and_tables()
    with TestClient(app) as c:
        c.post("/api/sample/reset")
        yield c


def _claim(text, status=ClaimStatus.verified, type_=ClaimType.risk, review=ReviewState.pending, kind=ClaimKind.derived, cid=1):
    return Claim(id=cid, project_id=1, kind=kind, type=type_, text=text, status=status,
                 access_level=AccessLevel.team, review_state=review, evidence_json="[]")


def test_sole_knowledge_becomes_high_priority_question():
    q = question_for(_claim("SOLE KNOWLEDGE RISK — deploy/: Riya authored 93% of commits (13/14)."), "Riya")
    assert q["priority"] == "high" and q["topic"] == "deploy/"
    assert "deploy/" in q["question"]


def test_missing_owner_names_the_task():
    q = question_for(_claim('MISSING OWNER — task "Set up push notification keys" has no assigned owner.',
                            status=ClaimStatus.missing, type_=ClaimType.blocker), "Riya")
    assert "Set up push notification keys" in q["question"] and q["priority"] == "high"


def test_rejected_verified_and_debrief_claims_ask_nothing():
    assert question_for(_claim("SOLE KNOWLEDGE RISK — x/: y", review=ReviewState.rejected), "Riya") is None
    assert question_for(_claim("Kabir owns payments.", type_=ClaimType.owner, kind=ClaimKind.interpreted), "Riya") is None
    assert question_for(_claim("Riya (debrief): x", status=ClaimStatus.inferred, kind=ClaimKind.debrief), "Riya") is None


def test_readiness_parts_and_bounds():
    empty = build_readiness([], False)
    assert empty["verdict"] == "empty"
    claims = [_claim("a", cid=1), _claim("b", cid=2, review=ReviewState.approved, status=ClaimStatus.inferred)]
    r = build_readiness(claims, False)
    assert 0 <= r["score"] <= 100
    assert {p["key"] for p in r["parts"]} == {"reviewed", "high_risk", "doubtful", "signed"}
    reviewed = next(p for p in r["parts"] if p["key"] == "reviewed")
    assert (reviewed["done"], reviewed["total"]) == (1, 2)
    full = build_readiness([_claim("a", review=ReviewState.approved)], True)
    assert full["score"] == 100 and full["verdict"] == "ready"


def test_debrief_endpoint_hides_restricted_from_newcomers(client):
    for role in ["incoming_dev", "incoming_pm", None]:
        url = "/api/projects/1/debrief" + (f"?role={role}" if role else "")
        r = client.get(url)
        assert r.status_code == 200
        body = json.dumps(r.json())
        for s in PLANTED:
            assert s not in body, (role, s)
    lead = client.get("/api/projects/1/debrief?role=lead").json()
    dev = client.get("/api/projects/1/debrief?role=incoming_dev").json()
    assert len(lead["questions"]) > len(dev["questions"])
    assert dev["withheld_count"] >= 1
    assert lead["questions"][0]["priority"] == "high"


def test_answer_loop_creates_pending_claim_and_marks_answered(client):
    qs = client.get("/api/projects/1/debrief?role=lead").json()["questions"]
    target = next(q for q in qs if not q["answered"])
    denied = client.post("/api/projects/1/debrief/answer",
                         json={"role": "incoming_dev", "question_claim_id": target["claim_id"], "answer": "x"})
    assert denied.status_code == 403
    blank = client.post("/api/projects/1/debrief/answer",
                        json={"role": "lead", "question_claim_id": target["claim_id"], "answer": "   "})
    assert blank.status_code == 400
    ok = client.post("/api/projects/1/debrief/answer",
                     json={"role": "lead", "question_claim_id": target["claim_id"], "answer": "Kabir owns it from April."})
    assert ok.status_code == 200
    ans = ok.json()["answer_claim"]
    assert ans["kind"] == "debrief" and ans["review_state"] == "pending"
    assert ans["evidence"][0]["quote"] == "Kabir owns it from April."
    after = client.get("/api/projects/1/debrief?role=lead").json()["questions"]
    hit = next(q for q in after if q["claim_id"] == target["claim_id"])
    assert hit["answered"] and hit["answer_claim_id"] == ans["id"]
    # The answer is not in any handover until a person approves it.
    handover = client.get("/api/projects/1/handover?role=lead").json()
    assert all(c["id"] != ans["id"] for c in handover["claims"])
    ctx = client.get(f"/api/claims/{ans['id']}/context?role=lead").json()
    assert ctx["contexts"][0]["chunk_text"] == "Kabir owns it from April."
