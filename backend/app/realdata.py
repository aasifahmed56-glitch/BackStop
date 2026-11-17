"""
Real-project datasets: turn a clone of a PUBLIC repository into a Backstop dataset.

Used by backend/scripts/export_real_project.py (offline export) and by the
GitHub import endpoint. Plain code only, no AI.

Privacy rules applied here:
  - Contributors become stable pseudonyms ("Contributor A", "B", ...), ordered
    by their first commit. Real names and emails are never written.
  - Author aliases (same email, same name in a different case, or an explicit
    alias list) are merged BEFORE pseudonymising, so one person stays one person.
  - Commit messages and paths keep their wording but pass through redact()
    (secrets, emails, phones). Trailers that name people (Signed-off-by,
    Co-authored-by, Reviewed-by) are dropped, and "Merge pull request #N from
    <user>/<branch>" loses the user name.
"""
from __future__ import annotations

import json
import re
import subprocess
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Iterable, Optional

from app.redact import redact

# Separators unlikely to appear in commit text.
_REC = "\x1e"
_FLD = "\x1f"
_LOG_FORMAT = _REC + _FLD.join(["%H", "%an", "%ae", "%ad", "%B"]) + _FLD

_TRAILER_RE = re.compile(r"^\s*(signed-off-by|co-authored-by|reviewed-by|acked-by|cc|reported-by|tested-by)\s*:", re.I)
_MERGE_FROM_RE = re.compile(r"(Merge pull request #\d+ from )[^/\s]+/", re.I)
_MENTION_RE = re.compile(r"(?<![\w.])@[A-Za-z0-9][A-Za-z0-9-]{0,38}\b")


@dataclass
class RawCommit:
    sha: str
    name: str
    email: str
    when: datetime
    message: str
    files: list[tuple[str, str]] = field(default_factory=list)  # (status, path)


def read_git_history(repo: Path, until: Optional[date] = None, max_commits: Optional[int] = None,
                     timeout: int = 60) -> list[RawCommit]:
    """Read commits (oldest first) with their changed files. Uses an argument list, never a shell."""
    args = ["git", "-C", str(repo), "log", "--no-merges", "--name-status", "--no-renames",
            "--date=raw", f"--format={_LOG_FORMAT}"]
    if until:
        args.append(f"--until={until.isoformat()} 23:59:59")
    if max_commits:
        args.append(f"--max-count={int(max_commits)}")
    out = subprocess.run(args, capture_output=True, text=True, timeout=timeout, check=True,
                         encoding="utf-8", errors="replace").stdout
    commits: list[RawCommit] = []
    for rec in out.split(_REC):
        if not rec.strip():
            continue
        parts = rec.split(_FLD)
        if len(parts) < 6:
            continue
        sha, name, email, raw_date, body, tail = parts[0], parts[1], parts[2], parts[3], parts[4], parts[5]
        secs, _, off = raw_date.strip().partition(" ")
        when = datetime.fromtimestamp(int(secs), tz=_tz(off))
        files = []
        for line in tail.splitlines():
            bits = line.split("\t")
            if len(bits) >= 2 and bits[0]:
                files.append((bits[0][0], bits[-1]))
        commits.append(RawCommit(sha.strip(), name.strip(), email.strip().lower(), when, body, files))
    commits.reverse()
    return commits


def _tz(off: str):
    from datetime import timedelta
    try:
        sign = -1 if off.startswith("-") else 1
        h, m = int(off[1:3]), int(off[3:5])
        return timezone(sign * timedelta(hours=h, minutes=m))
    except (ValueError, IndexError):
        return timezone.utc


def build_identities(commits: Iterable[RawCommit], aliases: Optional[list[list[str]]] = None) -> dict[str, int]:
    """
    Merge author identities. Returns a map from identity key ("n:<lower name>" or
    "e:<email>") to a group id. Same email or same name (ignoring case) = same
    person; each inner list of `aliases` names one person.
    """
    parent: dict[str, str] = {}

    def find(x: str) -> str:
        parent.setdefault(x, x)
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a: str, b: str) -> None:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra

    for c in commits:
        n, e = "n:" + c.name.lower(), "e:" + c.email
        find(n)
        if c.email:
            union(n, e)
    for group in aliases or []:
        keys = ["n:" + g.strip().lower() for g in group if g.strip()]
        for k in keys[1:]:
            union(keys[0], k)
    roots: dict[str, int] = {}
    return {k: roots.setdefault(find(k), len(roots)) for k in list(parent)}


def _letters(i: int) -> str:
    s = ""
    i += 1
    while i:
        i, r = divmod(i - 1, 26)
        s = chr(65 + r) + s
    return s


def pseudonymise(commits: list[RawCommit], aliases: Optional[list[list[str]]] = None) -> dict[str, str]:
    """Map each real author name (as written in the log) to 'Contributor X', ordered by first commit."""
    ident = build_identities(commits, aliases)
    group_label: dict[int, str] = {}
    out: dict[str, str] = {}
    for c in commits:  # oldest first
        g = ident["n:" + c.name.lower()]
        if g not in group_label:
            group_label[g] = f"Contributor {_letters(len(group_label))}"
        out[c.name] = group_label[g]
    return out


def clean_message(msg: str, name_re: Optional[re.Pattern] = None,
                  name_map: Optional[dict[str, str]] = None) -> str:
    lines = [ln for ln in msg.strip().splitlines() if not _TRAILER_RE.match(ln)]
    text = "\n".join(lines).strip()
    text = _MERGE_FROM_RE.sub(r"\1", text)
    text = _MENTION_RE.sub("@[user]", text)
    if name_re is not None and name_map:
        text = name_re.sub(lambda m: name_map.get(m.group(0).lower(), "[contributor]"), text)
    return redact(text)


def _name_scrubber(names: dict[str, str], aliases: Optional[list[list[str]]]) -> tuple[Optional[re.Pattern], dict[str, str]]:
    """Regex matching real author names and aliases (4+ chars) inside free text."""
    lookup: dict[str, str] = {n.lower(): p for n, p in names.items()}
    for group in aliases or []:
        label = next((lookup[g.strip().lower()] for g in group if g.strip().lower() in lookup), None)
        for g in group:
            if label and g.strip():
                lookup.setdefault(g.strip().lower(), label)
    keys = sorted((k for k in lookup if len(k) >= 4), key=len, reverse=True)
    if not keys:
        return None, lookup
    return re.compile(r"(?<![\w])(" + "|".join(re.escape(k) for k in keys) + r")(?![\w])", re.I), lookup


def format_git_log(commits: list[RawCommit], names: dict[str, str],
                   aliases: Optional[list[list[str]]] = None) -> str:
    """Write commits in the exact format app.ingest.parse_git_log reads."""
    name_re, lookup = _name_scrubber(names, aliases)
    blocks = []
    for c in commits:
        msg = clean_message(c.message, name_re, lookup) or "(no message)"
        body = "\n".join("    " + ln if ln.strip() else "" for ln in msg.splitlines())
        files = "\n".join(f"      {s} {redact(p)}" for s, p in c.files)
        blocks.append(
            f"commit {c.sha}\n"
            f"Author: {names[c.name]}\n"
            f"Date:   {c.when.strftime('%a %b %d %H:%M:%S %Y %z')}\n\n"
            f"{body}\n\n"
            f"    Files changed:\n{files}\n"
        )
    return "\n".join(blocks)


def export_dataset(repo: Path, out_dir: Path, *, name: str, departure_date: date, leaver: str,
                   repo_url: str, licence: str, evidence_url: str = "",
                   aliases: Optional[list[list[str]]] = None, until: Optional[date] = None,
                   max_commits: Optional[int] = None, timeout: int = 60) -> dict:
    """Export a pseudonymised dataset folder. Returns the metadata written."""
    commits = read_git_history(repo, until=until, max_commits=max_commits, timeout=timeout)
    if not commits:
        raise ValueError("The repository has no commits in the requested range.")
    names = pseudonymise(commits, aliases)
    ident = build_identities(commits, aliases)
    leaver_key = "n:" + leaver.strip().lower()
    leaver_label = None
    if leaver_key in ident:
        g = ident[leaver_key]
        leaver_label = next(names[c.name] for c in commits if ident["n:" + c.name.lower()] == g)

    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "git_log.txt").write_text(format_git_log(commits, names, aliases), encoding="utf-8")
    (out_dir / "manifest.json").write_text(json.dumps({"git_log.txt": "public"}, indent=2) + "\n", encoding="utf-8")
    meta = {
        "name": name,
        "repository_url": repo_url,
        "licence": licence,
        "retrieved": date.today().isoformat(),
        "departure_date": departure_date.isoformat(),
        "departure_evidence": evidence_url,
        "leaver": leaver_label,
        "commit_count": len(commits),
        "contributor_count": len(set(names.values())),
        "first_commit": commits[0].when.date().isoformat(),
        "last_commit": commits[-1].when.date().isoformat(),
        "privacy": "Contributors are pseudonymised; emails removed; messages and paths redacted for secrets.",
    }
    (out_dir / "metadata.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    (out_dir / "LICENSE_NOTICE.md").write_text(
        f"# Licence notice\n\nThis folder is derived from the commit history of {repo_url}, "
        f"which is published under the {licence} licence. Commit messages and file paths are "
        f"reproduced from that history for research and evaluation. Contributor names and emails "
        f"have been replaced with pseudonyms. All credit for the original work belongs to the "
        f"project's contributors.\n", encoding="utf-8")
    return meta
