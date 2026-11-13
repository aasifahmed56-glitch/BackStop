"""
Human review endpoints: approve / correct / reject claims.
Access-controlled: only lead or admin may review.
Every action is recorded in AuditLog and a ClaimVersion is saved.
"""
from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from app.db import get_session
from app.models import (
    AuditLog,
    Claim,
    ClaimVersion,
    ReviewState,
    Role,
    role_can_see,
)

router = APIRouter(prefix="/review", tags=["review"])

_REVIEWER_ROLES = {Role.lead, Role.admin}


class ReviewRequest(BaseModel):
    role: Role
    action: ReviewState          # approved | corrected | rejected
    corrected_text: str | None = None
    note: str | None = None


@router.post("/claims/{claim_id}")
def review_claim(claim_id: int, req: ReviewRequest, session: Session = Depends(get_session)):
    if req.role not in _REVIEWER_ROLES:
        raise HTTPException(status_code=403, detail="Only lead or admin may review claims.")

    claim = session.get(Claim, claim_id)
    if claim is None:
        raise HTTPException(status_code=404, detail="Claim not found.")

    if not role_can_see(req.role, claim.access_level):
        _log(session, claim_id, "access_denied", req.role.value, "Review denied: access level too high.")
        session.commit()
        raise HTTPException(status_code=403, detail="Access denied: claim access level exceeds role.")

    # Save a version snapshot before mutation
    version = ClaimVersion(
        claim_id=claim_id,
        version=claim.current_version,
        text=claim.text,
        evidence_json=claim.evidence_json,
        status=claim.status,
        confidence=claim.confidence,
        access_level=claim.access_level,
        review_state=claim.review_state,
        changed_by=req.role.value,
        changed_at=datetime.utcnow(),
        change_note=req.note,
    )
    session.add(version)

    # Apply changes
    if req.action == ReviewState.corrected and req.corrected_text:
        claim.text = req.corrected_text
    claim.review_state = req.action
    claim.current_version += 1
    session.add(claim)

    _log(session, claim_id, f"review_{req.action.value}", req.role.value, req.note)
    session.commit()
    session.refresh(claim)
    return {"ok": True, "claim_id": claim_id, "new_state": claim.review_state}


def _log(session: Session, claim_id: int, action: str, actor: str, detail: str | None) -> None:
    session.add(AuditLog(claim_id=claim_id, action=action, actor_role=actor, detail=detail))

