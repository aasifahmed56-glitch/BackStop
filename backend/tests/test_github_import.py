"""GitHub import: strict URL checks, no shell, timeouts, limits, happy path."""
import subprocess
from datetime import date, timedelta
from pathlib import Path

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

import app.githubimport as gi
from app.main import app
from tests.test_realdata_export import _commit, _git

GOOD = ["https://github.com/mochajs/mocha", "https://github.com/a-b/c.d_e.git", "https://github.com/o/r/"]
BAD = [
    "http://github.com/o/r", "https://gitlab.com/o/r", "https://github.com/o", "https://github.com/o/r/tree/main",
    "https://user:pw@github.com/o/r", "https://github.com@evil.com/o/r", "https://github.com/o/..",
    "https://github.com/o/r?x=1", "https://github.com/o/r;rm -rf /", "https://github.com/o/$(id)",
    "https://github.com/o/r`id`", "https://github.com/-o/r", "--upload-pack=touch /tmp/x", "file:///etc",
    "https://github.com/o/r\nx", "", "https://github.com/o/.hidden",
]


@pytest.mark.parametrize("url", GOOD)
def test_accepts_plain_github_urls(url):
    gi.validate_url(url)


@pytest.mark.parametrize("url", BAD)
def test_rejects_other_urls_and_injection(url):
    with pytest.raises(HTTPException) as e:
        gi.validate_url(url)
    assert e.value.status_code == 422


@pytest.fixture(autouse=True)
def reset_limits():
    gi._hits.clear()
    yield
    gi._hits.clear()


@pytest.fixture
def local_repo(tmp_path: Path) -> Path:
    repo = tmp_path / "src"
    repo.mkdir()
    _git(repo, "init", "-q")
    for i in range(25):
        _commit(repo, "Lead Dev", "lead@x.example", f"2020-0{1 + i % 5}-{10 + i % 18:02d}T10:00:00+0000",
                f"lib/m{i % 3}/f.js", f"work {i}")
    _commit(repo, "New Person", "new@x.example", "2020-08-01T10:00:00+0000", "lib/m0/f.js", "fix bug in m0")
    _commit(repo, "New Person", "new@x.example", "2020-08-02T10:00:00+0000", "lib/m0/f.js", "more")
    return repo


def _fake_clone_from(src: Path):
    def fake(url, dest):
        assert url.startswith("https://github.com/")
        subprocess.run(["git", "clone", "-q", "--bare", str(src), str(dest)], check=True)
    return fake


def test_happy_path_with_local_repo(monkeypatch, local_repo):
    monkeypatch.setattr(gi, "_clone", _fake_clone_from(local_repo))
    r = TestClient(app).post("/api/import/github", json={"url": "https://github.com/o/r", "departure_date": "2020-06-01"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["dataset"]["leaver"] == "Contributor A"
    assert body["dataset"]["commit_count"] == 27
    assert "lib/m0" in body["result"]["positives"]
    text = r.text
    assert "Lead Dev" not in text and "x.example" not in text and "New Person" not in text


def test_temp_dir_is_deleted(monkeypatch, local_repo, tmp_path):
    made = []
    real = gi.tempfile.mkdtemp
    monkeypatch.setattr(gi.tempfile, "mkdtemp", lambda **k: made.append(real(**k)) or made[-1])
    monkeypatch.setattr(gi, "_clone", _fake_clone_from(local_repo))
    gi.analyse_repository("https://github.com/o/r", date(2020, 6, 1))
    assert made and not Path(made[0]).exists()


def test_timeout_gives_friendly_error(monkeypatch):
    def slow(url, dest):
        raise subprocess.TimeoutExpired(cmd="git", timeout=60)
    monkeypatch.setattr(gi, "_clone", slow)
    r = TestClient(app).post("/api/import/github", json={"url": "https://github.com/o/r", "departure_date": "2020-06-01"})
    assert r.status_code == 504 and "too long" in r.json()["detail"]


def test_not_found_gives_friendly_error(monkeypatch):
    def missing(url, dest):
        raise subprocess.CalledProcessError(128, "git")
    monkeypatch.setattr(gi, "_clone", missing)
    r = TestClient(app).post("/api/import/github", json={"url": "https://github.com/o/r", "departure_date": "2020-06-01"})
    assert r.status_code == 404


def test_rate_limit_and_future_date(monkeypatch):
    monkeypatch.setattr(gi, "_clone", lambda u, d: (_ for _ in ()).throw(subprocess.CalledProcessError(1, "git")))
    c = TestClient(app)
    future = (date.today() + timedelta(days=2)).isoformat()
    assert c.post("/api/import/github", json={"url": "https://github.com/o/r", "departure_date": future}).status_code == 422
    codes = [c.post("/api/import/github", json={"url": "https://github.com/o/r", "departure_date": "2020-06-01"}).status_code for _ in range(4)]
    assert codes[:3] == [404, 404, 404] and codes[3] == 429


def test_clone_uses_argument_list_without_shell(monkeypatch, tmp_path):
    seen = {}
    def fake_run(args, **kw):
        seen["args"], seen["kw"] = args, kw
        return subprocess.CompletedProcess(args, 0)
    monkeypatch.setattr(gi.subprocess, "run", fake_run)
    gi._clone("https://github.com/o/r.git", tmp_path / "x")
    assert isinstance(seen["args"], list) and not seen["kw"].get("shell")
    assert "--" in seen["args"] and seen["kw"]["timeout"] == gi.CLONE_TIMEOUT
    assert seen["kw"]["env"]["GIT_TERMINAL_PROMPT"] == "0"
