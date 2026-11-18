"""
Debrief pack and handover readiness (plain code, no AI).

Two things a lead needs in the last days before someone leaves:

1. Debrief questions: everything the records could not settle, turned into
   questions to ask the person leaving while they are still here. Built only
   from claims the requesting role may see; anything above the role's ceiling
   is counted, never described.
2. Readiness: a transparent checklist score (0-100) of how much of the
   handover has been checked by a person. Every part is shown with its
   numbers, so the score can be explained and argued with. It is a progress
   measure, not a prediction.
"""
from __future__ import annotations

import re
from typing import Any, Optional

import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field as PField
from sqlmodel import Session, select

from app.db import get_session
from app.models import (
    AccessLevel,
    AuditLog,
    Chunk,
    Source,
    SourceKind,
    strictest_access,
    Claim,
    ClaimKind,
    ClaimStatus,
    ClaimType,
    Project,
    ReviewState,
    Role,
    role_can_see,
)
from app.redact import redact
from app.review import LOWEST_ROLE, mask_evidence, render_claim_for_role

router = APIRouter(tags=["debrief"])

PRIORITY_RANK = {"high": 0, "medium": 1, "low": 2}

# Derived claims start with an upper-case tag, e.g. "SOLE KNOWLEDGE RISK — deploy/: ..."
_TAG_RE = re.compile(r"^([A-Z][A-Z ]+?)\s+[—-]\s+(.*)$", re.S)
_MODULE_RE = re.compile(r"^([\w.\-]+/)")
_TASK_RE = re.compile(r'task "([^"]+)"')
_REVERT_RE = re.compile(r'"([^"]+)"')

HIGH_RISK_TYPES = {ClaimType.risk, ClaimType.blocker, ClaimType.decision}
DECIDED = {ReviewState.approved, ReviewState.corrected, ReviewState.rejected}


def _tag_and_rest(text: str) -> tuple[Optional[str], str]:
    m = _TAG_RE.match(text.strip())
    if not m:
        return None, text.strip()
    return m.group(1).strip(), m.group(2).strip()


def _topic(claim: Claim, rest: str) -> str:
    m = _MODULE_RE.match(rest)
    if m:
        return m.group(1)
    return claim.type.value.replace("_", " ")


def question_for(claim: Claim, leaver: str) -> Optional[dict[str, Any]]:
    """Turn one claim into a debrief question, or None when nothing needs asking.

    Pure function of the claim's own fields, so it is easy to test and never
    reads anything the claim does not already carry.
    """
    if claim.review_state == ReviewState.rejected:
        return None  # a reviewer decided the claim is wrong; nothing to confirm
    if claim.kind == ClaimKind.debrief:
        return None  # already the leaver's own answer

    text = redact(claim.text)
    tag, rest = _tag_and_rest(text)
    topic = _topic(claim, rest)
    answered = claim.review_state == ReviewState.corrected

    q: Optional[str] = None
    why = text
    priority = "medium"
    reason = ""

    if tag == "SOLE KNOWLEDGE RISK":
        q = f"Walk the team through {topic}: what breaks most often, how do you fix it, and what is not written down anywhere?"
        priority, reason = "high", "Only one person really knows this area"
    elif tag == "STALE MODULE":
        q = f"Is {topic} still in use? If it is, who should look after it, and what would you do next?"
        priority, reason = "low", "Nobody has touched this area recently"
    elif tag == "REVERTED WORK":
        m = _REVERT_RE.search(rest)
        what = m.group(1) if m else "this change"
        q = f"Why was “{what}” undone, and should anyone try it again?"
        priority, reason = "medium", "Work was reverted; the reason may only live in someone's head"
    elif tag == "MISSING OWNER":
        m = _TASK_RE.search(rest)
        task = f"“{m.group(1)}”" if m else "this task"
        q = f"Who should own {task} after you leave, and what is it waiting on?"
        priority, reason = "high", "Blocked work with no owner"
    elif claim.status == ClaimStatus.conflicting:
        q = f"Two records disagree: {rest.rstrip('.')}. Which one is current?"
        priority, reason = "high", "Sources disagree"
    elif claim.status == ClaimStatus.missing:
        q = f"The records do not say who owns this or why: {rest.rstrip('.')}. Can you fill the gap?"
        priority, reason = "high", "No evidence in the records"
    elif claim.status == ClaimStatus.inferred:
        q = f"We inferred: “{rest.rstrip('.')}.” Is that right, and where is it written down?"
        priority, reason = "medium", "Only partly supported by its quote"
    elif claim.type == ClaimType.open_question:
        q = f"Still open: {rest.rstrip('.')}. What is the answer, or who would know?"
        priority, reason = "medium", "Recorded as an open question"
    elif claim.type == ClaimType.blocker and claim.review_state == ReviewState.pending:
        q = f"What is the next step to unblock this: {rest.rstrip('.')}?"
        priority, reason = "medium", "Open blocker"

    if q is None:
        return None

    ev = mask_evidence(claim.evidence())
    quote = next((e.get("quote") for e in ev if isinstance(e.get("quote"), str) and e.get("quote")), None)
    return {
        "claim_id": claim.id,
        "priority": priority,
        "reason": reason,
        "topic": topic,
        "question": q,
        "context": why,
        "quote": quote,
        "kind": claim.kind.value,
        "status": claim.status.value,
        "review_state": claim.review_state.value,
        "answered": answered,
    }


def build_debrief(claims: list[Claim], role: Role, leaver: str, answered_ids: Optional[dict[int, int]] = None) -> dict[str, Any]:
    answered_ids = answered_ids or {}
    questions: list[dict[str, Any]] = []
    withheld = 0
    for c in claims:
        if not role_can_see(role, c.access_level):
            # Count only: a withheld claim may still hide a question, but its text never leaves the server.
            if question_for(c, leaver) is not None:
                withheld += 1
            continue
        item = question_for(c, leaver)
        if item:
            if c.id in answered_ids:
                item["answered"] = True
                item["answer_claim_id"] = answered_ids[c.id]
            questions.append(item)
    questions.sort(key=lambda q: (q["answered"], PRIORITY_RANK[q["priority"]], q["topic"], q["claim_id"]))
    return {"questions": questions, "withheld_count": withheld}


def build_readiness(claims: list[Claim], acknowledged: bool) -> dict[str, Any]:
    """Weighted checklist. Each part: done / total, weight. Empty parts count as complete."""
    total = len(claims)
    decided = sum(1 for c in claims if c.review_state in DECIDED)

    high = [c for c in claims if c.type in HIGH_RISK_TYPES]
    high_done = sum(1 for c in high if c.review_state in DECIDED)

    doubtful = [c for c in claims if c.status != ClaimStatus.verified]
    doubtful_done = sum(1 for c in doubtful if c.review_state in DECIDED)

    parts = [
        {"key": "reviewed", "label": "Claims checked by a person", "done": decided, "total": total, "weight": 40},
        {"key": "high_risk", "label": "Risks, blockers and decisions checked", "done": high_done, "total": len(high), "weight": 30},
        {"key": "doubtful", "label": "Gaps and disagreements settled", "done": doubtful_done, "total": len(doubtful), "weight": 20},
        {"key": "signed", "label": "Handover signed for by the newcomer", "done": 1 if acknowledged else 0, "total": 1, "weight": 10},
    ]
    score = 0.0
    for p in parts:
        frac = 1.0 if p["total"] == 0 else p["done"] / p["total"]
        p["fraction"] = round(frac, 4)
        score += frac * p["weight"]
    score_int = int(round(score))
    if total == 0:
        verdict = "empty"
    elif score_int >= 90:
        verdict = "ready"
    elif score_int >= 50:
        verdict = "in_progress"
    else:
        verdict = "not_ready"
    return {"score": score_int, "verdict": verdict, "parts": parts}


@router.get("/projects/{project_id}/debrief", summary="Debrief questions for the person leaving, plus handover readiness")
def get_debrief(
    project_id: int,
    role: Role = Query(LOWEST_ROLE, description="Simulated role"),
    session: Session = Depends(get_session),
):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found.")
    claims = session.exec(select(Claim).where(Claim.project_id == project_id).order_by(Claim.id)).all()
    acknowledged = (
        session.exec(
            select(AuditLog)
            .where(AuditLog.project_id == project_id)
            .where(AuditLog.action == "handover_acknowledged")
        ).first()
        is not None
    )
    debrief = build_debrief(list(claims), role, project.leaver_name, _answered_map(session, project_id))
    return {
        "project": {
            "id": project.id,
            "name": project.name,
            "leaver_name": project.leaver_name,
            "departure_date": project.departure_date.isoformat(),
        },
        "role": role.value,
        "readiness": build_readiness(list(claims), acknowledged),
        **debrief,
        "note": "Built by plain rules from the claims, no AI. Withheld questions are counted, never shown.",
    }


ANSWER_ACTION = "debrief_answered"
MAX_ANSWER_CHARS = 2000


def _answered_map(session: Session, project_id: int) -> dict[int, int]:
    """question claim id -> claim id of the recorded answer (latest wins)."""
    logs = session.exec(
        select(AuditLog)
        .where(AuditLog.project_id == project_id)
        .where(AuditLog.action == ANSWER_ACTION)
        .order_by(AuditLog.id)
    ).all()
    out: dict[int, int] = {}
    for log in logs:
        try:
            out[int(log.claim_id)] = int((log.detail or "").rsplit("#", 1)[1])
        except (TypeError, ValueError, IndexError):
            continue
    return out


class AnswerRequest(BaseModel):
    role: Role = LOWEST_ROLE
    question_claim_id: int
    answer: str = PField(..., min_length=1, max_length=MAX_ANSWER_CHARS)


@router.post("/projects/{project_id}/debrief/answer", summary="Record the leaver's answer as a new claim awaiting review")
def answer_question(project_id: int, req: AnswerRequest, session: Session = Depends(get_session)):
    """Closes the loop: the answer becomes a claim that quotes itself word for word,
    starts as 'Not checked', and must be approved like any other claim before it
    reaches a handover. Only the lead records answers."""
    if req.role != Role.lead:
        raise HTTPException(403, "Only the lead can record debrief answers.")
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found.")
    question = session.get(Claim, req.question_claim_id)
    if not question or question.project_id != project_id:
        raise HTTPException(404, "That question's claim was not found in this project.")
    if not role_can_see(req.role, question.access_level):
        raise HTTPException(403, "Access denied: claim level exceeds role.")
    if question_for(question, project.leaver_name) is None:
        raise HTTPException(400, "That claim has no open debrief question.")

    answer = " ".join(req.answer.split())
    if not answer:
        raise HTTPException(400, "Type the answer before saving.")

    # The answer is at least as sensitive as the question it answers.
    level = strictest_access([question.access_level, AccessLevel.team])
    now = datetime.utcnow()
    source = Source(
        project_id=project_id,
        kind=SourceKind.note,
        name=f"debrief/claim-{question.id}.md",
        access_level=level,
        raw_text=answer,
    )
    session.add(source)
    session.flush()
    chunk = Chunk(source_id=source.id, text=answer, author=project.leaver_name, timestamp=now, line_start=1, line_end=1)
    session.add(chunk)
    session.flush()

    claim = Claim(
        project_id=project_id,
        kind=ClaimKind.debrief,
        type=question.type,
        text=f"{project.leaver_name} (debrief, re #{question.id}): {answer}",
        evidence_json=json.dumps([{
            "source_id": source.id,
            "chunk_id": chunk.id,
            "quote": answer,
            "line_start": 1,
            "line_end": 1,
        }]),
        status=ClaimStatus.verified,
        confidence=1.0,
        access_level=level,
        review_state=ReviewState.pending,
    )
    session.add(claim)
    session.flush()
    session.add(AuditLog(
        claim_id=question.id,
        project_id=project_id,
        action=ANSWER_ACTION,
        actor_role=req.role.value,
        detail=f"Answer recorded as claim #{claim.id}",
        created_at=now,
    ))
    session.commit()
    session.refresh(claim)
    return {"ok": True, "question_claim_id": question.id, "answer_claim": render_claim_for_role(claim, req.role)}
