"""
Handover views, role-based rendering, rule-based roadmap plans,
and acknowledgment endpoints.
"""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import Session, select

from app.db import get_session
from app.derived import derive_claims
from app.ingest import _ingest_all, _load_manifest
from app.models import (
    AccessLevel,
    AuditLog,
    Chunk,
    Claim,
    ClaimKind,
    ClaimStatus,
    ClaimType,
    ClaimVersion,
    Project,
    ReviewState,
    Role,
    Source,
    role_can_see,
)
from app.redact import redact
from app.review import mask_evidence
from app.verify import run_extraction_and_verification

router = APIRouter(tags=["handover"])

_SAMPLE_DIR = Path(__file__).parent.parent / "data" / "sample"

# Role-specific type emphasis
ROLE_EMPHASIS: dict[Role, list[ClaimType]] = {
    Role.incoming_dev: [
        ClaimType.owner,
        ClaimType.decision,
        ClaimType.risk,
        ClaimType.dependency,
        ClaimType.contact,
    ],
    Role.incoming_pm: [
        ClaimType.owner,
        ClaimType.open_question,
        ClaimType.blocker,
        ClaimType.risk,
        ClaimType.next_action,
    ],
    Role.lead: list(ClaimType),
    Role.admin: list(ClaimType),
}


class AcknowledgeRequest(BaseModel):
    role: Role = Role.incoming_dev
    recipient_name: Optional[str] = None
    actor_name: Optional[str] = None
    note: Optional[str] = None


# ---------------------------------------------------------------------------
# Handover Plan Generator (Rules only — NO LLM)
# ---------------------------------------------------------------------------

def build_handover_plan(rendered_claims: list[dict[str, Any]], role: Role) -> dict[str, list[dict[str, Any]]]:
    """
    Constructs a phased handover roadmap exclusively via deterministic rules:
      - Day 1: Blockers and sole-knowledge risks
      - Week 1: Open decisions and conflicts
      - Month 1: Dependencies, stale modules, and missing items / open questions
    Restricted claims appear strictly as withheld placeholders.
    """
    plan: dict[str, list[dict[str, Any]]] = {
        "day_1": [],
        "week_1": [],
        "month_1": [],
    }

    for rc in rendered_claims:
        if rc.get("withheld"):
            item = {
                "claim_id": rc["id"],
                "type": rc["type"],
                "status": rc.get("status", "approved"),
                "access_level": rc["access_level"],
                "withheld": True,
                "title": f"Locked [{rc['type'].upper()}] item",
                "description": f"Requires {rc['access_level']} access — request access from lead",
                "evidence": [],
                "priority": "High",
                "action_prompt": f"Requires {rc['access_level']} clearance from Lead",
            }
            if rc["type"] in ("blocker", "risk"):
                plan["day_1"].append(item)
            elif rc["type"] in ("decision", "open_question"):
                plan["week_1"].append(item)
            else:
                plan["month_1"].append(item)
            continue

        item = {
            "claim_id": rc["id"],
            "type": rc["type"],
            "status": rc["status"],
            "access_level": rc["access_level"],
            "withheld": False,
            "title": f"[{rc['type'].upper()}] {rc['text'][:80]}...",
            "description": rc["text"],
            "evidence": rc.get("evidence", []),
        }

        # Rule Assignment
        text_lower = rc["text"].lower()
        claim_type = rc["type"]

        # Day 1: Blockers & Sole Knowledge
        if (
            claim_type == "blocker"
            or "sole knowledge" in text_lower
            or (claim_type == "risk" and "sole" in text_lower)
        ):
            item["priority"] = "Critical"
            item["action_prompt"] = "Immediate debrief required with leaver on Day 1"
            plan["day_1"].append(item)

        # Week 1: Decisions & Conflicts
        elif (
            rc.get("status") == "conflicting"
            or claim_type == "decision"
            or "conflict" in text_lower
        ):
            item["priority"] = "High"
            item["action_prompt"] = "Align team and clarify decision rationale during Week 1"
            plan["week_1"].append(item)

        # Month 1: Dependencies, Stale modules, Missing / Open questions
        else:
            item["priority"] = "Medium"
            item["action_prompt"] = "Scheduled for follow-up during Month 1"
            plan["month_1"].append(item)

    return plan


# ---------------------------------------------------------------------------
# Handover Endpoints
# ---------------------------------------------------------------------------

@router.get("/projects/{project_id}/handover", summary="Generate permission-aware handover")
def get_handover(
    project_id: int,
    role: Role = Query(Role.incoming_dev, description="Simulated role"),
    session: Session = Depends(get_session),
):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found.")

    # ONLY approved claims are included in the handover.
    stmt = (
        select(Claim)
        .where(Claim.project_id == project_id)
        .where(Claim.review_state == ReviewState.approved)
    )
    approved_claims = session.exec(stmt).all()

    emphasis_types = ROLE_EMPHASIS.get(role, list(ClaimType))
    rendered_claims = []

    for c in approved_claims:
        can_see = role_can_see(role, c.access_level)
        if not can_see:
            # Strict redaction: NO text or quotes leaked
            rendered_claims.append({
                "id": c.id,
                "withheld": True,
                "reason": f"Requires {c.access_level.value} access",
                "request_access_from": "lead",
                "access_level": c.access_level.value,
                "type": c.type.value,
                "kind": c.kind.value,
                "status": c.status.value,
            })
        else:
            # Role emphasis filter: only include claims matching role's scope
            if c.type in emphasis_types:
                rendered_claims.append({
                    "id": c.id,
                    "withheld": False,
                    "kind": c.kind.value,
                    "type": c.type.value,
                    "text": redact(c.text),
                    "status": c.status.value,
                    "confidence": c.confidence,
                    "access_level": c.access_level.value,
                    "evidence": mask_evidence(c.evidence()),
                })

    # Group claims by role emphasis
    role_sections: dict[str, list[dict[str, Any]]] = {}
    for t in emphasis_types:
        matching = [rc for rc in rendered_claims if rc["type"] == t.value]
        if matching:
            role_sections[t.value] = matching

    # Rule-based plan built from rendered claims
    plan = build_handover_plan(rendered_claims, role)

    visible_count = sum(1 for c in rendered_claims if not c.get("withheld"))
    withheld_count = sum(1 for c in rendered_claims if c.get("withheld"))

    return {
        "project": {
            "id": project.id,
            "name": project.name,
            "leaver_name": project.leaver_name,
            "departure_date": project.departure_date.isoformat(),
        },
        "role": role.value,
        "role_emphasis": [t.value for t in emphasis_types],
        "disclaimer": "⚠️ Roles are simulated for demo purposes. No login system.",
        "claims_total": len(rendered_claims),
        "claims_visible": visible_count,
        "claims_withheld": withheld_count,
        "role_sections": role_sections,
        "claims": rendered_claims,
        "plan": plan,
    }


@router.post("/projects/{project_id}/acknowledge", summary="Acknowledge handover receipt")
def acknowledge_handover(
    project_id: int,
    req: AcknowledgeRequest,
    session: Session = Depends(get_session),
):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found.")

    signer = (req.recipient_name or req.actor_name or "").strip()
    if not signer:
        raise HTTPException(400, "Recipient name is required")

    detail = f"Handover acknowledged by {signer} as {req.role.value}."
    if req.note and req.note.strip():
        detail += f" Note: {req.note.strip()}"

    log = AuditLog(
        project_id=project_id,
        claim_id=None,
        action="handover_acknowledged",
        actor_role=req.role.value,
        detail=detail,
        created_at=datetime.utcnow(),
    )
    session.add(log)
    session.commit()

    return {
        "ok": True,
        "project_id": project_id,
        "role": req.role.value,
        "recipient_name": signer,
        "actor_name": signer,
        "note": req.note,
        "acknowledged_at": log.created_at.isoformat(),
        "message": f"Handover receipt officially logged in audit ledger for {signer}.",
    }


@router.post("/sample/reset", summary="Reset sample project back to fresh state")
def reset_sample_project(session: Session = Depends(get_session)):
    """Reset the database and re-load sample files, derived claims, and extracted claims."""
    if not _SAMPLE_DIR.exists():
        raise HTTPException(404, "Sample directory not found.")

    project = session.exec(
        select(Project).where(Project.name == "Campus Event App")
    ).first()

    if project:
        # Delete versions, claims, audit logs, chunks, sources
        versions = session.exec(select(ClaimVersion)).all()
        for v in versions:
            session.delete(v)
        claims = session.exec(select(Claim).where(Claim.project_id == project.id)).all()
        for c in claims:
            session.delete(c)
        logs = session.exec(select(AuditLog).where(AuditLog.project_id == project.id)).all()
        for l in logs:
            session.delete(l)
        sources = session.exec(select(Source).where(Source.project_id == project.id)).all()
        for s in sources:
            chunks = session.exec(select(Chunk).where(Chunk.source_id == s.id)).all()
            for ch in chunks:
                session.delete(ch)
            session.delete(s)
        session.commit()
    else:
        from datetime import date
        project = Project(
            name="Campus Event App",
            departure_date=date(2026, 3, 15),
            leaver_name="Riya",
        )
        session.add(project)
        session.commit()
        session.refresh(project)

    manifest = _load_manifest(_SAMPLE_DIR)
    summary = _ingest_all(session, project, _SAMPLE_DIR, manifest)
    session.commit()

    # Run derived
    derive_res = derive_claims(project.id, session)

    # Run extraction (uses cache if offline)
    extract_res = run_extraction_and_verification(project.id, session)

    # Count final claims by kind
    from app.models import ClaimKind
    final_claims = session.exec(select(Claim).where(Claim.project_id == project.id)).all()
    derived_count = sum(1 for c in final_claims if c.kind == ClaimKind.derived)
    interpreted_count = sum(1 for c in final_claims if c.kind == ClaimKind.interpreted)
    print(f"[Reset Sample] Claims created: derived={derived_count}, interpreted={interpreted_count}, total={len(final_claims)}")

    return {
        "ok": True,
        "message": "Sample project reset successfully.",
        "project_id": project.id,
        "claims_by_kind": {
            "derived": derived_count,
            "interpreted": interpreted_count,
            "total": len(final_claims),
        },
        "ingest_summary": summary,
        "derived_breakdown": derive_res.get("breakdown"),
        "extract_stats": extract_res,
    }
