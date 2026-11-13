"""
Human review experience and claims ledger management.

Provides:
  - GET /api/claims                    List claims with status/type/state filters, sorted by risk
  - GET /api/claims/stats              Summary counts by status, review state, rejection rate
  - POST /api/claims/{id}/approve      Approve claim for inclusion in handover
  - POST /api/claims/{id}/reject       Reject claim with required reason
  - POST /api/claims/{id}/edit         Correct claim text, increment version, state=corrected
  - GET /api/claims/{id}/versions      Complete version audit trail
  - GET /api/claims/{id}/context       Source chunk text with quote positioning for UI highlight
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import Session, select

from app.db import get_session
from app.models import (
    AccessLevel,
    AuditLog,
    Chunk,
    Claim,
    ClaimKind,
    ClaimStatus,
    ClaimType,
    ClaimVersion,
    ReviewState,
    Role,
    Source,
    role_can_see,
)

router = APIRouter(tags=["review"])

_REVIEWER_ROLES = {Role.lead, Role.admin}


# ---------------------------------------------------------------------------
# Request Schemas
# ---------------------------------------------------------------------------

class ApproveRequest(BaseModel):
    role: Role = Role.lead
    note: Optional[str] = None


class RejectRequest(BaseModel):
    role: Role = Role.lead
    reason: str


class EditRequest(BaseModel):
    role: Role = Role.lead
    corrected_text: str
    note: Optional[str] = None


class BulkApproveRequest(BaseModel):
    role: Role = Role.lead
    note: Optional[str] = None


# ---------------------------------------------------------------------------
# Risk Sorting Helper
# ---------------------------------------------------------------------------

def calculate_risk_score(claim: Claim) -> float:
    """
    Higher score = higher priority in the review queue.
    Conflicts and blockers require immediate human attention.
    """
    status_weights = {
        ClaimStatus.conflicting: 50.0,
        ClaimStatus.missing: 40.0,
        ClaimStatus.inferred: 20.0,
        ClaimStatus.verified: 10.0,
    }
    type_weights = {
        ClaimType.risk: 30.0,
        ClaimType.blocker: 30.0,
        ClaimType.decision: 20.0,
        ClaimType.dependency: 15.0,
        ClaimType.owner: 10.0,
        ClaimType.open_question: 15.0,
        ClaimType.next_action: 10.0,
        ClaimType.contact: 5.0,
    }
    score = status_weights.get(claim.status, 0.0) + type_weights.get(claim.type, 0.0)
    if claim.review_state == ReviewState.pending:
        score += 25.0
    return score


def render_claim_for_role(claim: Claim, role: Role) -> dict[str, Any]:
    """
    Enforce strict access control:
    If role cannot view claim access level, return withheld placeholder with NO text or quotes.
    """
    if not role_can_see(role, claim.access_level):
        return {
            "id": claim.id,
            "project_id": claim.project_id,
            "withheld": True,
            "reason": f"Requires {claim.access_level.value} access",
            "request_access_from": "lead",
            "access_level": claim.access_level.value,
            "review_state": claim.review_state.value,
            "kind": claim.kind.value,
            "type": claim.type.value,
            "confidence": claim.confidence,
            "current_version": claim.current_version,
        }

    return {
        "id": claim.id,
        "project_id": claim.project_id,
        "withheld": False,
        "kind": claim.kind.value,
        "type": claim.type.value,
        "text": claim.text,
        "status": claim.status.value,
        "confidence": claim.confidence,
        "access_level": claim.access_level.value,
        "review_state": claim.review_state.value,
        "current_version": claim.current_version,
        "evidence": claim.evidence(),
    }


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/claims", summary="List claims with filters, sorted by risk priority")
@router.get("/projects/{project_id}/claims", summary="List claims for a project, sorted by risk priority")
def list_claims(
    project_id: int = 1,
    status: Optional[ClaimStatus] = Query(None),
    type: Optional[ClaimType] = Query(None),
    review_state: Optional[ReviewState] = Query(None),
    role: Role = Query(Role.lead),
    session: Session = Depends(get_session),
):
    stmt = select(Claim).where(Claim.project_id == project_id)
    if status is not None:
        stmt = stmt.where(Claim.status == status)
    if type is not None:
        stmt = stmt.where(Claim.type == type)
    if review_state is not None:
        stmt = stmt.where(Claim.review_state == review_state)

    claims = session.exec(stmt).all()
    sorted_claims = sorted(claims, key=calculate_risk_score, reverse=True)
    return [render_claim_for_role(c, role) for c in sorted_claims]


@router.get("/claims/stats", summary="Review queue stats bar metrics")
def get_claims_stats(
    project_id: int = Query(1),
    session: Session = Depends(get_session),
):
    claims = session.exec(select(Claim).where(Claim.project_id == project_id)).all()
    total = len(claims)

    by_status = {
        "verified": sum(1 for c in claims if c.status == ClaimStatus.verified),
        "inferred": sum(1 for c in claims if c.status == ClaimStatus.inferred),
        "conflicting": sum(1 for c in claims if c.status == ClaimStatus.conflicting),
        "missing": sum(1 for c in claims if c.status == ClaimStatus.missing),
    }

    by_review = {
        "pending": sum(1 for c in claims if c.review_state == ReviewState.pending),
        "approved": sum(1 for c in claims if c.review_state == ReviewState.approved),
        "corrected": sum(1 for c in claims if c.review_state == ReviewState.corrected),
        "rejected": sum(1 for c in claims if c.review_state == ReviewState.rejected),
    }

    reviewed = total - by_review["pending"]
    rejection_rate = round(by_review["rejected"] / reviewed, 3) if reviewed > 0 else 0.0

    return {
        "total": total,
        "by_status": by_status,
        "by_review": by_review,
        "rejection_rate": rejection_rate,
    }


@router.post("/claims/{claim_id}/approve", summary="Approve claim")
def approve_claim(
    claim_id: int,
    req: ApproveRequest,
    session: Session = Depends(get_session),
):
    if req.role not in _REVIEWER_ROLES:
        raise HTTPException(403, "Only lead or admin roles may review claims.")

    claim = session.get(Claim, claim_id)
    if not claim:
        raise HTTPException(404, "Claim not found.")

    if not role_can_see(req.role, claim.access_level):
        _log(session, claim_id, "access_denied", req.role.value, "Approve denied: access level too high.")
        session.commit()
        raise HTTPException(403, "Access denied: claim level exceeds role.")

    # Version snapshot
    _save_version(session, claim, req.role.value, req.note)

    claim.review_state = ReviewState.approved
    session.add(claim)
    _log(session, claim_id, "review_approved", req.role.value, req.note)
    session.commit()
    session.refresh(claim)
    return {"ok": True, "claim_id": claim.id, "review_state": claim.review_state}


@router.post("/claims/bulk-approve-verified", summary="Bulk approve all verified claims (demo shortcut)")
@router.post("/projects/{project_id}/claims/bulk-approve-verified", summary="Bulk approve all verified claims for project")
def bulk_approve_verified(
    project_id: int = 1,
    req: BulkApproveRequest = BulkApproveRequest(),
    session: Session = Depends(get_session),
):
    """
    Approve all claims with status == 'verified' that are not already approved.
    NEVER auto-approves Conflicting or Missing claims.
    Logged in AuditLog as 'bulk approve (demo shortcut)'.
    """
    if req.role not in _REVIEWER_ROLES:
        raise HTTPException(403, "Only lead or admin roles may approve claims.")

    stmt = (
        select(Claim)
        .where(Claim.project_id == project_id)
        .where(Claim.status == ClaimStatus.verified)
        .where(Claim.review_state != ReviewState.approved)
    )
    verified_claims = session.exec(stmt).all()
    count = 0

    for claim in verified_claims:
        if role_can_see(req.role, claim.access_level):
            _save_version(session, claim, req.role.value, req.note or "bulk approve (demo shortcut)")
            claim.review_state = ReviewState.approved
            session.add(claim)
            count += 1

    # Log in audit log with exact action "bulk approve (demo shortcut)"
    audit = AuditLog(
        project_id=project_id,
        claim_id=None,
        action="bulk approve (demo shortcut)",
        actor_role=req.role.value,
        detail=f"Bulk approved {count} verified claims for handover.",
    )
    session.add(audit)
    session.commit()

    return {
        "ok": True,
        "approved_count": count,
        "action": "bulk approve (demo shortcut)",
        "message": f"Successfully approved {count} verified claims.",
    }


@router.post("/claims/{claim_id}/reject", summary="Reject claim with reason")
def reject_claim(
    claim_id: int,
    req: RejectRequest,
    session: Session = Depends(get_session),
):
    if req.role not in _REVIEWER_ROLES:
        raise HTTPException(403, "Only lead or admin roles may review claims.")

    if not req.reason or not req.reason.strip():
        raise HTTPException(400, "Rejection reason is required.")

    claim = session.get(Claim, claim_id)
    if not claim:
        raise HTTPException(404, "Claim not found.")

    if not role_can_see(req.role, claim.access_level):
        _log(session, claim_id, "access_denied", req.role.value, "Reject denied: access level too high.")
        session.commit()
        raise HTTPException(403, "Access denied: claim level exceeds role.")

    # Version snapshot
    _save_version(session, claim, req.role.value, req.reason)

    claim.review_state = ReviewState.rejected
    session.add(claim)
    _log(session, claim_id, "review_rejected", req.role.value, req.reason)
    session.commit()
    session.refresh(claim)
    return {"ok": True, "claim_id": claim.id, "review_state": claim.review_state}


@router.post("/claims/{claim_id}/edit", summary="Correct claim text and record new version")
def edit_claim(
    claim_id: int,
    req: EditRequest,
    session: Session = Depends(get_session),
):
    if req.role not in _REVIEWER_ROLES:
        raise HTTPException(403, "Only lead or admin roles may review claims.")

    claim = session.get(Claim, claim_id)
    if not claim:
        raise HTTPException(404, "Claim not found.")

    if not role_can_see(req.role, claim.access_level):
        _log(session, claim_id, "access_denied", req.role.value, "Edit denied: access level too high.")
        session.commit()
        raise HTTPException(403, "Access denied: claim level exceeds role.")

    # Save snapshot before mutation
    _save_version(session, claim, req.role.value, req.note or "Corrected text")

    claim.text = req.corrected_text.strip()
    claim.review_state = ReviewState.corrected
    claim.current_version += 1
    session.add(claim)

    _log(session, claim_id, "review_corrected", req.role.value, f"v{claim.current_version}: {req.note}")
    session.commit()
    session.refresh(claim)
    return {
        "ok": True,
        "claim_id": claim.id,
        "review_state": claim.review_state,
        "version": claim.current_version,
        "text": claim.text,
    }


@router.get("/claims/{claim_id}/versions", summary="Get version history of a claim")
def get_claim_versions(
    claim_id: int,
    session: Session = Depends(get_session),
):
    claim = session.get(Claim, claim_id)
    if not claim:
        raise HTTPException(404, "Claim not found.")

    versions = session.exec(
        select(ClaimVersion)
        .where(ClaimVersion.claim_id == claim_id)
        .order_by(ClaimVersion.version.desc())
    ).all()

    audit_logs = session.exec(
        select(AuditLog)
        .where(AuditLog.claim_id == claim_id)
        .order_by(AuditLog.created_at.desc())
    ).all()

    return {
        "claim_id": claim_id,
        "current_version": claim.current_version,
        "versions": [
            {
                "version": v.version,
                "text": v.text,
                "status": v.status.value,
                "review_state": v.review_state.value,
                "changed_by": v.changed_by,
                "changed_at": v.changed_at.isoformat(),
                "change_note": v.change_note,
            }
            for v in versions
        ],
        "audit_logs": [
            {
                "action": a.action,
                "actor_role": a.actor_role,
                "detail": a.detail,
                "created_at": a.created_at.isoformat(),
            }
            for a in audit_logs
        ],
    }


@router.get("/claims/{claim_id}/context", summary="Fetch chunk context for quote highlighting")
def get_claim_context(
    claim_id: int,
    session: Session = Depends(get_session),
):
    claim = session.get(Claim, claim_id)
    if not claim:
        raise HTTPException(404, "Claim not found.")

    evidence = claim.evidence()
    contexts = []

    for ev in evidence:
        cid = ev.get("chunk_id")
        quote = ev.get("quote", "")
        if not cid:
            continue
        chk = session.get(Chunk, cid)
        if not chk:
            continue
        src = session.get(Source, chk.source_id)

        contexts.append({
            "chunk_id": chk.id,
            "source_name": src.name if src else "unknown",
            "source_kind": src.kind.value if src else "unknown",
            "access_level": src.access_level.value if src else "public",
            "chunk_text": chk.text,
            "quote": quote,
            "author": chk.author,
            "timestamp": chk.timestamp.isoformat() if chk.timestamp else None,
        })

    return {
        "claim_id": claim.id,
        "type": claim.type.value,
        "status": claim.status.value,
        "contexts": contexts,
    }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _save_version(session: Session, claim: Claim, changed_by: str, note: Optional[str]) -> None:
    v = ClaimVersion(
        claim_id=claim.id,
        version=claim.current_version,
        text=claim.text,
        evidence_json=claim.evidence_json,
        status=claim.status,
        confidence=claim.confidence,
        access_level=claim.access_level,
        review_state=claim.review_state,
        changed_by=changed_by,
        changed_at=datetime.utcnow(),
        change_note=note,
    )
    session.add(v)


def _log(session: Session, claim_id: Optional[int], action: str, actor: str, detail: Optional[str]) -> None:
    session.add(AuditLog(claim_id=claim_id, action=action, actor_role=actor, detail=detail))
