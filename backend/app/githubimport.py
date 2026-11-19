"""
POST /api/import/github: analyse a public GitHub repository on the fly.

Safety limits:
  - URL must be exactly https://github.com/<owner>/<repo> (optional .git or /).
  - git runs with an argument list (never a shell), no credential prompts,
    in a temporary directory that is always deleted, with a hard time limit.
  - bare, blob-less clone; at most MAX_COMMITS commits are read.
  - one import at a time; at most RATE_LIMIT imports per hour per client.
  - authors are pseudonymised and messages redacted with the same code as the
    offline exporter; nothing is written to disk or the database.
"""
from __future__ import annotations

import os
import re
import shutil
import subprocess
import tempfile
import threading
import time
from collections import defaultdict, deque
from datetime import date, timedelta
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.realbacktest import commits_from_log, evaluate_dataset
from app.realdata import format_git_log, pseudonymise, read_git_history

router = APIRouter(prefix="/import", tags=["import"])

URL_RE = re.compile(r"^https://github\.com/([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))/([A-Za-z0-9._-]{1,100}?)(?:\.git)?/?$")
CLONE_TIMEOUT = 60
MAX_COMMITS = 3000
RATE_LIMIT = 3
RATE_WINDOW = 3600

_lock = threading.Lock()
_hits: dict[str, deque] = defaultdict(deque)


class ImportRequest(BaseModel):
    url: str
    departure_date: date
    leaver: Optional[str] = None


def validate_url(url: str) -> tuple[str, str]:
    url = (url or "").strip()
    m = URL_RE.match(url)
    if not m or ".." in url:
        raise HTTPException(422, "Use a public repository link like https://github.com/owner/repo.")
    owner, repo = m.group(1), m.group(2)
    if repo in {".", ".."} or repo.startswith("."):
        raise HTTPException(422, "Use a public repository link like https://github.com/owner/repo.")
    return owner, repo


# Below this many commits before the date the result is still shown, with a note.
LOW_CONFIDENCE_COMMITS = 20


def low_confidence_note(count: int) -> str:
    noun = "commit" if count == 1 else "commits"
    return (f"Only {count} {noun} before the date, so this reading is thin. "
            "Treat the ranking as a starting point and check it with the team.")


def _rate_limited(client: str) -> bool:
    now = time.monotonic()
    q = _hits[client]
    while q and now - q[0] > RATE_WINDOW:
        q.popleft()
    if len(q) >= RATE_LIMIT:
        return True
    q.append(now)
    return False


def _clone(url: str, dest: Path) -> None:
    env = {**os.environ, "GIT_TERMINAL_PROMPT": "0", "GIT_ASKPASS": "true"}
    subprocess.run(
        ["git", "clone", "--quiet", "--bare", "--filter=blob:none", "--no-tags", "--single-branch", "--", url, str(dest)],
        check=True, capture_output=True, timeout=CLONE_TIMEOUT, env=env,
    )


def analyse_repository(url: str, departure: date, leaver: Optional[str] = None) -> dict:
    owner, repo = validate_url(url)
    clean_url = f"https://github.com/{owner}/{repo.removesuffix('.git')}"
    if shutil.which("git") is None:
        raise HTTPException(503, "Live import is not available on this server. The mocha dataset shows the same analysis.")
    tmp = Path(tempfile.mkdtemp(prefix="backstop-import-"))
    try:
        try:
            _clone(clean_url + ".git", tmp / "repo.git")
        except subprocess.TimeoutExpired:
            raise HTTPException(504, "The repository took too long to download. Try a smaller one, or use the mocha dataset.")
        except subprocess.CalledProcessError:
            raise HTTPException(404, "That repository could not be downloaded. Check that it exists and is public.")
        until = departure + timedelta(days=365)
        try:
            raw = read_git_history(tmp / "repo.git", until=until, max_commits=MAX_COMMITS, timeout=30)
        except subprocess.TimeoutExpired:
            raise HTTPException(504, "Reading the history took too long. Try a smaller repository.")
        except subprocess.CalledProcessError:
            raise HTTPException(422, "The repository history could not be read.")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    pre = [c for c in raw if c.when.date() <= departure]
    post = [c for c in raw if c.when.date() > departure]
    if not pre:
        raise HTTPException(422, "There are no commits before that date, so there is nothing to rank yet.")
    if not post:
        raise HTTPException(422, "There are no commits after that date, so there is nothing to check the ranking against.")

    names = pseudonymise(raw, None)
    if leaver:
        match = next((n for n in names if n.lower() == leaver.strip().lower()), None)
        if not match:
            raise HTTPException(422, "No commits by that author before the date. Leave the name empty to use the most active person.")
        leaver_label = names[match]
    else:
        recent = [c for c in pre if c.when.date() > departure - timedelta(days=365)] or pre
        counts: dict[str, int] = defaultdict(int)
        for c in recent:
            counts[names[c.name]] += 1
        leaver_label = max(counts, key=lambda k: (counts[k], k))

    commits = commits_from_log(format_git_log(raw, names))
    meta = {
        "name": f"{owner}/{repo.removesuffix('.git')}",
        "repository_url": clean_url,
        "licence": "not checked",
        "retrieved": date.today().isoformat(),
        "departure_date": departure.isoformat(),
        "departure_evidence": "",
        "leaver": leaver_label,
        "leaver_chosen": "given" if leaver else "most commits in the year before the date",
        "commit_count": len(raw),
        "commits_before_date": len(pre),
        "low_confidence": len(pre) < LOW_CONFIDENCE_COMMITS,
        "commit_limit_reached": len(raw) >= MAX_COMMITS,
        "contributor_count": len(set(names.values())),
        "privacy": "Analysed in memory and deleted; contributors pseudonymised.",
    }
    result = evaluate_dataset(commits, meta)
    result["limitations"] = [
        "Live import: the departure date and leaver are your choice, not verified.",
        f"Only the most recent {MAX_COMMITS:,} commits up to one year after the date are read."
        if meta["commit_limit_reached"] else "All commits up to one year after the date were read.",
        *result["limitations"][1:],
    ]
    if meta["low_confidence"]:
        result["limitations"].insert(0, low_confidence_note(len(pre)))
    return result


@router.post("/github")
def import_github(body: ImportRequest, request: Request):
    validate_url(body.url)
    if body.departure_date > date.today():
        raise HTTPException(422, "The date must be in the past.")
    client = request.client.host if request.client else "unknown"
    if _rate_limited(client):
        raise HTTPException(429, "You have run 3 imports in the last hour. Please wait, or use the mocha dataset.")
    if not _lock.acquire(blocking=False):
        raise HTTPException(429, "Another import is running. Try again in a minute.")
    try:
        return analyse_repository(body.url, body.departure_date, body.leaver)
    finally:
        _lock.release()
