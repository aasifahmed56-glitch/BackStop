"""Tripwires: matching rules, access ceilings, no raw source text, replay rules."""
import json

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.db import create_db_and_tables, engine
from app.main import app
from app.models import (
    AccessLevel, Chunk, Claim, ClaimKind, ClaimStatus, ClaimType, ReviewState, Source,
)
from app.tripwires import (
    Tripwire, files_from_diff, match_change, split_reason, tokens,
)


# ---------------------------------------------------------------------------
# Pure matching
# ---------------------------------------------------------------------------

TW = [
    Tripwire(id="sole-deploy", kind="sole_knowledge", severity="medium", title="t", warning="w",
             modules=["deploy"], keywords=["deploy"]),
    Tripwire(id="rev-ws", kind="reverted_work", severity="high", title="t", warning="w",
             modules=["notifications"], keywords=["websocket", "polling"]),
]


def test_path_match():
    res = match_change(TW, ["deploy/run.sh"], "")
    assert [r["id"] for r in res] == ["sole-deploy"]
    assert res[0]["matched_by"] == ["path"]
    assert "deploy/run.sh is inside deploy/" in res[0]["why"][0]["text"]


def test_keyword_match_is_plural_insensitive():
    res = match_change(TW, [], "Switch to WebSockets for live updates")
    assert [r["id"] for r in res] == ["rev-ws"]
    assert res[0]["why"][0]["matched"] == ["websocket"]


def test_no_match():
    assert match_change(TW, ["web-ui/button.tsx"], "change button colour") == []


def test_high_severity_first():
    res = match_change(TW, ["deploy/x.sh", "notifications/a.py"], "")
    assert [r["severity"] for r in res] == ["high", "medium"]


def test_diff_file_names():
    diff = (
        "diff --git a/deploy/run.sh b/deploy/run.sh\n--- a/deploy/run.sh\n+++ b/deploy/run.sh\n@@ -1 +1 @@\n"
        "diff --git a/old.txt b/old.txt\n--- a/old.txt\n+++ /dev/null\n"
        "--- /dev/null\n+++ b/auth/new.py\n"
    )
    assert files_from_diff(diff) == ["deploy/run.sh", "old.txt", "auth/new.py"]


def test_split_reason():
    assert split_reason("Going with JWT — sessions had issues in demo.") == ("Going with JWT", "sessions had issues in demo")
    assert split_reason("Use Redis because the queue needs persistence") == ("Use Redis", "the queue needs persistence")
    assert split_reason("Stripe wins.") is None


def test_tokens_drop_stopwords():
    assert tokens("Fix the websockets bug") == {"websocket"}


# ---------------------------------------------------------------------------
# API on the sample project
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def client():
    create_db_and_tables()
    with TestClient(app) as c:
        pid = c.post("/api/sample/reset").json()["project_id"]
        c.post(f"/api/claims/bulk-approve-verified?project_id={pid}", json={"role": "lead"})
        c.pid = pid
        yield c


def _check(client, role="incoming_dev", files=(), description="", diff=None):
    r = client.post(f"/api/projects/{client.pid}/tripwires/check",
                    json={"files": list(files), "description": description, "role": role, "diff": diff})
    assert r.status_code == 200, r.text
    return r.json()


def test_websockets_example_fires_reverted_work(client):
    res = _check(client, description="switch notifications to websockets")
    ids = [t["id"] for t in res["triggered"]]
    rev = next(t for t in res["triggered"] if t["kind"] == "reverted_work")
    assert ids[0] == rev["id"]  # high severity first
    assert "Websockets broke on campus wifi" in rev["warning"]
    assert any(e["kind"] == "commit" for e in rev["evidence"])
    assert rev["contacts"]


def test_deploy_example_fires_sole_knowledge_with_contact(client):
    res = _check(client, description="rewrite the deploy scripts")
    sole = [t for t in res["triggered"] if t["kind"] == "sole_knowledge"]
    assert sole and sole[0]["modules"] == ["deploy"]
    assert "Dev" in sole[0]["contacts"]


def test_diff_input_matches_paths(client):
    diff = "--- a/auth/jwt.py\n+++ b/auth/jwt.py\n@@ -1 +1 @@\n-a\n+b\n"
    res = _check(client, diff=diff)
    assert res["files"] == ["auth/jwt.py"]
    kinds = {t["kind"] for t in res["triggered"]}
    assert {"sole_knowledge", "decision"} <= kinds


def test_empty_state_message(client):
    res = _check(client, files=["web-ui/components/comp_1.tsx"], description="tweak button colour")
    assert res["triggered"] == []
    assert res["note"] == "No tripwires matched. This does not mean the change is safe."


def test_input_validation(client):
    r = client.post(f"/api/projects/{client.pid}/tripwires/check", json={"role": "lead"})
    assert r.status_code == 422
    r = client.post(f"/api/projects/{client.pid}/tripwires/check",
                    json={"files": [f"f{i}.py" for i in range(600)], "role": "lead"})
    assert r.status_code == 422
    assert client.post("/api/projects/9999/tripwires/check",
                       json={"description": "x", "role": "lead"}).status_code == 404


@pytest.fixture(scope="module")
def secret_decision(client):
    """A confidential, approved decision with a reason: only admin may see it."""
    with Session(engine) as s:
        src = s.exec(select(Source).where(Source.project_id == client.pid,
                                          Source.name == "notes/budget-confidential.md")).first()
        c = Claim(project_id=client.pid, kind=ClaimKind.interpreted, type=ClaimType.decision,
                  text="Move hosting to Zorblax because the contract is cheaper",
                  evidence_json=json.dumps([{"source_id": src.id, "chunk_id": None,
                                             "quote": "Zorblax contract", "line_start": 1, "line_end": 1}]),
                  status=ClaimStatus.verified, confidence=1.0, access_level=AccessLevel.confidential,
                  review_state=ReviewState.approved)
        s.add(c)
        s.commit()
        s.refresh(c)
        cid = c.id
    yield cid
    with Session(engine) as s:
        s.delete(s.get(Claim, cid))
        s.commit()


@pytest.mark.parametrize("role", ["incoming_dev", "incoming_pm", "lead"])
def test_access_ceiling_hides_restricted_tripwires(client, secret_decision, role):
    listing = client.get(f"/api/projects/{client.pid}/tripwires?role={role}")
    assert listing.status_code == 200
    assert "zorblax" not in listing.text.lower()
    assert listing.json()["claims_withheld"] > 0
    res = _check(client, role=role, description="move hosting to zorblax")
    assert res["triggered"] == []
    assert "zorblax" not in json.dumps(res["triggered"]).lower()


def test_admin_sees_confidential_tripwire(client, secret_decision):
    res = _check(client, role="admin", description="move hosting to zorblax")
    assert [t["claim_ids"] for t in res["triggered"]] == [[secret_decision]]
    assert res["triggered"][0]["access_level"] == "confidential"


def test_lower_role_evidence_is_within_ceiling(client):
    listing = client.get(f"/api/projects/{client.pid}/tripwires?role=incoming_dev").json()
    for tw in listing["tripwires"]:
        assert tw["access_level"] in ("public", "team")
        for ev in tw["evidence"]:
            if ev["kind"] == "claim":
                assert ev["access_level"] in ("public", "team")


def test_no_raw_source_text(client):
    with Session(engine) as s:
        restricted = s.exec(select(Source).where(Source.project_id == client.pid,
                                                 Source.access_level.in_([AccessLevel.restricted,
                                                                          AccessLevel.confidential]))).all()
        chunk_texts = [ch.text for src in restricted
                       for ch in s.exec(select(Chunk).where(Chunk.source_id == src.id)).all()]
        whole_raw = [src.raw_text for src in s.exec(select(Source).where(Source.project_id == client.pid)).all()]
    for role in ("incoming_dev", "lead"):
        body = client.get(f"/api/projects/{client.pid}/tripwires?role={role}").text
        assert "raw_text" not in body and "chunk_text" not in body
        for raw in whole_raw:
            assert raw[:400] not in body
        for t in chunk_texts:
            if len(t) > 40:
                assert t not in body


def test_rejected_claims_are_not_used(client):
    listing = client.get(f"/api/projects/{client.pid}/tripwires?role=lead").json()
    sole = next(t for t in listing["tripwires"] if t["kind"] == "sole_knowledge" and t["modules"] == ["deploy"])
    cid = sole["claim_ids"][0]
    assert client.post(f"/api/claims/{cid}/reject", json={"role": "lead", "reason": "test"}).status_code == 200
    listing = client.get(f"/api/projects/{client.pid}/tripwires?role=lead").json()
    assert all(cid not in t["claim_ids"] for t in listing["tripwires"])
