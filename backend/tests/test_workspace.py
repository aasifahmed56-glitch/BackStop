"""Workspaces: create a project, add records, analyse offline, review, delete."""
import pytest
from fastapi.testclient import TestClient

from app.db import create_db_and_tables
from app.main import app
from app.models import ClaimType
from app.rules import classify, sentences
from app.workspace import normalise_git_log

GIT_LOG = "\n".join(
    f"""commit {i:040x}
Author: {'Asha Rao' if i % 4 else 'Ben Ode'} <person{i}@example.com>
Date:   Mon Mar {1 + i % 27} 10:00:00 2025 +0000

    {'Fix billing retry' if i % 3 else 'Revert "Speed up billing cache"'}

M\tbilling/retry.py
A\tbilling/cache_{i}.py
"""
    for i in range(1, 25)
)

NOTES = """# Billing handover

We decided to keep the nightly retry job.

We switched to Postgres because SQLite locked under load.

Don't run the migration script twice, it duplicates invoices.

The payment webhook depends on the Acme API key in the vault.

Who approves refunds over 500?

Contact Priya Nair at priya@example.com for the Acme account.
"""


@pytest.fixture(scope="module")
def client():
    create_db_and_tables()
    with TestClient(app) as c:
        c.post("/api/sample/reset")
        yield c


def test_rules_classify_plain_sentences():
    assert classify("Who approves refunds over 500?") == ClaimType.open_question
    assert classify("Deploys are blocked waiting on the vendor.") == ClaimType.blocker
    assert classify("We decided to keep the nightly job.") == ClaimType.decision
    assert classify("Don't run the script twice.") == ClaimType.risk
    assert classify("The weather was nice that week.") is None
    assert list(sentences("- First item is long enough here. Second one is long enough too."))[1].startswith("Second")


def test_normalise_plain_git_log_drops_emails():
    text, n, with_files = normalise_git_log(GIT_LOG)
    assert n == 24 and with_files == 24
    assert "@example.com" not in text and "Files changed:" in text and "Author: Asha Rao" in text


def test_only_lead_creates_and_sample_is_read_only(client):
    body = {"name": "Billing", "leaver_name": "Asha Rao", "departure_date": "2025-04-01"}
    for role in ("incoming_dev", "incoming_pm", "admin", None):
        b = dict(body, role=role) if role else body
        assert client.post("/api/projects", json=b).status_code in (403, 422)
    assert client.post("/api/projects", json=dict(body, role="lead", name="Campus Event App")).status_code == 409
    r = client.post("/api/projects/1/sources/paste", json={"role": "lead", "kind": "note", "text": "hello there world"})
    assert r.status_code == 409
    assert client.delete("/api/projects/1", params={"role": "lead"}).status_code == 409


def test_full_loop_offline(client):
    r = client.post("/api/projects", json={"role": "lead", "name": "Billing", "leaver_name": "Asha Rao", "departure_date": "2025-04-01"})
    assert r.status_code == 201, r.text
    pid = r.json()["id"]
    assert any(p["id"] == pid for p in client.get("/api/projects").json())

    r = client.post(f"/api/projects/{pid}/analyse", json={"role": "lead"})
    assert r.status_code == 422  # nothing to analyse yet

    assert client.post(f"/api/projects/{pid}/sources/paste", json={"role": "lead", "kind": "git", "text": GIT_LOG}).status_code == 201
    r = client.post(f"/api/projects/{pid}/sources/paste", json={"role": "lead", "kind": "note", "name": "handover notes", "access_level": "restricted", "text": NOTES})
    assert r.status_code == 201 and r.json()["name"] == "handover_notes.md"
    bad = client.post(f"/api/projects/{pid}/sources/paste", json={"role": "lead", "kind": "issue", "text": "not json"})
    assert bad.status_code == 400 and "JSON" in bad.json()["detail"]

    r = client.post(f"/api/projects/{pid}/analyse", json={"role": "lead"})
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["derived"] > 0 and out["rules_added"] >= 5

    claims = client.get("/api/claims", params={"project_id": pid, "role": "lead"}).json()
    rule = [c for c in claims if c["kind"] == "rule"]
    texts = " ".join(c["text"] for c in rule)
    assert "priya@example.com" not in texts  # contact details are masked in claim text
    assert any(c["status"] == "missing" and "nightly retry" in c["text"] for c in rule)  # decision with no reason
    assert any(c["status"] == "inferred" and "Postgres" in c["text"] for c in rule)
    assert all(c["review_state"] == "pending" for c in rule)

    # Restricted notes stay out of a newcomer's view.
    dev = client.get("/api/claims", params={"project_id": pid, "role": "incoming_dev"}).json()
    assert "Postgres" not in str([c for c in dev if not c.get("withheld")])
    assert client.get(f"/api/projects/{pid}/sources", params={"role": "incoming_dev"}).json()["withheld_count"] == 1

    # Re-analysing keeps a person's review on rule claims.
    target = next(c for c in rule if c["status"] == "inferred")
    assert client.post(f"/api/claims/{target['id']}/approve", json={"role": "lead"}).status_code == 200
    again = client.post(f"/api/projects/{pid}/analyse", json={"role": "lead"}).json()
    assert again["rules_added"] == 0
    after = {c["id"]: c for c in client.get("/api/claims", params={"project_id": pid, "role": "lead"}).json()}
    assert after[target["id"]]["review_state"] == "approved"

    # Debrief works on the new project.
    deb = client.get(f"/api/projects/{pid}/debrief", params={"role": "lead"}).json()
    assert deb["questions"]

    # Removing the notes removes the claims that cite only them.
    src = next(s for s in client.get(f"/api/projects/{pid}/sources", params={"role": "lead"}).json()["sources"] if s["kind"] == "note")
    assert client.delete(f"/api/projects/{pid}/sources/{src['id']}", params={"role": "incoming_dev"}).status_code == 403
    gone = client.delete(f"/api/projects/{pid}/sources/{src['id']}", params={"role": "lead"}).json()
    assert gone["claims_removed"] >= 5

    assert client.delete(f"/api/projects/{pid}", params={"role": "incoming_pm"}).status_code == 403
    assert client.delete(f"/api/projects/{pid}", params={"role": "lead"}).status_code == 200
    assert client.get(f"/api/projects/{pid}").status_code == 404


def _github_into_new_project(client, monkeypatch, tmp_path, before, name):
    import subprocess
    import app.githubimport as gi
    from tests.test_realdata_export import _commit, _git

    gi._hits.clear()
    repo = tmp_path / "src"
    repo.mkdir()
    _git(repo, "init", "-q")
    for i in range(before):
        _commit(repo, "Lead Dev", "lead@x.example", f"2024-02-{10 + i:02d}T10:00:00+0000", "lib/a/f.js", f"work {i}")
    _commit(repo, "Later", "later@x.example", "2025-08-01T10:00:00+0000", "lib/a/f.js", "after leaving")
    monkeypatch.setattr(gi, "_clone", lambda url, dest, **kw: subprocess.run(["git", "clone", "-q", "--bare", str(repo), str(dest)], check=True))
    pid = client.post("/api/projects", json={"role": "lead", "name": name, "leaver_name": "Someone", "departure_date": "2025-04-01"}).json()["id"]
    return client.post(f"/api/projects/{pid}/sources/github", json={"role": "lead", "url": "https://github.com/o/r"})


def test_github_import_with_two_commits_runs_with_low_confidence_note(client, monkeypatch, tmp_path):
    r = _github_into_new_project(client, monkeypatch, tmp_path, 2, "Few Commits")
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["commit_count"] == 2 and body["low_confidence"] is True
    assert "Only 2 commits" in body["note"]


def test_github_import_with_no_commits_before_departure_is_empty(client, monkeypatch, tmp_path):
    r = _github_into_new_project(client, monkeypatch, tmp_path, 0, "No Commits")
    assert r.status_code == 422 and "no commits before" in r.json()["detail"]
