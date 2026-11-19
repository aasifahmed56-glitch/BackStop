"""
Repository map: the project's git history as a file tree.

GET /api/projects/{id}/repo-map?role=...

Built from the git records the role may see. For every file: how many commits
touched it, by whom, how many by the person leaving, first and last commit, and
whether its last change deleted it. Directories add up their files. Flags come
from the same places as the rest of Backstop: the risk score per module
(derived.compute_knowledge_at_risk_score), the tripwires the role may see, and
the claims the role may see that name a module. Also returns a compact commit
timeline so the page can replay the history.

Plain code only. Paths, authors and messages are the stored (pseudonymised and
redacted) values; no raw source text is returned.
"""
from __future__ import annotations

import re
from collections import Counter, defaultdict
from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.db import get_session
from app.derived import (
    _DEFAULT_STALE_DAYS,
    _module_of,
    compute_knowledge_at_risk_score,
    compute_ownership,
    compute_stale_modules,
    parse_commits_from_chunks,
)
from app.models import Chunk, Claim, Project, ReviewState, Role, Source, SourceKind, role_can_see
from app.tripwires import SEVERITY_RANK, build_tripwires

router = APIRouter(tags=["repo-map"])

MAX_FILES = 4000
MAX_TIMELINE = 3000
_STATUS_RE = re.compile(r"^ {6}([A-Z])\S*\s+(\S.*)$")


def _statuses(text: str) -> dict[str, str]:
    """Last status letter per path in one stored commit (A, M, D ...)."""
    out: dict[str, str] = {}
    in_files = False
    for line in text.splitlines():
        if line.strip() == "Files changed:":
            in_files = True
            continue
        if in_files:
            m = _STATUS_RE.match(line.rstrip())
            if m:
                out[m.group(2).strip()] = m.group(1)
    return out


def build_repo_map(session: Session, project_id: int, role: Role) -> dict[str, Any]:
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found.")
    leaver = project.leaver_name
    cutoff: date = project.departure_date

    commits: list[dict] = []
    status_by_chunk: dict[int, dict[str, str]] = {}
    sources = session.exec(select(Source).where(Source.project_id == project_id)).all()
    git_sources = [s for s in sources if s.kind == SourceKind.git and role_can_see(role, s.access_level)]
    for s in git_sources:
        chunks = session.exec(select(Chunk).where(Chunk.source_id == s.id)).all()
        for ch in chunks:
            status_by_chunk[ch.id] = _statuses(ch.text)
        commits.extend(parse_commits_from_chunks(chunks))
    commits = [c for c in commits if c.get("date")]
    commits.sort(key=lambda c: (c["date"], c["timestamp"].timestamp() if c.get("timestamp") else 0))

    if not commits:
        return {"project_id": project_id, "role": role.value, "leaver": leaver, "empty": True,
                "files": [], "modules": {}, "timeline": [], "authors": [], "tripwires": [], "claims": []}

    # Per file ---------------------------------------------------------------
    edits: Counter = Counter()
    by_author: dict[str, Counter] = defaultdict(Counter)
    first: dict[str, date] = {}
    last: dict[str, date] = {}
    status: dict[str, str] = {}
    fixes: Counter = Counter()
    reverts: Counter = Counter()
    for c in commits:
        st = status_by_chunk.get(c.get("chunk_id"), {})
        msg = c["message"].lower()
        is_revert = msg.startswith("revert")
        is_fix = bool(re.search(r"\b(fix|fixes|fixed|bug)\b", msg))
        for f in dict.fromkeys(c["files"]):
            edits[f] += 1
            by_author[f][c["author"]] += 1
            first.setdefault(f, c["date"])
            last[f] = c["date"]
            status[f] = st.get(f, "M")
            if is_fix:
                fixes[f] += 1
            if is_revert:
                reverts[f] += 1

    paths = sorted(edits, key=lambda p: (-edits[p], p))
    truncated = len(paths) > MAX_FILES
    paths = sorted(paths[:MAX_FILES])
    index = {p: i for i, p in enumerate(paths)}

    authors_total: Counter = Counter()
    for c in commits:
        authors_total[c["author"]] += 1
    authors = [a for a, _ in authors_total.most_common()]
    if leaver in authors:
        authors.remove(leaver)
        authors.insert(0, leaver)
    aidx = {a: i for i, a in enumerate(authors)}

    files = []
    for p in paths:
        files.append({
            "path": p,
            "edits": edits[p],
            "leaver_edits": by_author[p].get(leaver, 0),
            "authors": [[aidx[a], n] for a, n in by_author[p].most_common()],
            "first": first[p].isoformat(),
            "last": last[p].isoformat(),
            "deleted": status.get(p) == "D",
            "fixes": fixes[p],
            "reverts": reverts[p],
        })

    # Per module: the same risk score the claims use ---------------------------
    own = compute_ownership(commits, leaver, cutoff)
    stale = compute_stale_modules(commits, cutoff, _DEFAULT_STALE_DAYS)
    scores = compute_knowledge_at_risk_score(own, stale, leaver, _DEFAULT_STALE_DAYS)
    stale_days = {s["module"]: s["days_stale"] for s in stale}
    modules = {
        o["module"]: {
            "risk": scores.get(o["module"], 0.0),
            "leaver_share": o["leaver_share"],
            "days_stale": stale_days.get(o["module"]),
        }
        for o in own
    }

    # Tripwires the role may see -------------------------------------------------
    built = build_tripwires(session, project_id, role)
    tws = sorted(built["tripwires"], key=lambda t: (SEVERITY_RANK.get(t.severity, 9), t.id))
    tripwires = [{
        "id": t.id, "kind": t.kind, "severity": t.severity, "title": t.title, "warning": t.warning,
        "modules": t.modules, "files": [f for f in t.files if f in index], "contacts": t.contacts,
    } for t in tws]

    # Claims the role may see that name a module ----------------------------------
    known = sorted({_module_of(p) for p in paths} - {"root"}, key=len, reverse=True)
    claims = []
    for c in session.exec(select(Claim).where(Claim.project_id == project_id)).all():
        if c.review_state == ReviewState.rejected or not role_can_see(role, c.access_level):
            continue
        mods = [m for m in known if re.search(rf"(?<![\w/.-]){re.escape(m)}(?:/|\b)", c.text)]
        if not mods:
            continue
        claims.append({
            "id": c.id, "text": c.text[:240], "type": c.type.value, "kind": c.kind.value,
            "status": c.status.value, "review_state": c.review_state.value, "modules": mods,
        })

    # Timeline for the replay: [days since first commit, author, [file indexes]] ----
    t0 = commits[0]["date"]
    timeline = []
    for c in commits[-MAX_TIMELINE:]:
        idx = [index[f] for f in dict.fromkeys(c["files"]) if f in index]
        if idx:
            timeline.append([(c["date"] - t0).days, aidx[c["author"]], idx])

    return {
        "project_id": project_id,
        "role": role.value,
        "empty": False,
        "leaver": leaver,
        "departure_date": cutoff.isoformat(),
        "start_date": t0.isoformat(),
        "end_date": commits[-1]["date"].isoformat(),
        "commit_count": len(commits),
        "file_count": len(edits),
        "files_truncated": truncated,
        "sources": [s.name for s in git_sources],
        "authors": authors,
        "files": files,
        "modules": modules,
        "tripwires": tripwires,
        "claims": claims,
        "timeline": timeline,
    }


@router.get("/projects/{project_id}/repo-map", summary="The project's git history as a file tree with flags")
def get_repo_map(project_id: int, role: Role = Query(Role.incoming_dev), session: Session = Depends(get_session)):
    return build_repo_map(session, project_id, role)
