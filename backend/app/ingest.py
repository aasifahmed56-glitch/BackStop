"""
Ingest pipeline — parse sample / uploaded files into Source + Chunk rows.

Chunking rules (one Chunk per unit):
  git_log.txt  → one Chunk per commit   (author, timestamp, message, files)
  issues.json  → one Chunk per issue body + one Chunk per comment
  notes/*.md   → one Chunk per paragraph (blank-line delimited) with line numbers
  tasks.csv    → one Chunk per row
  chat.json    → one Chunk per message

IMPORTANT: Chunk.text always stores the ORIGINAL text.
           Redaction is applied at call time, never persisted.

Endpoints
  POST /api/sample/load              Load all files from backend/data/sample/
  GET  /api/projects/{id}            Project detail + source / chunk counts
  POST /api/projects/{id}/upload     Upload a file (allow-listed ext, 5 MB cap)
"""
from __future__ import annotations

import csv
import io
import json
import re
from datetime import datetime, date
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlmodel import Session, select

from app.db import get_session
from app.models import (
    AccessLevel,
    Chunk,
    ClaimKind,
    Project,
    Source,
    SourceKind,
)

router = APIRouter(tags=["ingest"])

_SAMPLE_DIR = Path(__file__).parent.parent / "data" / "sample"
_MAX_UPLOAD_BYTES = 5 * 1024 * 1024          # 5 MB
_ALLOWED_EXTS = {".txt", ".json", ".md", ".csv"}

# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/sample/load", summary="Load all files from backend/data/sample/")
def load_sample(session: Session = Depends(get_session)):
    """
    Idempotent: deletes existing sources for the sample project and re-ingests.
    Returns a summary dict.
    """
    if not _SAMPLE_DIR.exists():
        raise HTTPException(404, f"Sample directory not found: {_SAMPLE_DIR}")

    # Create or reuse the sample project
    project = session.exec(
        select(Project).where(Project.name == "Campus Event App")
    ).first()

    if project is None:
        project = Project(
            name="Campus Event App",
            departure_date=date(2026, 3, 15),
            leaver_name="Riya",
        )
        session.add(project)
        session.flush()
    else:
        # Remove existing sources (cascades to chunks via DELETE below)
        existing_sources = session.exec(
            select(Source).where(Source.project_id == project.id)
        ).all()
        for src in existing_sources:
            existing_chunks = session.exec(
                select(Chunk).where(Chunk.source_id == src.id)
            ).all()
            for ch in existing_chunks:
                session.delete(ch)
            session.delete(src)
        session.flush()

    manifest = _load_manifest(_SAMPLE_DIR)
    summary = _ingest_all(session, project, _SAMPLE_DIR, manifest)
    session.commit()

    # Automatically derive claims and load cached LLM claims so Ledger is never empty
    from app.derived import derive_claims
    from app.verify import run_extraction_and_verification

    derive_res = derive_claims(project.id, session)
    try:
        extract_res = run_extraction_and_verification(project.id, session)
    except Exception as e:
        extract_res = {"error": str(e)}

    return {
        "project_id": project.id,
        "project_name": project.name,
        "derived_claims": derive_res.get("claims_created", 0),
        "extracted_claims": (
            extract_res.get("verified", 0)
            + extract_res.get("inferred", 0)
            + extract_res.get("conflicting", 0)
            + extract_res.get("missing", 0)
        ) if isinstance(extract_res, dict) else 0,
        **summary,
    }


@router.get("/projects/{project_id}", summary="Project detail with source/chunk counts")
def get_project(project_id: int, session: Session = Depends(get_session)):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    sources = session.exec(select(Source).where(Source.project_id == project_id)).all()
    total_chunks = sum(
        len(session.exec(select(Chunk).where(Chunk.source_id == s.id)).all())
        for s in sources
    )

    return {
        "id": project.id,
        "name": project.name,
        "leaver_name": project.leaver_name,
        "departure_date": project.departure_date.isoformat(),
        "source_count": len(sources),
        "chunk_count": total_chunks,
        "sources": [
            {
                "id": s.id,
                "kind": s.kind,
                "name": s.name,
                "access_level": s.access_level,
            }
            for s in sources
        ],
    }


@router.post("/projects/{project_id}/upload",
             summary="Upload a file (txt/json/md/csv, max 5 MB)")
async def upload_file(
    project_id: int,
    file: UploadFile = File(...),
    kind: Optional[str] = Form(None),
    access_level: str = Form("team"),
    session: Session = Depends(get_session),
):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    # --- Validate extension ---
    raw_name = file.filename or "upload"
    ext = Path(raw_name).suffix.lower()
    if ext not in _ALLOWED_EXTS:
        raise HTTPException(
            400, f"Extension '{ext}' not allowed. Use: {sorted(_ALLOWED_EXTS)}"
        )

    # --- Sanitise filename (no path traversal) ---
    safe_name = re.sub(r"[^\w\-.]", "_", Path(raw_name).name)

    # --- Read and check size ---
    content_bytes = await file.read()
    if len(content_bytes) > _MAX_UPLOAD_BYTES:
        raise HTTPException(413, f"File exceeds {_MAX_UPLOAD_BYTES // 1024} KB limit")

    raw_text = content_bytes.decode("utf-8", errors="replace")

    # --- Determine SourceKind ---
    detected_kind = _detect_kind(safe_name, ext, kind)

    # --- Validate access_level ---
    try:
        al = AccessLevel(access_level)
    except ValueError:
        raise HTTPException(400, f"Invalid access_level '{access_level}'")

    # --- Store Source (original text preserved) ---
    src = Source(
        project_id=project_id,
        kind=detected_kind,
        name=safe_name,
        access_level=al,
        raw_text=raw_text,
    )
    session.add(src)
    session.flush()

    # --- Parse into chunks ---
    chunks = _parse_source(src.id, detected_kind, raw_text, safe_name)
    for ch in chunks:
        session.add(ch)
    session.commit()

    return {
        "source_id": src.id,
        "name": safe_name,
        "kind": detected_kind,
        "chunk_count": len(chunks),
    }


# ---------------------------------------------------------------------------
# Internal: manifest + orchestrator
# ---------------------------------------------------------------------------

def _load_manifest(sample_dir: Path) -> dict[str, str]:
    p = sample_dir / "manifest.json"
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}


def _ingest_all(
    session: Session,
    project: Project,
    sample_dir: Path,
    manifest: dict[str, str],
) -> dict:
    """Ingest every file in sample_dir; return summary counts."""
    summary: dict[str, int] = {}

    def _al(key: str) -> AccessLevel:
        return AccessLevel(manifest.get(key, "public"))

    # git_log.txt
    git_path = sample_dir / "git_log.txt"
    if git_path.exists():
        raw = git_path.read_text(encoding="utf-8")
        src = _add_source(session, project.id, SourceKind.git, "git_log.txt",
                          _al("git_log.txt"), raw)
        chunks = parse_git_log(raw, src.id)
        for ch in chunks:
            session.add(ch)
        session.flush()
        summary["git_commits"] = len(chunks)

    # issues.json
    issues_path = sample_dir / "issues.json"
    if issues_path.exists():
        raw = issues_path.read_text(encoding="utf-8")
        src = _add_source(session, project.id, SourceKind.issue, "issues.json",
                          _al("issues.json"), raw)
        chunks = parse_issues(raw, src.id)
        for ch in chunks:
            session.add(ch)
        session.flush()
        summary["issue_chunks"] = len(chunks)

    # tasks.csv
    tasks_path = sample_dir / "tasks.csv"
    if tasks_path.exists():
        raw = tasks_path.read_text(encoding="utf-8")
        src = _add_source(session, project.id, SourceKind.task, "tasks.csv",
                          _al("tasks.csv"), raw)
        chunks = parse_tasks(raw, src.id)
        for ch in chunks:
            session.add(ch)
        session.flush()
        summary["task_rows"] = len(chunks)

    # chat.json
    chat_path = sample_dir / "chat.json"
    if chat_path.exists():
        raw = chat_path.read_text(encoding="utf-8")
        src = _add_source(session, project.id, SourceKind.chat, "chat.json",
                          _al("chat.json"), raw)
        chunks = parse_chat(raw, src.id)
        for ch in chunks:
            session.add(ch)
        session.flush()
        summary["chat_messages"] = len(chunks)

    # notes/*.md
    notes_dir = sample_dir / "notes"
    total_note_chunks = 0
    if notes_dir.exists():
        for md_file in sorted(notes_dir.glob("*.md")):
            key = f"notes/{md_file.name}"
            raw = md_file.read_text(encoding="utf-8")
            al = _al(key)
            src = _add_source(session, project.id, SourceKind.note, key, al, raw)
            chunks = parse_note_paragraphs(raw, src.id)
            for ch in chunks:
                session.add(ch)
            session.flush()
            total_note_chunks += len(chunks)
    summary["note_paragraphs"] = total_note_chunks

    return summary


def _add_source(
    session: Session,
    project_id: int,
    kind: SourceKind,
    name: str,
    access_level: AccessLevel,
    raw_text: str,
) -> Source:
    src = Source(
        project_id=project_id,
        kind=kind,
        name=name,
        access_level=access_level,
        raw_text=raw_text,          # original; never sent to LLM
    )
    session.add(src)
    session.flush()
    return src


def _detect_kind(name: str, ext: str, hint: Optional[str]) -> SourceKind:
    if hint:
        try:
            return SourceKind(hint)
        except ValueError:
            pass
    if ext == ".md":
        return SourceKind.note
    if ext == ".csv":
        return SourceKind.task
    if ext == ".txt":
        return SourceKind.git
    if ext == ".json":
        # Sniff: issues have list of objects with "id" and "title"
        return SourceKind.issue   # default; chat is similar shape
    return SourceKind.note


def _parse_source(source_id: int, kind: SourceKind, raw: str, name: str) -> list[Chunk]:
    if kind == SourceKind.git:
        return parse_git_log(raw, source_id)
    if kind == SourceKind.issue:
        return parse_issues(raw, source_id)
    if kind == SourceKind.task:
        return parse_tasks(raw, source_id)
    if kind == SourceKind.chat:
        return parse_chat(raw, source_id)
    if kind == SourceKind.note:
        return parse_note_paragraphs(raw, source_id)
    return []


# ---------------------------------------------------------------------------
# Public parsers — pure functions, no DB, testable
# ---------------------------------------------------------------------------

# ── Git log ────────────────────────────────────────────────────────────────

def parse_git_log(raw: str, source_id: int) -> list[Chunk]:
    """
    Parse a multi-commit git log into one Chunk per commit.
    Preserves author, timestamp, full commit text (original).
    """
    blocks: list[list[str]] = []
    current: list[str] = []

    for line in raw.splitlines(keepends=True):
        if _is_commit_header(line) and current:
            blocks.append(current)
            current = [line]
        else:
            current.append(line)

    if current:
        blocks.append(current)

    chunks = []
    line_cursor = 1
    for block in blocks:
        text = "".join(block)
        line_count = len(block)
        parsed = _parse_commit_block(block)
        chunks.append(Chunk(
            source_id=source_id,
            text=text,
            author=parsed.get("author"),
            timestamp=parsed.get("timestamp"),
            line_start=line_cursor,
            line_end=line_cursor + line_count - 1,
        ))
        line_cursor += line_count

    return chunks


def _is_commit_header(line: str) -> bool:
    return bool(re.match(r'^commit [0-9a-f]{40}\s*$', line.strip()))


def _parse_commit_block(lines: list[str]) -> dict:
    """Extract author, timestamp, message, files from a single commit block."""
    author = None
    timestamp = None
    message_parts: list[str] = []
    files: list[str] = []
    in_files = False
    past_header = False

    for raw_line in lines:
        line = raw_line.rstrip()
        if line.startswith("Author:"):
            author_full = line.split(":", 1)[1].strip()
            m = re.match(r'^(.+?)\s*<', author_full)
            author = m.group(1).strip() if m else author_full
        elif line.startswith("Date:"):
            ts_str = line.split(":", 1)[1].strip()
            timestamp = _parse_git_date(ts_str)
        elif line.startswith("    Files changed:"):
            in_files = True
        elif in_files and line.startswith("      "):
            parts = line.strip().split(None, 1)
            if len(parts) == 2:
                files.append(parts[1])
        elif line.startswith("    ") and not in_files:
            msg = line[4:].strip()
            if msg:
                message_parts.append(msg)

    return {
        "author": author,
        "timestamp": timestamp,
        "message": " ".join(message_parts),
        "files": files,
    }


def _parse_git_date(s: str) -> Optional[datetime]:
    for fmt in ("%a %b %d %H:%M:%S %Y %z", "%a %b  %d %H:%M:%S %Y %z"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            pass
    return None


# ── Issues ─────────────────────────────────────────────────────────────────

def parse_issues(raw: str, source_id: int) -> list[Chunk]:
    """
    One Chunk per issue body, one Chunk per comment.
    Preserves author and timestamp on each chunk.
    """
    issues = json.loads(raw)
    chunks: list[Chunk] = []

    for issue in issues:
        # Issue body chunk
        body = (
            f"Issue #{issue['id']}: {issue['title']}\n"
            f"Status: {issue.get('status', '')}\n"
            f"Labels: {', '.join(issue.get('labels', []))}\n\n"
            f"{issue.get('body', '')}"
        )
        chunks.append(Chunk(
            source_id=source_id,
            text=body,
            author=issue.get("author"),
            timestamp=_parse_iso(issue.get("created_at")),
        ))

        # One Chunk per comment
        for comment in issue.get("comments", []):
            comment_text = (
                f"Comment on Issue #{issue['id']} ({issue['title']}):\n"
                f"{comment['body']}"
            )
            chunks.append(Chunk(
                source_id=source_id,
                text=comment_text,
                author=comment.get("author"),
                timestamp=_parse_iso(comment.get("date")),
            ))

    return chunks


# ── Notes (markdown paragraphs) ────────────────────────────────────────────

def parse_note_paragraphs(raw: str, source_id: int) -> list[Chunk]:
    """
    Split a markdown file into paragraphs (blank-line delimited).
    Each paragraph = one Chunk with line_start / line_end.
    Meeting date extracted from **Date:** line and stored as chunk.timestamp.
    """
    meeting_date = _extract_meeting_date(raw)
    lines = raw.splitlines()
    chunks: list[Chunk] = []

    para_lines: list[str] = []
    para_start = 1

    for lineno, line in enumerate(lines, start=1):
        if line.strip() == "":
            if para_lines:
                chunks.append(Chunk(
                    source_id=source_id,
                    text="\n".join(para_lines),
                    timestamp=meeting_date,
                    line_start=para_start,
                    line_end=lineno - 1,
                ))
                para_lines = []
                para_start = lineno + 1
        else:
            if not para_lines:
                para_start = lineno
            para_lines.append(line)

    # Flush last paragraph
    if para_lines:
        chunks.append(Chunk(
            source_id=source_id,
            text="\n".join(para_lines),
            timestamp=meeting_date,
            line_start=para_start,
            line_end=len(lines),
        ))

    return chunks


def _extract_meeting_date(text: str) -> Optional[datetime]:
    """Extract meeting date from **Date:** N Mon YYYY pattern."""
    m = re.search(r'\*\*Date:\*\*\s*(\d{1,2}\s+\w+\s+\d{4})', text)
    if m:
        for fmt in ("%d %b %Y", "%d %B %Y"):
            try:
                return datetime.strptime(m.group(1).strip(), fmt)
            except ValueError:
                pass
    # Fallback: YYYY-MM-DD in first line of file
    m2 = re.search(r'(\d{4}-\d{2}-\d{2})', text[:200])
    if m2:
        try:
            return datetime.strptime(m2.group(1), "%Y-%m-%d")
        except ValueError:
            pass
    return None


# ── Tasks (CSV) ────────────────────────────────────────────────────────────

def parse_tasks(raw: str, source_id: int) -> list[Chunk]:
    """One Chunk per CSV row; preserves all fields as a readable text block."""
    chunks: list[Chunk] = []
    reader = csv.DictReader(io.StringIO(raw))
    for row in reader:
        # Human-readable: "field: value | field: value | ..."
        text = " | ".join(f"{k}: {v}" for k, v in row.items())
        chunks.append(Chunk(
            source_id=source_id,
            text=text,
            author=row.get("owner", "") or None,
            timestamp=_parse_iso(row.get("updated_at")),
        ))
    return chunks


# ── Chat (JSON) ────────────────────────────────────────────────────────────

def parse_chat(raw: str, source_id: int) -> list[Chunk]:
    """One Chunk per chat message."""
    messages = json.loads(raw)
    return [
        Chunk(
            source_id=source_id,
            text=f"[{m['author']}]: {m['text']}",
            author=m["author"],
            timestamp=_parse_iso(m.get("timestamp")),
        )
        for m in messages
    ]


# ---------------------------------------------------------------------------
# Shared date helper
# ---------------------------------------------------------------------------

def _parse_iso(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(s[:19], fmt)
        except ValueError:
            pass
    return None
