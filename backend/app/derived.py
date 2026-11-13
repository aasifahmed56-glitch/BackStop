"""
Derived claims — deterministic code only, NO LLM.

All public compute_* functions are pure (take plain dicts, return plain dicts)
so they can be called directly in unit tests without a database.

Formula: knowledge_at_risk_score per module
  = leaver_share × (1 + staleness_factor) × (1 / max(1, num_other_contributors))
  where staleness_factor = max(0, (days_stale − stale_days) / stale_days)

Endpoint
  POST /api/projects/{id}/derive   Run all derived computations and persist Claims.
"""
from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.db import get_session
from app.models import (
    AccessLevel,
    Chunk,
    Claim,
    ClaimKind,
    ClaimStatus,
    ClaimType,
    Project,
    ReviewState,
    Source,
    SourceKind,
    strictest_access,
)

router = APIRouter(tags=["derive"])

_DEFAULT_STALE_DAYS = 30
_SOLE_KNOWLEDGE_THRESHOLD = 0.70   # leaver share ≥ 70 %
_SOLE_KNOWLEDGE_MAX_OTHERS = 1     # at most 1 other contributor


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post("/projects/{project_id}/derive",
             summary="Compute all derived claims from git/task data")
def derive_claims(project_id: int, session: Session = Depends(get_session)):
    """
    Idempotent: deletes existing derived claims and re-computes.
    Reads leaver_name and departure_date from the Project row.
    """
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    # ── Load git sources + their chunks ─────────────────────────────────────
    git_sources = session.exec(
        select(Source).where(
            Source.project_id == project_id,
            Source.kind == SourceKind.git,
        )
    ).all()

    if not git_sources:
        raise HTTPException(
            422,
            "No git sources found for this project. "
            "POST /api/sample/load first (or upload a git log).",
        )

    git_chunks: list[Chunk] = []
    for src in git_sources:
        git_chunks.extend(
            session.exec(select(Chunk).where(Chunk.source_id == src.id)).all()
        )

    # ── Load task sources for missing-owner detection ────────────────────────
    task_sources = session.exec(
        select(Source).where(
            Source.project_id == project_id,
            Source.kind == SourceKind.task,
        )
    ).all()
    task_chunks: list[Chunk] = []
    for src in task_sources:
        task_chunks.extend(
            session.exec(select(Chunk).where(Chunk.source_id == src.id)).all()
        )

    # ── Parse commits from stored chunks ────────────────────────────────────
    commits = parse_commits_from_chunks(git_chunks)

    leaver = project.leaver_name
    cutoff = project.departure_date
    git_src_id = git_sources[0].id
    git_access = git_sources[0].access_level

    task_src_id = task_sources[0].id if task_sources else None
    task_access = task_sources[0].access_level if task_sources else AccessLevel.team

    # ── Delete old derived claims ────────────────────────────────────────────
    old = session.exec(
        select(Claim).where(
            Claim.project_id == project_id,
            Claim.kind == ClaimKind.derived,
        )
    ).all()
    for c in old:
        session.delete(c)
    session.flush()

    # ── Compute ─────────────────────────────────────────────────────────────
    ownership = compute_ownership(commits, leaver, cutoff)
    sole_knowledge = compute_sole_knowledge(ownership, leaver)
    stale = compute_stale_modules(commits, cutoff, _DEFAULT_STALE_DAYS)
    at_risk = {item["module"] for item in sole_knowledge}
    contacts = compute_contact_overlap(commits, leaver, cutoff, at_risk)
    reverted = compute_reverted(commits, cutoff)
    scores = compute_knowledge_at_risk_score(ownership, stale, leaver, _DEFAULT_STALE_DAYS)

    # Missing task owners (from task chunks)
    missing_owners = _parse_missing_task_owners(task_chunks)

    # ── Build + persist claims ───────────────────────────────────────────────
    claims: list[Claim] = []

    # 1. Ownership
    for item in ownership:
        ev = _ev(git_src_id, item["chunk_ids"][:3],
                 f"{item['leaver_count']}/{item['total']} commits to "
                 f"{item['module']}/ by {item['top_author']}")
        claims.append(_claim(
            project_id, ClaimType.owner,
            f"{item['top_author']} owns {item['module']}/ "
            f"({item['top_count']}/{item['total']} commits; "
            f"{item['leaver_share']:.0%} by leaver {leaver}).",
            ev, ClaimStatus.verified, round(item["top_count"] / max(1, item["total"]), 2),
            git_access,
        ))

    # 2. Sole-knowledge risk
    for item in sole_knowledge:
        risk_score = scores.get(item["module"], 0.0)
        others = item["other_contributors"]
        ev = _ev(git_src_id, item["chunk_ids"][:3],
                 f"{item['leaver_count']}/{item['total']} commits to "
                 f"{item['module']}/ by {leaver}; "
                 f"{len(others)} other contributor(s): {others}")
        claims.append(_claim(
            project_id, ClaimType.risk,
            f"SOLE KNOWLEDGE RISK — {item['module']}/: {leaver} authored "
            f"{item['leaver_share']:.0%} of commits "
            f"({item['leaver_count']}/{item['total']}); "
            f"only {len(others)} other contributor(s) {others}. "
            f"Knowledge-at-risk score: {risk_score:.3f}.",
            ev, ClaimStatus.verified, min(1.0, risk_score), git_access,
        ))

    # 3. Stale modules
    for item in stale:
        ev = _ev(git_src_id, [item["last_chunk_id"]] if item["last_chunk_id"] else [],
                 f"Last commit to {item['module']}/ was {item['last_commit_date']} "
                 f"({item['days_stale']} days before cutoff {cutoff})")
        claims.append(_claim(
            project_id, ClaimType.risk,
            f"STALE MODULE — {item['module']}/: no commit in the "
            f"{_DEFAULT_STALE_DAYS} days before {cutoff}. "
            f"Last activity: {item['last_commit_date']} ({item['days_stale']} days ago).",
            ev, ClaimStatus.verified, 1.0, git_access,
        ))

    # 4. Contact overlap
    for item in contacts:
        ev = _ev(git_src_id, item["chunk_ids"][:3],
                 f"{item['contact']} made {item['commits']} commit(s) "
                 f"to at-risk module {item['module']}/")
        claims.append(_claim(
            project_id, ClaimType.contact,
            f"CONTACT for {item['module']}/: ask {item['contact']} "
            f"({item['commits']} commit(s) to this at-risk module).",
            ev, ClaimStatus.verified, 1.0, git_access,
        ))

    # 5. Reverted commits
    for item in reverted:
        ev = _ev(git_src_id, [item["chunk_id"]] if item["chunk_id"] else [],
                 item["revert_message"])
        orig = (f" (reverts \"{item['original_message']}\")"
                if item.get("original_message") else "")
        claims.append(_claim(
            project_id, ClaimType.risk,
            f"REVERTED WORK — \"{item['revert_message']}\"{orig} "
            f"on {item['revert_date']}. "
            f"Files: {', '.join(item['files'][:3])}.",
            ev, ClaimStatus.verified, 1.0, git_access,
        ))

    # 6. Missing task owners
    for item in missing_owners:
        if task_src_id is None:
            break
        ev = _ev(task_src_id, [item["chunk_id"]] if item.get("chunk_id") else [],
                 f"Task \"{item['title']}\" — owner field is empty; "
                 f"status: {item['status']}")
        claims.append(_claim(
            project_id, ClaimType.blocker,
            f"MISSING OWNER — task \"{item['title']}\" has no assigned owner "
            f"(status: {item['status']}). Nobody is accountable post-handover.",
            ev, ClaimStatus.missing, 1.0, task_access,
        ))

    for c in claims:
        session.add(c)
    session.commit()

    return {
        "project_id": project_id,
        "claims_created": len(claims),
        "breakdown": {
            "ownership": len(ownership),
            "sole_knowledge_risk": len(sole_knowledge),
            "stale_modules": len(stale),
            "contact_overlap": len(contacts),
            "reverted_commits": len(reverted),
            "missing_task_owners": len(missing_owners),
        },
        "knowledge_at_risk_scores": scores,
    }


# ---------------------------------------------------------------------------
# Commit parsing (from stored Chunk objects)
# ---------------------------------------------------------------------------

def parse_commits_from_chunks(chunks: list[Chunk]) -> list[dict]:
    """
    Re-parse commit metadata from stored Chunk.text.
    Returns list of dicts: {hash, author, date, message, files, chunk_id}.
    """
    result: list[dict] = []
    for chunk in chunks:
        parsed = _parse_commit_text(chunk.text)
        if parsed:
            parsed["chunk_id"] = chunk.id
            result.append(parsed)
    return result


def _parse_commit_text(text: str) -> Optional[dict]:
    """Extract structured commit data from raw commit block text."""
    commit_hash: Optional[str] = None
    author: Optional[str] = None
    timestamp: Optional[datetime] = None
    message_parts: list[str] = []
    files: list[str] = []
    in_files = False

    for raw_line in text.splitlines():
        line = raw_line.rstrip()
        if line.startswith("commit "):
            m = re.match(r'^commit ([0-9a-f]{40})', line)
            if m:
                commit_hash = m.group(1)
        elif line.startswith("Author:"):
            author_full = line.split(":", 1)[1].strip()
            m = re.match(r'^(.+?)\s*<', author_full)
            author = m.group(1).strip() if m else author_full
        elif line.startswith("Date:"):
            ts_str = line.split(":", 1)[1].strip()
            timestamp = _parse_git_date(ts_str)
        elif line.strip() == "Files changed:":
            in_files = True
        elif in_files and line.startswith("      "):
            parts = line.strip().split(None, 1)
            if len(parts) == 2:
                files.append(parts[1])
        elif line.startswith("    ") and not in_files:
            msg = line[4:].strip()
            if msg:
                message_parts.append(msg)

    if not commit_hash:
        return None

    commit_date: Optional[date] = None
    if timestamp:
        commit_date = timestamp.date() if hasattr(timestamp, "date") else None

    return {
        "hash": commit_hash,
        "author": author or "Unknown",
        "timestamp": timestamp,
        "date": commit_date,
        "message": " ".join(message_parts),
        "files": files,
        "chunk_id": None,   # caller sets this
    }


def _parse_git_date(s: str) -> Optional[datetime]:
    for fmt in ("%a %b %d %H:%M:%S %Y %z", "%a %b  %d %H:%M:%S %Y %z"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            pass
    return None


# ---------------------------------------------------------------------------
# Pure computation functions  (no DB, fully testable)
# ---------------------------------------------------------------------------

def _pre_cutoff(commits: list[dict], cutoff: date) -> list[dict]:
    """Return commits on or before *cutoff*, skipping those with no date."""
    return [c for c in commits if c.get("date") and c["date"] <= cutoff]


def _module_of(filepath: str) -> str:
    """Top-level directory of a path, or 'root' for flat files."""
    p = filepath.strip()
    return p.split("/")[0] if "/" in p else "root"


def compute_ownership(commits: list[dict], leaver: str, cutoff: date) -> list[dict]:
    """
    For each module: total commits, top author, leaver commit count / share.

    Returns list of dicts (one per module), sorted by leaver_share descending.
    """
    pre = _pre_cutoff(commits, cutoff)

    module_author: dict[str, Counter] = defaultdict(Counter)
    module_chunk_ids: dict[str, list[int]] = defaultdict(list)

    for c in pre:
        for f in c.get("files", []):
            mod = _module_of(f)
            module_author[mod][c["author"]] += 1
            cid = c.get("chunk_id")
            if cid is not None:
                module_chunk_ids[mod].append(cid)

    result = []
    for mod, counts in module_author.items():
        total = sum(counts.values())
        top_author, top_count = counts.most_common(1)[0]
        leaver_count = counts.get(leaver, 0)
        leaver_share = leaver_count / total if total else 0.0

        result.append({
            "module": mod,
            "total": total,
            "top_author": top_author,
            "top_count": top_count,
            "leaver_count": leaver_count,
            "leaver_share": round(leaver_share, 4),
            "authors": dict(counts),
            "chunk_ids": list(dict.fromkeys(module_chunk_ids[mod])),  # preserve order, dedupe
        })

    result.sort(key=lambda x: x["leaver_share"], reverse=True)
    return result


def compute_sole_knowledge(ownership: list[dict], leaver: str) -> list[dict]:
    """
    Filter ownership list to modules where:
      • leaver_share ≥ SOLE_KNOWLEDGE_THRESHOLD (70 %)
      • at most SOLE_KNOWLEDGE_MAX_OTHERS (1) other contributor(s)

    Takes the output of compute_ownership directly (avoids recomputation).
    """
    result = []
    for item in ownership:
        others = [a for a in item["authors"] if a != leaver]
        if (item["leaver_share"] >= _SOLE_KNOWLEDGE_THRESHOLD
                and len(others) <= _SOLE_KNOWLEDGE_MAX_OTHERS):
            result.append({
                **item,
                "num_other_contributors": len(others),
                "other_contributors": others,
            })
    return result


def compute_stale_modules(
    commits: list[dict],
    cutoff: date,
    stale_days: int = _DEFAULT_STALE_DAYS,
) -> list[dict]:
    """
    Modules with no commit in the *stale_days* window immediately before *cutoff*.
    Returns list sorted by days_stale descending.
    """
    threshold = cutoff - timedelta(days=stale_days)
    pre = _pre_cutoff(commits, cutoff)

    last_commit: dict[str, date] = {}
    last_chunk: dict[str, Optional[int]] = {}

    for c in pre:
        c_date = c["date"]
        for f in c.get("files", []):
            mod = _module_of(f)
            if mod not in last_commit or last_commit[mod] < c_date:
                last_commit[mod] = c_date
                last_chunk[mod] = c.get("chunk_id")

    result = []
    for mod, last in last_commit.items():
        if last < threshold:
            days_stale = (cutoff - last).days
            result.append({
                "module": mod,
                "last_commit_date": last.isoformat(),
                "days_stale": days_stale,
                "last_chunk_id": last_chunk.get(mod),
            })

    result.sort(key=lambda x: x["days_stale"], reverse=True)
    return result


def compute_contact_overlap(
    commits: list[dict],
    leaver: str,
    cutoff: date,
    at_risk_modules: set[str],
) -> list[dict]:
    """
    For each at-risk module, list non-leaver contributors ranked by commit count.
    These are the "ask this person" contacts.
    """
    pre = _pre_cutoff(commits, cutoff)

    mod_author: dict[str, Counter] = defaultdict(Counter)
    mod_chunks: dict[str, dict[str, list[int]]] = defaultdict(lambda: defaultdict(list))

    for c in pre:
        for f in c.get("files", []):
            mod = _module_of(f)
            if mod in at_risk_modules and c["author"] != leaver:
                mod_author[mod][c["author"]] += 1
                cid = c.get("chunk_id")
                if cid is not None:
                    mod_chunks[mod][c["author"]].append(cid)

    result = []
    for mod in sorted(at_risk_modules):
        for author, count in mod_author[mod].most_common():
            result.append({
                "module": mod,
                "contact": author,
                "commits": count,
                "chunk_ids": mod_chunks[mod][author][:3],
            })
    return result


def compute_reverted(commits: list[dict], cutoff: date) -> list[dict]:
    """
    Commits whose message starts with 'Revert' (case-insensitive).
    Attempts to link the revert to its original commit by message matching.
    """
    pre = _pre_cutoff(commits, cutoff)
    reverts = [c for c in pre if c["message"].lower().startswith("revert")]

    msg_to_commit = {c["message"].strip().lower(): c for c in pre}

    result = []
    for rc in reverts:
        original_msg = re.sub(r'^[Rr]evert:?\s*', '', rc["message"]).strip()
        original = msg_to_commit.get(original_msg.lower())
        result.append({
            "revert_hash": rc["hash"],
            "revert_message": rc["message"],
            "revert_date": rc["date"].isoformat() if rc.get("date") else None,
            "files": rc.get("files", []),
            "original_message": original_msg,
            "original_hash": original["hash"] if original else None,
            "chunk_id": rc.get("chunk_id"),
        })

    return result


def compute_knowledge_at_risk_score(
    ownership: list[dict],
    stale: list[dict],
    leaver: str,
    stale_days: int = _DEFAULT_STALE_DAYS,
) -> dict[str, float]:
    """
    score = leaver_share × (1 + staleness_factor) × (1 / max(1, num_other_contributors))
    staleness_factor = max(0, (days_stale − stale_days) / stale_days)

    Returns dict: module → score (rounded to 4 dp).
    """
    stale_map = {s["module"]: s["days_stale"] for s in stale}

    scores: dict[str, float] = {}
    for item in ownership:
        mod = item["module"]
        leaver_share = item["leaver_share"]
        num_others = len([a for a in item["authors"] if a != leaver])

        days_stale = stale_map.get(mod, 0)
        staleness_factor = max(0.0, (days_stale - stale_days) / stale_days)

        score = leaver_share * (1.0 + staleness_factor) / max(1, num_others)
        scores[mod] = round(score, 4)

    return dict(sorted(scores.items(), key=lambda kv: kv[1], reverse=True))


# ---------------------------------------------------------------------------
# Task chunk helpers
# ---------------------------------------------------------------------------

def _parse_missing_task_owners(task_chunks: list[Chunk]) -> list[dict]:
    """Return rows where owner field is blank."""
    result = []
    for chunk in task_chunks:
        row = _parse_task_row(chunk.text)
        if row and not row.get("owner", "").strip():
            result.append({
                "title": row.get("title", ""),
                "status": row.get("status", "unknown"),
                "chunk_id": chunk.id,
            })
    return result


def _parse_task_row(text: str) -> dict:
    """Parse 'key: value | key: value ...' task chunk text back into a dict."""
    row: dict[str, str] = {}
    for part in text.split(" | "):
        if ": " in part:
            k, v = part.split(": ", 1)
            row[k.strip()] = v.strip()
    return row


# ---------------------------------------------------------------------------
# Claim builder helpers
# ---------------------------------------------------------------------------

def _ev(source_id: int, chunk_ids: list[Optional[int]], quote: str) -> str:
    return json.dumps([
        {
            "source_id": source_id,
            "chunk_id": cid,
            "quote": quote,
            "line_start": None,
            "line_end": None,
        }
        for cid in (chunk_ids or [None])
        if cid is not None
    ] or [{"source_id": source_id, "chunk_id": None,
           "quote": quote, "line_start": None, "line_end": None}])


def _claim(
    project_id: int,
    claim_type: ClaimType,
    text: str,
    evidence_json: str,
    status: ClaimStatus,
    confidence: float,
    access_level: AccessLevel,
) -> Claim:
    return Claim(
        project_id=project_id,
        kind=ClaimKind.derived,
        type=claim_type,
        text=text,
        evidence_json=evidence_json,
        status=status,
        confidence=min(1.0, round(confidence, 4)),
        access_level=access_level,
        review_state=ReviewState.pending,
        current_version=1,
    )
