"""Repository map: file tree, flags and timeline from the project's git records."""
import pytest
from fastapi.testclient import TestClient

from app.db import create_db_and_tables
from app.main import app


@pytest.fixture(scope="module")
def client():
    create_db_and_tables()
    with TestClient(app) as c:
        pid = c.post("/api/sample/reset").json()["project_id"]
        c.pid = pid
        yield c


def test_repo_map_shape(client):
    r = client.get(f"/api/projects/{client.pid}/repo-map?role=lead")
    assert r.status_code == 200, r.text
    m = r.json()
    assert not m["empty"]
    assert m["files"] and m["timeline"] and m["authors"]
    assert m["authors"][0] == m["leaver"]
    paths = [f["path"] for f in m["files"]]
    assert paths == sorted(paths)
    for f in m["files"]:
        assert f["edits"] >= f["leaver_edits"] >= 0
        assert sum(n for _, n in f["authors"]) == f["edits"]
    n = len(m["files"])
    for day, author, idx in m["timeline"]:
        assert day >= 0 and 0 <= author < len(m["authors"])
        assert all(0 <= i < n for i in idx)
    assert sum(len(t[2]) for t in m["timeline"]) == sum(f["edits"] for f in m["files"])
    assert m["modules"]
    assert any(t["kind"] in ("sole_knowledge", "reverted_work", "stale_module") for t in m["tripwires"])


def test_repo_map_respects_role(client):
    lead = client.get(f"/api/projects/{client.pid}/repo-map?role=lead").json()
    dev = client.get(f"/api/projects/{client.pid}/repo-map?role=incoming_dev").json()
    assert len(dev["claims"]) <= len(lead["claims"])
    assert len(dev["tripwires"]) <= len(lead["tripwires"])


def test_repo_map_unknown_project(client):
    assert client.get("/api/projects/999999/repo-map?role=lead").status_code == 404
