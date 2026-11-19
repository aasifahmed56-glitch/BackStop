"""
POST /api/import/github: analyse a public GitHub repository on the fly.

Safety limits:
  - URL must be exactly https://github.com/<owner>/<repo> (optional .git or /).
  - git runs with an argument list (never a shell), no credential prompts,
    in a temporary directory that is always deleted, with a hard time limit.
  - bare, blob-less download of only the needed window of history (from a
    few years before the date up to the commit at the end date when the GitHub
    API names it); a shorter window if that is slow; at most MAX_COMMITS commits.
  - one import at a time; at most RATE_LIMIT imports per hour per client.
  - authors are pseudonymised and messages redacted with the same code as the
    offline exporter; nothing is written to disk or the database.
"""
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import tempfile
import threading
import time
import urllib.parse
import urllib.request
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
LOG_TIMEOUT = 45
API_TIMEOUT = 8
MAX_COMMITS = 10000
# How far back to read before the date: enough for the ranking and the
# controls up to 24 months earlier (backtest), or for ownership (project import).
BACKTEST_HISTORY = timedelta(days=365 * 4)
PROJECT_HISTORY = timedelta(days=365 * 3)
SHA_RE = re.compile(r"[0-9a-f]{40}")
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


def _commit_at(owner: str, repo: str, end: date) -> Optional[str]:
    """The default branch's last commit on or before `end`, from the GitHub API; None if unavailable."""
    if os.getenv("GITHUB_API_DISABLED"):
        return None
    q = urllib.parse.urlencode({"until": f"{end.isoformat()}T23:59:59Z", "per_page": 1})
    req = urllib.request.Request(f"https://api.github.com/repos/{owner}/{repo}/commits?{q}",
                                 headers={"Accept": "application/vnd.github+json", "User-Agent": "backstop-import"})
    token = os.getenv("GITHUB_TOKEN", "").strip()
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=API_TIMEOUT) as r:
            data = json.loads(r.read(200_000))
        sha = data[0]["sha"] if isinstance(data, list) and data else ""
    except Exception:  # noqa: BLE001 - any failure just means a plain clone
        return None
    return sha if SHA_RE.fullmatch(sha or "") else None


def _clone(url: str, dest: Path, since: Optional[date] = None, sha: Optional[str] = None) -> None:
    """Bare, blob-less download. `since` trims old history; `sha` stops at that commit."""
    env = {**os.environ, "GIT_TERMINAL_PROMPT": "0", "GIT_ASKPASS": "true"}
    run = lambda args: subprocess.run(args, check=True, capture_output=True, timeout=CLONE_TIMEOUT, env=env)  # noqa: E731
    window = [f"--shallow-since={since.isoformat()}"] if since else []
    if sha:
        run(["git", "init", "--quiet", "--bare", str(dest)])
        run(["git", "-C", str(dest), "fetch", "--quiet", "--filter=blob:none", "--no-tags", *window, "--", url, sha])
        run(["git", "-C", str(dest), "update-ref", "HEAD", sha])
        return
    run(["git", "clone", "--quiet", "--bare", "--filter=blob:none", "--no-tags", "--single-branch", *window,
         "--", url, str(dest)])


def _download(owner: str, repo: str, dest: Path, start: date, end: date) -> bool:
    """
    Download as little as possible: from `start` up to the commit at `end`.
    Falls back to a plain clone when the window cannot be used, and to a
    shorter window (the year before `end`) when the first one is too slow.
    Returns True when the shorter window was used.
    """
    url = f"https://github.com/{owner}/{repo}.git"
    sha = _commit_at(owner, repo, end)
    windows = [start] + ([end - timedelta(days=365)] if end - timedelta(days=365) > start else [])
    for i, since in enumerate(windows):
        tries = [(since, sha), (since, None), (None, None)] if sha else [(since, None), (None, None)]
        try:
            for j, (s, h) in enumerate(tries):
                shutil.rmtree(dest, ignore_errors=True)
                try:
                    _clone(url, dest, since=s, sha=h)
                    return i > 0
                except subprocess.CalledProcessError:
                    if j == len(tries) - 1:
                        raise
        except subprocess.TimeoutExpired:
            if i == len(windows) - 1:
                raise
    raise AssertionError("unreachable")


def fetch_history(owner: str, repo: str, start: date, end: date) -> tuple[list, dict]:
    """
    Read the commits between `start` and `end` (oldest first) from a public
    repository. Large repositories are trimmed to recent history rather than
    failing. The temporary copy is always deleted.
    """
    tmp = Path(tempfile.mkdtemp(prefix="backstop-import-"))
    dest = tmp / "repo.git"
    try:
        try:
            narrowed = _download(owner, repo, dest, start, end)
        except subprocess.TimeoutExpired:
            raise HTTPException(504, "GitHub was too slow to send even the most recent history. Please try again in a minute.")
        except subprocess.CalledProcessError:
            raise HTTPException(404, "That repository could not be downloaded. Check that it exists and is public.")
        shallow_file = dest / "shallow"
        boundary = set(shallow_file.read_text().split()) if shallow_file.exists() else set()
        raw = None
        for limit in (MAX_COMMITS, MAX_COMMITS // 4):
            try:
                raw = read_git_history(dest, until=end, max_commits=limit + len(boundary), timeout=LOG_TIMEOUT)
                break
            except subprocess.TimeoutExpired:
                continue
            except subprocess.CalledProcessError:
                raise HTTPException(422, "The repository history could not be read.")
        if raw is None:
            raise HTTPException(504, "Reading the history took too long. Please try again in a minute.")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    # Commits at the cut edge look as if they added every file; leave them out.
    raw = [c for c in raw if c.sha not in boundary][-MAX_COMMITS:]
    trimmed_from = (narrowed and end - timedelta(days=365)) or (start if boundary else None)
    return raw, {"trimmed_from": trimmed_from, "limit_reached": len(raw) >= MAX_COMMITS}


def trimmed_note(info: dict) -> Optional[str]:
    if info.get("trimmed_from"):
        return (f"The repository is large, so only commits since {info['trimmed_from'].isoformat()} were read "
                "to keep the import fast.")
    return None


def analyse_repository(url: str, departure: date, leaver: Optional[str] = None) -> dict:
    owner, repo = validate_url(url)
    clean_url = f"https://github.com/{owner}/{repo.removesuffix('.git')}"
    if shutil.which("git") is None:
        raise HTTPException(503, "Live import is not available on this server. The mocha dataset shows the same analysis.")
    raw, info = fetch_history(owner, repo.removesuffix(".git"), departure - BACKTEST_HISTORY,
                              departure + timedelta(days=365))

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
        "commit_limit_reached": info["limit_reached"],
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
    if trimmed_note(info):
        result["limitations"].insert(1, trimmed_note(info))
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
