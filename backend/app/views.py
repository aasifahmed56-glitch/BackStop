"""
Views / handover rendering — access-controlled query layer.

Access control is applied TWICE:
  1. Before any LLM call (in ingest/llm pipeline).
  2. HERE, at render time — this is the authoritative gate.

Restricted items appear as {"withheld": true, "reason": "request access"}.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.db import get_session
from app.models import (
    AccessLevel,
    Claim,
    ClaimStatus,
    Project,
    ReviewState,
    Role,
    role_can_see,
)
from app.review import router as review_router

router = APIRouter()
router.include_router(review_router)


def _render_claim(claim: Claim, role: Role) -> dict:
    """Render a claim for the given role, witholding if access is denied."""
    if not role_can_see(role, claim.access_level):
        return {
            "id": claim.id,
            "withheld": True,
            "reason": "Withheld — request access",
            "access_level": claim.access_level,
            "review_state": claim.review_state,
        }
    return {
        "id": claim.id,
        "withheld": False,
        "kind": claim.kind,
        "type": claim.type,
        "text": claim.text,
        "status": claim.status,
        "confidence": claim.confidence,
        "access_level": claim.access_level,
        "review_state": claim.review_state,
        "evidence": claim.evidence(),
        "current_version": claim.current_version,
    }


@router.get("/projects", tags=["projects"])
def list_projects(session: Session = Depends(get_session)):
    return session.exec(select(Project)).all()


@router.get("/projects/{project_id}/handover", tags=["handover"])
def get_handover(
    project_id: int,
    role: Role = Query(Role.incoming_dev, description="Simulated role (no real auth)"),
    only_approved: bool = Query(True, description="Only include approved claims"),
    session: Session = Depends(get_session),
):
    """
    Return the handover document for a project, filtered by role.
    Only approved claims are included by default.
    """
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    stmt = select(Claim).where(Claim.project_id == project_id)
    if only_approved:
        stmt = stmt.where(Claim.review_state == ReviewState.approved)
    claims = session.exec(stmt).all()

    rendered = [_render_claim(c, role) for c in claims]
    return {
        "project": {
            "id": project.id,
            "name": project.name,
            "leaver_name": project.leaver_name,
            "departure_date": project.departure_date.isoformat(),
        },
        "role": role,
        "disclaimer": "⚠️ DEMO ONLY — roles are simulated. No real authentication.",
        "claims": rendered,
    }


@router.get("/projects/{project_id}/claims", tags=["claims"])
def list_claims(
    project_id: int,
    role: Role = Query(Role.incoming_dev),
    status: ClaimStatus | None = Query(None),
    session: Session = Depends(get_session),
):
    stmt = select(Claim).where(Claim.project_id == project_id)
    if status:
        stmt = stmt.where(Claim.status == status)
    claims = session.exec(stmt).all()
    return [_render_claim(c, role) for c in claims]

