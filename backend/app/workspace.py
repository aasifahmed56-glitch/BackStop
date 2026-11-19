"""
Workspaces: real handover projects beyond the sample (plain code, no AI).

  GET    /api/projects                         List projects with their counts
  POST   /api/projects                         Create a project (lead only)
  DELETE /api/projects/{id}                    Delete a project and everything in it (lead only, never the sample)
  GET    /api/projects/{id}/sources            Sources the role may see, with chunk counts
  POST   /api/projects/{id}/sources/paste      Add a record by pasting text (lead only)
  POST   /api/projects/{id}/sources/github     Add the commit history of a public GitHub repository (lead only)
  POST   /api/projects/{id}/analyse            Build claims: code rules over git and tasks,
                                               the extractor where a model or cache answers,
                                               and keyword rules for everything else

The role in the request is checked against a fixed list, and the sign-in
layer has already refused any role the account may not act as.
The sample project is read-only here so the demo stays reproducible.
"""
from __future__ import annotations

import json
import re
import shutil
from collections import defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field as PField
from sqlmodel import Session, select

from app.db import get_session
from app.ingest import _parse_git_date, _parse_source
from app.models import (
    AccessLevel,
    AuditLog,
    Chunk,
    Claim,
    ClaimKind,
    ClaimVersion,
    Project,
    ReviewState,
    Role,
    Source,
    SourceKind,
    role_can_see,
)
from app.redact import redact
from app.review import LOWEST_ROLE
from app.rules import extract_rule_claims

router = APIRouter(tags=["workspace"])

SAMPLE_NAME = "Campus Event App"
MAX_PROJECTS = 200
MAX_SOURCES = 40
MAX_PASTE_CHARS = 2_000_000
EDITORS = {Role.lead}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def is_sample(project: Project) -> bool:
    return project.name == SAMPLE_NAME


def _require_editor(role: Role) -> None:
    if role not in EDITORS:
        raise HTTPException(403, "Only the lead can change a project.")


def _project_or_404(session: Session, project_id: int) -> Project:
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found.")
    return project


def _editable(session: Session, project_id: int, role: Role) -> Project:
    _require_editor(role)
    project = _project_or_404(session, project_id)
    if is_sample(project):
        raise HTTPException(409, "The sample project is read-only. Create your own project to add records.")
    return project


def _clean_name(s: str) -> str:
    return " ".join((s or "").split())


_GIT_HEADER_RE = re.compile(r"^commit ([0-9a-f]{40})\b")
_FILE_LINE_RE = re.compile(r"^([AMDTRC])\d*\t(?:[^\t]+\t)?([^\t]+)$")
_ISO_FORMATS = ("%Y-%m-%d %H:%M:%S %z", "%Y-%m-%dT%H:%M:%S%z", "%a, %d %b %Y %H:%M:%S %z")


def _parse_any_git_date(s: str) -> Optional[datetime]:
    s = s.strip()
    dt = _parse_git_date(s)
    if dt:
        return dt
    for fmt in _ISO_FORMATS:
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            pass
    return None


def normalise_git_log(raw: str) -> tuple[str, int, int]:
    """Turn ordinary `git log --name-status` output into the format the parser
    reads. Emails are dropped and messages redacted. Returns
    (text, commits, commits_with_files)."""
    if "    Files changed:" in raw:
        n = sum(1 for ln in raw.splitlines() if _GIT_HEADER_RE.match(ln.strip()))
        return raw, n, n
    commits: list[dict] = []
    cur: Optional[dict] = None
    for line in raw.splitlines():
        m = _GIT_HEADER_RE.match(line.strip())
        if m:
            cur = {"sha": m.group(1), "author": None, "date": None, "msg": [], "files": []}
            commits.append(cur)
            continue
        if cur is None:
            continue
        if line.startswith("Author:"):
            full = line.split(":", 1)[1].strip()
            cur["author"] = re.sub(r"\s*<[^>]*>\s*$", "", full).strip() or full
        elif line.startswith("Date:"):
            cur["date"] = _parse_any_git_date(line.split(":", 1)[1])
        elif line.startswith("Merge:"):
            continue
        elif line.startswith("    "):
            cur["msg"].append(line[4:].rstrip())
        else:
            fm = _FILE_LINE_RE.match(line.rstrip())
            if fm:
                cur["files"].append((fm.group(1), fm.group(2)))
    blocks = []
    with_files = 0
    for c in commits:
        if not c["author"] or not c["date"]:
            continue
        with_files += bool(c["files"])
        msg = redact("\n".join(c["msg"]).strip()) or "(no message)"
        body = "\n".join("    " + ln if ln.strip() else "" for ln in msg.splitlines())
        files = "\n".join(f"      {s} {redact(p)}" for s, p in c["files"])
        blocks.append(
            f"commit {c['sha']}\n"
            f"Author: {c['author']}\n"
            f"Date:   {c['date'].strftime('%a %b %d %H:%M:%S %Y %z')}\n\n"
            f"{body}\n\n"
            f"    Files changed:\n{files}\n"
        )
    return "\n".join(blocks), len(blocks), with_files


def _counts(session: Session, project: Project) -> dict:
    sources = session.exec(select(Source).where(Source.project_id == project.id)).all()
    claims = session.exec(select(Claim).where(Claim.project_id == project.id)).all()
    pending = sum(1 for c in claims if c.review_state == ReviewState.pending)
    return {
        "id": project.id,
        "name": project.name,
        "leaver_name": project.leaver_name,
        "departure_date": project.departure_date.isoformat(),
        "is_sample": is_sample(project),
        "source_count": len(sources),
        "claim_count": len(claims),
        "pending_count": pending,
        "reviewed_count": len(claims) - pending,
    }


def _store_source(session: Session, project: Project, kind: SourceKind, name: str,
                  level: AccessLevel, text: str) -> tuple[Source, int]:
    existing = session.exec(select(Source).where(Source.project_id == project.id)).all()
    if len(existing) >= MAX_SOURCES:
        raise HTTPException(409, f"A project holds at most {MAX_SOURCES} records. Delete one or start a new project.")
    taken = {s.name for s in existing}
    base, n = name, 2
    while name in taken:
        stem, dot, ext = base.rpartition(".")
        name = f"{stem}-{n}.{ext}" if dot else f"{base}-{n}"
        n += 1
    src = Source(project_id=project.id, kind=kind, name=name, access_level=level, raw_text=text)
    session.add(src)
    session.flush()
    try:
        chunks = _parse_source(src.id, kind, text, name)
    except (json.JSONDecodeError, KeyError, TypeError, ValueError, AttributeError):
        session.rollback()
        hint = {
            SourceKind.issue: 'a JSON list like [{"id": 1, "title": "…", "body": "…", "comments": []}]',
            SourceKind.chat: 'a JSON list like [{"author": "…", "text": "…", "timestamp": "2026-01-02T10:00:00"}]',
        }.get(kind, "plain text")
        raise HTTPException(400, f"That text could not be read as {kind.value} records. Expected {hint}.")
    if not chunks:
        session.rollback()
        raise HTTPException(400, "Nothing to read in that text. Check that it is not empty.")
    for ch in chunks:
        session.add(ch)
    session.add(AuditLog(project_id=project.id, action="source_added", actor_role="lead",
                         detail=f"Added {kind.value} record '{name}' ({len(chunks)} parts)"))
    session.commit()
    session.refresh(src)
    return src, len(chunks)


# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------

class ProjectIn(BaseModel):
    role: Role = LOWEST_ROLE
    name: str = PField(..., min_length=1, max_length=80)
    leaver_name: str = PField(..., min_length=1, max_length=80)
    departure_date: date


@router.get("/projects", summary="List projects with their counts")
def list_projects(request: Request, session: Session = Depends(get_session)):
    from app.org import allowed_projects_for
    allowed = allowed_projects_for(request)
    projects = [p for p in session.exec(select(Project)).all() if allowed is None or p.id in allowed]
    rows = [_counts(session, p) for p in projects]
    rows.sort(key=lambda r: (not r["is_sample"], -r["id"]))
    return rows


@router.post("/projects", summary="Create a handover project (lead only)", status_code=201)
def create_project(body: ProjectIn, request: Request, session: Session = Depends(get_session)):
    _require_editor(body.role)
    name, leaver = _clean_name(body.name), _clean_name(body.leaver_name)
    if not name or not leaver:
        raise HTTPException(400, "Give the project and the person leaving a name.")
    if name.lower() == SAMPLE_NAME.lower():
        raise HTTPException(409, "That name belongs to the sample project. Choose another.")
    if len(session.exec(select(Project)).all()) >= MAX_PROJECTS:
        raise HTTPException(409, "This server holds as many projects as it can. Delete an old one first.")
    project = Project(name=name, leaver_name=leaver, departure_date=body.departure_date)
    session.add(project)
    session.commit()
    session.refresh(project)
    session.add(AuditLog(project_id=project.id, action="project_created", actor_role="lead",
                         detail=f"Project created for {leaver}, leaving {project.departure_date.isoformat()}"))
    session.commit()
    from app.org import attach_new_project
    attach_new_project(session, request, project.id)
    return _counts(session, project)


@router.delete("/projects/{project_id}", summary="Delete a project and everything in it (lead only)")
def delete_project(project_id: int, role: Role = Query(LOWEST_ROLE), session: Session = Depends(get_session)):
    project = _editable(session, project_id, role)
    claims = session.exec(select(Claim).where(Claim.project_id == project_id)).all()
    ids = [c.id for c in claims]
    if ids:
        for v in session.exec(select(ClaimVersion).where(ClaimVersion.claim_id.in_(ids))).all():
            session.delete(v)
        for log in session.exec(select(AuditLog).where(AuditLog.claim_id.in_(ids))).all():
            session.delete(log)
    for log in session.exec(select(AuditLog).where(AuditLog.project_id == project_id)).all():
        session.delete(log)
    for c in claims:
        session.delete(c)
    session.flush()
    from app.org import forget_project
    forget_project(session, project_id)
    for src in session.exec(select(Source).where(Source.project_id == project_id)).all():
        for ch in session.exec(select(Chunk).where(Chunk.source_id == src.id)).all():
            session.delete(ch)
        session.delete(src)
    session.flush()
    session.delete(project)
    session.commit()
    return {"deleted": project_id}


# ---------------------------------------------------------------------------
# Sources
# ---------------------------------------------------------------------------

@router.get("/projects/{project_id}/sources", summary="Records the role may see, with part counts")
def list_sources(project_id: int, role: Role = Query(LOWEST_ROLE), session: Session = Depends(get_session)):
    project = _project_or_404(session, project_id)
    sources = session.exec(select(Source).where(Source.project_id == project_id)).all()
    visible, withheld = [], 0
    for s in sources:
        if not role_can_see(role, s.access_level):
            withheld += 1
            continue
        chunks = session.exec(select(Chunk).where(Chunk.source_id == s.id)).all()
        visible.append({
            "id": s.id, "kind": s.kind, "name": s.name, "access_level": s.access_level,
            "chunk_count": len(chunks), "char_count": len(s.raw_text or ""),
        })
    return {"project": _counts(session, project), "sources": visible, "withheld_count": withheld}


class PasteIn(BaseModel):
    role: Role = LOWEST_ROLE
    kind: SourceKind
    name: str = PField("", max_length=120)
    access_level: AccessLevel = AccessLevel.team
    text: str = PField(..., min_length=1, max_length=MAX_PASTE_CHARS)


_DEFAULT_NAMES = {
    SourceKind.git: "git_log.txt", SourceKind.issue: "issues.json", SourceKind.note: "notes.md",
    SourceKind.task: "tasks.csv", SourceKind.chat: "chat.json",
}
_EXT = {SourceKind.git: ".txt", SourceKind.issue: ".json", SourceKind.note: ".md",
        SourceKind.task: ".csv", SourceKind.chat: ".json"}


@router.post("/projects/{project_id}/sources/paste", summary="Add a record by pasting text (lead only)", status_code=201)
def paste_source(project_id: int, body: PasteIn, session: Session = Depends(get_session)):
    project = _editable(session, project_id, body.role)
    text = body.text.replace("\r\n", "\n")
    if not text.strip():
        raise HTTPException(400, "Paste some text first.")
    note = None
    if body.kind == SourceKind.git:
        text, n, with_files = normalise_git_log(text)
        if not n:
            raise HTTPException(400, "No commits found. Paste the output of: git log --name-status")
        if not with_files:
            note = "No changed files were listed, so modules cannot be ranked. Use git log --name-status."
    name = re.sub(r"[^\w\-./]", "_", _clean_name(body.name)).strip("./") or _DEFAULT_NAMES[body.kind]
    name = name.replace("..", "_")[:120]
    if "." not in Path(name).name:
        name += _EXT[body.kind]
    src, parts = _store_source(session, project, body.kind, name, body.access_level, text)
    return {"source_id": src.id, "name": src.name, "kind": src.kind, "access_level": src.access_level,
            "chunk_count": parts, "note": note}


class GithubIn(BaseModel):
    role: Role = LOWEST_ROLE
    url: str = PField(..., max_length=200)
    leaver: Optional[str] = PField(None, max_length=120)


@router.post("/projects/{project_id}/sources/github", summary="Add a public repository's commit history (lead only)", status_code=201)
def github_source(project_id: int, body: GithubIn, request: Request, session: Session = Depends(get_session)):
    from app import githubimport as gi
    from app.realdata import format_git_log, pseudonymise

    project = _editable(session, project_id, body.role)
    owner, repo = gi.validate_url(body.url)
    repo = repo.removesuffix(".git")
    if shutil.which("git") is None:
        raise HTTPException(503, "Importing from GitHub is not available on this server. Paste a git log instead.")
    client = request.client.host if request.client else "unknown"
    if gi._rate_limited(client):
        raise HTTPException(429, "You have run 3 imports in the last hour. Please wait, or paste a git log instead.")
    if not gi._lock.acquire(blocking=False):
        raise HTTPException(429, "Another import is running. Try again in a minute.")
    try:
        raw, info = gi.fetch_history(owner, repo, project.departure_date - gi.PROJECT_HISTORY, project.departure_date)
    finally:
        gi._lock.release()
    if not raw:
        raise HTTPException(422, "There are no commits before the departure date, so there is nothing to read yet.")
    low_confidence = len(raw) < gi.LOW_CONFIDENCE_COMMITS

    names = pseudonymise(raw, None)
    if body.leaver and body.leaver.strip():
        match = next((n for n in names if n.lower() == body.leaver.strip().lower()), None)
        if not match:
            raise HTTPException(422, "No commits by that author before the departure date. Leave it empty to use the most active person.")
        leaver_label, chosen = names[match], "given"
    else:
        recent = [c for c in raw if c.when.date() > project.departure_date - timedelta(days=365)] or raw
        counts: dict[str, int] = defaultdict(int)
        for c in recent:
            counts[names[c.name]] += 1
        leaver_label = max(counts, key=lambda k: (counts[k], k))
        chosen = "most commits in the year before the departure date"

    text = format_git_log(raw, names)
    src, parts = _store_source(session, project, SourceKind.git, f"github/{owner}-{repo}.txt", AccessLevel.team, text)
    previous = project.leaver_name
    project.leaver_name = leaver_label
    session.add(project)
    session.add(AuditLog(project_id=project.id, action="leaver_mapped", actor_role="lead",
                         detail=f"Person leaving is {leaver_label} in the imported history ({chosen})"))
    session.commit()
    return {
        "source_id": src.id, "name": src.name, "kind": src.kind, "chunk_count": parts,
        "commit_count": len(raw), "commit_limit_reached": info["limit_reached"],
        "contributor_count": len(set(names.values())), "leaver": leaver_label, "leaver_chosen": chosen,
        "low_confidence": low_confidence,
        "note": f"Contributors are pseudonymised. The person leaving is now {leaver_label} (was {previous})."
                + (f" {gi.trimmed_note(info)}" if gi.trimmed_note(info) else "")
                + (f" {gi.low_confidence_note(len(raw))}" if low_confidence else ""),
    }


@router.delete("/projects/{project_id}/sources/{source_id}", summary="Remove a record and the claims that cite only it (lead only)")
def delete_source(project_id: int, source_id: int, role: Role = Query(LOWEST_ROLE), session: Session = Depends(get_session)):
    _editable(session, project_id, role)
    src = session.get(Source, source_id)
    if not src or src.project_id != project_id:
        raise HTTPException(404, "Record not found in this project.")
    removed = 0
    for c in session.exec(select(Claim).where(Claim.project_id == project_id)).all():
        try:
            ev = json.loads(c.evidence_json or "[]")
        except ValueError:
            ev = []
        cited = {e.get("source_id") for e in ev}
        if cited and cited <= {source_id}:
            for v in session.exec(select(ClaimVersion).where(ClaimVersion.claim_id == c.id)).all():
                session.delete(v)
            for log in session.exec(select(AuditLog).where(AuditLog.claim_id == c.id)).all():
                session.delete(log)
            session.delete(c)
            removed += 1
    session.flush()
    for ch in session.exec(select(Chunk).where(Chunk.source_id == source_id)).all():
        session.delete(ch)
    name = src.name
    session.delete(src)
    session.add(AuditLog(project_id=project_id, action="source_removed", actor_role="lead",
                         detail=f"Removed record '{name}' and {removed} claim(s) citing only it"))
    session.commit()
    return {"deleted": source_id, "claims_removed": removed}


# ---------------------------------------------------------------------------
# Analyse
# ---------------------------------------------------------------------------

class AnalyseIn(BaseModel):
    role: Role = LOWEST_ROLE


def run_rules(session: Session, project_id: int, source_ids: Optional[set[int]] = None) -> int:
    """Add keyword-rule claims for the given non-git sources; never duplicates."""
    sources = session.exec(select(Source).where(Source.project_id == project_id)).all()
    known: set[tuple[int, str]] = set()
    for c in session.exec(select(Claim).where(Claim.project_id == project_id, Claim.kind == ClaimKind.rule)).all():
        for e in json.loads(c.evidence_json or "[]"):
            known.add((e.get("source_id"), (e.get("quote") or "").lower()))
    added = 0
    for s in sources:
        if s.kind == SourceKind.git or s.name.startswith("debrief/"):
            continue
        if source_ids is not None and s.id not in source_ids:
            continue
        chunks = session.exec(select(Chunk).where(Chunk.source_id == s.id)).all()
        for claim in extract_rule_claims(project_id, s, chunks, known):
            session.add(claim)
            added += 1
    session.commit()
    return added


@router.post("/projects/{project_id}/analyse", summary="Build claims from every record in the project (lead only)")
def analyse_project(project_id: int, body: AnalyseIn, session: Session = Depends(get_session)):
    project = _editable(session, project_id, body.role)
    from app.derived import derive_claims
    from app.verify import run_extraction_and_verification

    sources = session.exec(select(Source).where(Source.project_id == project_id)).all()
    if not sources:
        raise HTTPException(422, "Add at least one record before analysing.")
    notes: list[str] = []

    derived = 0
    if any(s.kind == SourceKind.git for s in sources):
        try:
            res = derive_claims(project_id, session)
            derived = int(res.get("claims_created", 0)) if isinstance(res, dict) else 0
        except HTTPException as exc:
            notes.append(f"Code rules skipped: {exc.detail}")
    else:
        notes.append("No git history yet, so ownership, stale modules and reverted work were not calculated.")

    non_git = {s.id: s for s in sources if s.kind != SourceKind.git and not s.name.startswith("debrief/")}
    extracted, failed_ids = 0, set(non_git)
    if non_git:
        try:
            stats = run_extraction_and_verification(project_id, session)
            failed_names = {f.get("source") for f in (stats.get("stats", stats).get("failed_sources") or [])}
            failed_ids = {sid for sid, s in non_git.items() if s.name in failed_names}
        except Exception:  # extraction is optional; rules cover every source below
            failed_ids = set(non_git)
        extracted = len(session.exec(select(Claim).where(Claim.project_id == project_id, Claim.kind == ClaimKind.interpreted)).all())
    if failed_ids:
        notes.append(f"{len(failed_ids)} record(s) were read with keyword rules because no AI model is set up for them.")
    ruled = run_rules(session, project_id, failed_ids) if failed_ids else 0

    session.add(AuditLog(project_id=project_id, action="project_analysed", actor_role="lead",
                         detail=f"{derived} from code, {extracted} extracted, {ruled} new from keyword rules"))
    session.commit()
    return {"project": _counts(session, project), "derived": derived, "extracted": extracted,
            "rules_added": ruled, "notes": notes}
