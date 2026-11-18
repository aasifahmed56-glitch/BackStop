"""Exporter for real-project datasets: format, pseudonyms, privacy."""
import json
import os
import subprocess
from datetime import date
from pathlib import Path

import pytest

from app.derived import compute_ownership, parse_commits_from_chunks
from app.ingest import parse_git_log
from app.realdata import export_dataset


def _git(repo: Path, *args: str, env: dict | None = None) -> None:
    subprocess.run(["git", "-C", str(repo), *args], check=True, capture_output=True, env=env)


def _commit(repo: Path, name: str, email: str, when: str, path: str, msg: str) -> None:
    f = repo / path
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text(f.read_text() + "x\n" if f.exists() else "x\n")
    env = {**os.environ, "GIT_AUTHOR_NAME": name, "GIT_AUTHOR_EMAIL": email,
           "GIT_COMMITTER_NAME": name, "GIT_COMMITTER_EMAIL": email,
           "GIT_AUTHOR_DATE": when, "GIT_COMMITTER_DATE": when}
    _git(repo, "add", "-A", env=env)
    _git(repo, "commit", "-q", "-m", msg, env=env)


@pytest.fixture
def tiny_repo(tmp_path: Path) -> Path:
    repo = tmp_path / "repo"
    repo.mkdir()
    _git(repo, "init", "-q")
    _commit(repo, "Alice Real", "alice@real.example", "2020-01-01T10:00:00+0000", "lib/core.js", "Add core")
    _commit(repo, "alice real", "alice@other.example", "2020-02-01T10:00:00+0000", "lib/core.js",
            "Tweak core, thanks Bob Smith\n\nSigned-off-by: Alice Real <alice@real.example>")
    _commit(repo, "ally-handle", "a@x.example", "2020-03-01T10:00:00+0000", "lib/util.js",
            "Merge pull request #3 from bobsmith/fix\n\nkey sk_live_abcdefghijklmnop leaked")
    _commit(repo, "Bob Smith", "bob@real.example", "2020-06-01T10:00:00+0000", "docs/readme.md",
            "Docs by @bobsmith, mail bob@real.example")
    return repo


def test_export_pseudonymises_and_matches_ingest_format(tiny_repo: Path, tmp_path: Path):
    out = tmp_path / "out"
    meta = export_dataset(tiny_repo, out, name="tiny", departure_date=date(2020, 3, 1),
                          leaver="Alice Real", repo_url="https://github.com/o/r", licence="MIT",
                          aliases=[["Alice Real", "ally-handle"]])
    log = (out / "git_log.txt").read_text()

    # No real names, handles or emails anywhere in the output folder.
    everything = "".join(p.read_text() for p in out.iterdir())
    for secret in ["Alice", "alice", "Bob Smith", "bobsmith", "ally-handle", "@real.example",
                   "sk_live_abcdefghijklmnop"]:
        assert secret not in everything, secret
    assert "Signed-off-by" not in log

    # Aliases merged: one person, labelled by first commit.
    assert meta["leaver"] == "Contributor A"
    assert meta["contributor_count"] == 2
    assert meta["commit_count"] == 4
    assert json.loads((out / "manifest.json").read_text()) == {"git_log.txt": "public"}
    assert (out / "LICENSE_NOTICE.md").exists()

    # Loads through the existing ingest and derived code.
    chunks = parse_git_log(log, source_id=1)
    for i, c in enumerate(chunks):
        c.id = i + 1
    commits = parse_commits_from_chunks(chunks)
    assert len(commits) == 4
    assert {c["author"] for c in commits} == {"Contributor A", "Contributor B"}
    own = {o["module"]: o for o in compute_ownership(commits, "Contributor A", date(2020, 3, 1))}
    assert own["lib"]["leaver_count"] == 3
    assert "docs" not in own  # after the cutoff


def test_export_respects_until(tiny_repo: Path, tmp_path: Path):
    meta = export_dataset(tiny_repo, tmp_path / "o", name="t", departure_date=date(2020, 3, 1),
                          leaver="Alice Real", repo_url="https://github.com/o/r", licence="MIT",
                          until=date(2020, 4, 1))
    assert meta["commit_count"] == 3
