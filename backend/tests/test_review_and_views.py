"""
Unit and security tests for review experience, role-based views,
handover plans, and access leak prevention.

Verifies:
  1. Approve, reject with reason, and edit (creates ClaimVersion, review_state=corrected).
  2. Every action logged to AuditLog with actor role.
  3. GET /api/claims/{id}/versions returns complete version history.
  4. Handover returns ONLY approved claims.
  5. Handover plan generates Day 1 / Week 1 / Month 1 phases by deterministic rules.
  6. SECURITY LEAK CHECK:
     - Planted HR note ("performance concern")
     - Planted budget note ("FictionalCloud", "1,20,000")
     - Fake secret key ("sk_test_FAKE_0000000000EXAMPLE")
     NEVER appear anywhere in the JSON response for incoming_dev or incoming_pm.
  7. Withheld items contain NO text and NO quotes.
  8. Acknowledge endpoint logs to AuditLog.
"""
from datetime import date
import json
import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.db import create_db_and_tables, engine
from app.main import app
from app.models import (
    AccessLevel,
    AuditLog,
    Claim,
    ClaimKind,
    ClaimStatus,
    ClaimType,
    ClaimVersion,
    Project,
    ReviewState,
    Role,
    Source,
    SourceKind,
)


@pytest.fixture(scope="module")
def client():
    create_db_and_tables()
    with TestClient(app) as c:
        # Load sample data first
        c.post("/api/sample/load")
        c.post("/api/projects/1/derive")
        yield c


class TestReviewExperience:
    def test_approve_claim(self, client):
        # Find a pending claim
        with Session(engine) as s:
            claim = s.exec(select(Claim).where(Claim.review_state == ReviewState.pending)).first()
            assert claim is not None
            claim_id = claim.id

        resp = client.post(
            f"/api/claims/{claim_id}/approve",
            json={"role": "lead", "note": "Verified by lead developer"},
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["review_state"] == "approved"

        # Check AuditLog
        with Session(engine) as s:
            log = s.exec(
                select(AuditLog)
                .where(AuditLog.claim_id == claim_id)
                .where(AuditLog.action == "review_approved")
            ).first()
            assert log is not None
            assert log.actor_role == "lead"

    def test_reject_claim_requires_reason(self, client):
        with Session(engine) as s:
            claim = s.exec(select(Claim).where(Claim.review_state == ReviewState.pending)).first()
            claim_id = claim.id

        # Missing reason fails
        resp = client.post(f"/api/claims/{claim_id}/reject", json={"role": "lead", "reason": ""})
        assert resp.status_code == 400

        # Valid rejection
        resp = client.post(
            f"/api/claims/{claim_id}/reject",
            json={"role": "lead", "reason": "Out of scope for this handover"},
        )
        assert resp.status_code == 200
        assert resp.json()["review_state"] == "rejected"

        # AuditLog recorded
        with Session(engine) as s:
            log = s.exec(
                select(AuditLog)
                .where(AuditLog.claim_id == claim_id)
                .where(AuditLog.action == "review_rejected")
            ).first()
            assert log is not None
            assert "Out of scope" in (log.detail or "")

    def test_edit_claim_creates_version(self, client):
        with Session(engine) as s:
            claim = s.exec(select(Claim)).first()
            claim_id = claim.id
            orig_version = claim.current_version
            orig_text = claim.text

        new_text = "Updated and corrected handover claim text."
        resp = client.post(
            f"/api/claims/{claim_id}/edit",
            json={"role": "lead", "corrected_text": new_text, "note": "Clarified module owner"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["review_state"] == "corrected"
        assert data["version"] == orig_version + 1
        assert data["text"] == new_text

        # Version endpoint verifies history
        v_resp = client.get(f"/api/claims/{claim_id}/versions")
        assert v_resp.status_code == 200
        v_data = v_resp.json()
        assert v_data["current_version"] == orig_version + 1
        assert len(v_data["versions"]) >= 1
        # Previous version recorded
        assert any(v["text"] == orig_text for v in v_data["versions"])

    def test_unauthorized_role_cannot_review(self, client):
        with Session(engine) as s:
            claim = s.exec(select(Claim)).first()
            claim_id = claim.id

        resp = client.post(f"/api/claims/{claim_id}/approve", json={"role": "incoming_dev"})
        assert resp.status_code == 403

        resp = client.post(
            f"/api/claims/{claim_id}/reject",
            json={"role": "incoming_pm", "reason": "Not allowed"},
        )
        assert resp.status_code == 403


class TestHandoverAndRoleSecurity:
    @pytest.fixture(autouse=True)
    def setup_approved_claims(self, client):
        # Create a restricted claim and approve several claims across levels
        with Session(engine) as s:
            # Restricted claim
            c_restricted = Claim(
                project_id=1,
                kind=ClaimKind.derived,
                type=ClaimType.risk,
                text="Private advisor observation: performance concern regarding contributor.",
                evidence_json=json.dumps([{"source_id": 1, "quote": "performance concern"}]),
                status=ClaimStatus.verified,
                confidence=1.0,
                access_level=AccessLevel.restricted,
                review_state=ReviewState.approved,
            )
            # Confidential claim
            c_confidential = Claim(
                project_id=1,
                kind=ClaimKind.derived,
                type=ClaimType.decision,
                text="Vendor contract with FictionalCloud costs ₹1,20,000 annually.",
                evidence_json=json.dumps([{"source_id": 1, "quote": "FictionalCloud ₹1,20,000"}]),
                status=ClaimStatus.verified,
                confidence=1.0,
                access_level=AccessLevel.confidential,
                review_state=ReviewState.approved,
            )
            s.add(c_restricted)
            s.add(c_confidential)

            # Ensure some team claims are approved
            team_claims = s.exec(
                select(Claim).where(Claim.access_level == AccessLevel.team)
            ).all()
            for c in team_claims[:10]:
                c.review_state = ReviewState.approved
                s.add(c)
            s.commit()

    def test_handover_only_returns_approved_claims(self, client):
        resp = client.get("/api/projects/1/handover?role=lead")
        assert resp.status_code == 200
        data = resp.json()
        # All visible claims must have review_state approved in DB
        with Session(engine) as s:
            for item in data["claims"]:
                if not item.get("withheld"):
                    claim = s.get(Claim, item["id"])
                    assert claim.review_state == ReviewState.approved

    def test_restricted_and_confidential_withheld_for_incoming_roles(self, client):
        for role in ["incoming_dev", "incoming_pm"]:
            resp = client.get(f"/api/projects/1/handover?role={role}")
            assert resp.status_code == 200
            raw_json_str = resp.text

            # 1. Sensitive text must NEVER appear anywhere in the response string
            assert "performance concern" not in raw_json_str
            assert "FictionalCloud" not in raw_json_str
            assert "1,20,000" not in raw_json_str
            assert "sk_test_FAKE_0000000000EXAMPLE" not in raw_json_str

            # 2. Check withheld claim structure: must NOT have text or quotes
            data = resp.json()
            withheld_items = [c for c in data["claims"] if c.get("withheld")]
            assert len(withheld_items) >= 2  # restricted and confidential items

            for w in withheld_items:
                assert "text" not in w
                assert "quotes" not in w
                assert "evidence" not in w
                assert w["withheld"] is True
                assert "Requires" in w["reason"]
                assert w["request_access_from"] == "lead"

    def test_handover_plan_phases(self, client):
        resp = client.get("/api/projects/1/handover?role=lead")
        assert resp.status_code == 200
        data = resp.json()
        plan = data["plan"]

        assert "day_1" in plan
        assert "week_1" in plan
        assert "month_1" in plan

        # Check Day 1 items contain critical blockers or sole knowledge
        for item in plan["day_1"]:
            assert item["type"] in ("blocker", "risk") or "sole" in item["title"].lower()

        # Check plan lines link to claim
        for phase in ("day_1", "week_1", "month_1"):
            for item in plan[phase]:
                assert "claim_id" in item
                assert "priority" in item

    def test_acknowledge_receipt_endpoint(self, client):
        resp = client.post(
            "/api/projects/1/acknowledge",
            json={"role": "incoming_dev", "actor_name": "Alex Dev"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["ok"] is True
        assert data["actor_name"] == "Alex Dev"

        # Check AuditLog
        with Session(engine) as s:
            log = s.exec(
                select(AuditLog).where(AuditLog.action == "handover_acknowledged")
            ).first()
            assert log is not None
            assert "Alex Dev" in (log.detail or "")
