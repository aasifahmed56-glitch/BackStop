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
    def fake(url, dest, **kw):
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
    def slow(url, dest, **kw):
        raise subprocess.TimeoutExpired(cmd="git", timeout=60)
    monkeypatch.setattr(gi, "_clone", slow)
    r = TestClient(app).post("/api/import/github", json={"url": "https://github.com/o/r", "departure_date": "2020-06-01"})
    assert r.status_code == 504 and "too slow" in r.json()["detail"]


def test_not_found_gives_friendly_error(monkeypatch):
    def missing(url, dest, **kw):
        raise subprocess.CalledProcessError(128, "git")
    monkeypatch.setattr(gi, "_clone", missing)
    r = TestClient(app).post("/api/import/github", json={"url": "https://github.com/o/r", "departure_date": "2020-06-01"})
    assert r.status_code == 404


def test_rate_limit_and_future_date(monkeypatch):
    monkeypatch.setattr(gi, "_clone", lambda u, d, **kw: (_ for _ in ()).throw(subprocess.CalledProcessError(1, "git")))
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


def _small_repo(tmp_path: Path, before: int) -> Path:
    repo = tmp_path / "small"
    repo.mkdir()
    _git(repo, "init", "-q")
    for i in range(before):
        _commit(repo, "Lead Dev", "lead@x.example", f"2020-02-{10 + i:02d}T10:00:00+0000", f"lib/m{i % 2}/f.js", f"work {i}")
    _commit(repo, "New Person", "new@x.example", "2020-08-01T10:00:00+0000", "lib/m0/f.js", "fix bug in m0")
    _commit(repo, "New Person", "new@x.example", "2020-08-02T10:00:00+0000", "lib/m0/f.js", "more")
    return repo


@pytest.mark.parametrize("before", [1, 3])
def test_few_commits_still_run_with_low_confidence_note(monkeypatch, tmp_path, before):
    monkeypatch.setattr(gi, "_clone", _fake_clone_from(_small_repo(tmp_path, before)))
    r = TestClient(app).post("/api/import/github", json={"url": "https://github.com/o/r", "departure_date": "2020-06-01"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["dataset"]["low_confidence"] is True
    assert body["dataset"]["commits_before_date"] == before
    assert body["limitations"][0].startswith(f"Only {before} commit")
    assert body["result"]["modules_ranked"] >= 1


def test_enough_commits_have_no_low_confidence_note(monkeypatch, local_repo):
    monkeypatch.setattr(gi, "_clone", _fake_clone_from(local_repo))
    body = gi.analyse_repository("https://github.com/o/r", date(2020, 6, 1))
    assert body["dataset"]["low_confidence"] is False
    assert not any(l.startswith("Only ") and "thin" in l for l in body["limitations"])


def test_zero_commits_before_date_is_an_empty_state(monkeypatch, tmp_path):
    monkeypatch.setattr(gi, "_clone", _fake_clone_from(_small_repo(tmp_path, 0)))
    r = TestClient(app).post("/api/import/github", json={"url": "https://github.com/o/r", "departure_date": "2020-06-01"})
    assert r.status_code == 422 and "no commits before" in r.json()["detail"]


def test_large_repo_reads_a_window_and_skips_the_cut_edge(tmp_path, local_repo):
    """A real shallow download: commits older than the window are not read, and
    the commit at the cut edge (which looks as if it added every file) is left out."""
    url = local_repo.as_uri()
    raw, info = None, None
    real_clone = gi._clone
    try:
        gi._clone = lambda u, d, since=None, sha=None: real_clone(url, d, since=since, sha=sha)
        raw, info = gi.fetch_history("o", "r", date(2020, 4, 1), date(2021, 6, 1))
    finally:
        gi._clone = real_clone
    assert raw and all(c.when.date() >= date(2020, 4, 1) for c in raw)
    assert info["trimmed_from"] == date(2020, 4, 1)
    assert "were read to keep the import fast" in gi.trimmed_note(info)


def test_slow_download_falls_back_to_the_last_year(monkeypatch, local_repo):
    calls = []
    real = _fake_clone_from(local_repo)

    def first_slow(url, dest, since=None, sha=None):
        calls.append(since)
        if len(calls) == 1:
            raise subprocess.TimeoutExpired(cmd="git", timeout=60)
        real(url, dest)
    monkeypatch.setattr(gi, "_clone", first_slow)
    raw, info = gi.fetch_history("o", "r", date(2017, 1, 1), date(2021, 6, 1))
    assert calls == [date(2017, 1, 1), date(2020, 6, 1)]
    assert raw and info["trimmed_from"] == date(2020, 6, 1)


def test_window_fetch_falls_back_to_plain_clone(monkeypatch, local_repo):
    calls = []
    real = _fake_clone_from(local_repo)
    monkeypatch.setattr(gi, "_commit_at", lambda *a: "a" * 40)

    def picky(url, dest, since=None, sha=None):
        calls.append((since, sha))
        if since or sha:
            raise subprocess.CalledProcessError(128, "git")
        real(url, dest)
    monkeypatch.setattr(gi, "_clone", picky)
    raw, info = gi.fetch_history("o", "r", date(2019, 1, 1), date(2020, 12, 1))
    assert calls[-1] == (None, None) and raw and info["trimmed_from"] is None
