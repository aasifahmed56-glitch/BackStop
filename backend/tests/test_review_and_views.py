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
        # Create two approved restricted claims and keep confidential unapproved
        with Session(engine) as s:
            # Clean up any previous test-injected restricted/confidential claims
            existing_test_claims = s.exec(
                select(Claim).where(
                    Claim.text.like("%Private advisor observation%")
                    | Claim.text.like("%Vendor contract with FictionalCloud%")
                )
            ).all()
            for c in existing_test_claims:
                s.delete(c)
            s.flush()

            # Two approved restricted claims
            c_restricted1 = Claim(
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
            c_restricted2 = Claim(
                project_id=1,
                kind=ClaimKind.derived,
                type=ClaimType.decision,
                text="Private advisor observation: key contributor planning departure next quarter.",
                evidence_json=json.dumps([{"source_id": 1, "quote": "departure next quarter"}]),
                status=ClaimStatus.verified,
                confidence=1.0,
                access_level=AccessLevel.restricted,
                review_state=ReviewState.approved,
            )
            # Confidential claim - MUST be unapproved
            c_confidential = Claim(
                project_id=1,
                kind=ClaimKind.derived,
                type=ClaimType.decision,
                text="Vendor contract with FictionalCloud costs ₹1,20,000 annually.",
                evidence_json=json.dumps([{"source_id": 1, "quote": "FictionalCloud ₹1,20,000"}]),
                status=ClaimStatus.verified,
                confidence=1.0,
                access_level=AccessLevel.confidential,
                review_state=ReviewState.pending,
            )
            s.add(c_restricted1)
            s.add(c_restricted2)
            s.add(c_confidential)

            # Ensure team claims of distinct types are approved
            for c_type in [
                ClaimType.dependency,
                ClaimType.blocker,
                ClaimType.decision,
                ClaimType.owner,
                ClaimType.risk,
                ClaimType.open_question,
            ]:
                tc = s.exec(
                    select(Claim)
                    .where(Claim.access_level == AccessLevel.team)
                    .where(Claim.type == c_type)
                ).first()
                if tc:
                    tc.review_state = ReviewState.approved
                    s.add(tc)

            # Ensure all other confidential claims remain unapproved
            conf_claims = s.exec(
                select(Claim).where(Claim.access_level == AccessLevel.confidential)
            ).all()
            for cc in conf_claims:
                cc.review_state = ReviewState.pending
                s.add(cc)

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
            assert "departure next quarter" not in raw_json_str
            assert "FictionalCloud" not in raw_json_str
            assert "1,20,000" not in raw_json_str
            assert "sk_test_FAKE_0000000000EXAMPLE" not in raw_json_str

            # 2. Check withheld claim structure: must NOT have text or quotes
            data = resp.json()
            withheld_items = [c for c in data["claims"] if c.get("withheld")]
            assert len(withheld_items) >= 2  # The 2 approved restricted claims are withheld

            for w in withheld_items:
                assert "text" not in w
                assert "quotes" not in w
                assert "evidence" not in w
                assert w["withheld"] is True
                assert "Requires" in w["reason"]
                assert w["request_access_from"] == "lead"

    def test_role_handover_differences_and_access_ceilings(self, client):
        """
        Verify:
        1. Two approved restricted claims: Lead response includes their text.
        2. Developer and PM responses contain only withheld placeholders (no text).
        3. Developer vs PM visible types differ according to role emphasis.
        4. Confidential claims remain unapproved and are never shown to any role.
        """
        resp_lead = client.get("/api/projects/1/handover?role=lead")
        resp_dev = client.get("/api/projects/1/handover?role=incoming_dev")
        resp_pm = client.get("/api/projects/1/handover?role=incoming_pm")

        assert resp_lead.status_code == 200
        assert resp_dev.status_code == 200
        assert resp_pm.status_code == 200

        data_lead = resp_lead.json()
        data_dev = resp_dev.json()
        data_pm = resp_pm.json()

        # --- Rule a & b: Lead ceiling includes restricted; dev & PM ceiling is team ---
        # 1. Lead includes full text of the two approved restricted claims
        lead_claim_texts = [c["text"] for c in data_lead["claims"] if not c.get("withheld")]
        assert any("performance concern regarding contributor" in t for t in lead_claim_texts)
        assert any("key contributor planning departure next quarter" in t for t in lead_claim_texts)
        assert data_lead["claims_withheld"] == 0

        # 2. Developer response: restricted claims withheld, NO text leaked
        assert "performance concern" not in resp_dev.text
        assert "departure next quarter" not in resp_dev.text
        dev_withheld = [c for c in data_dev["claims"] if c.get("withheld")]
        assert len(dev_withheld) >= 2
        for w in dev_withheld:
            assert "text" not in w
            assert "evidence" not in w
            assert w["withheld"] is True
            assert w["access_level"] == "restricted"

        # PM response: restricted claims withheld, NO text leaked
        assert "performance concern" not in resp_pm.text
        assert "departure next quarter" not in resp_pm.text
        pm_withheld = [c for c in data_pm["claims"] if c.get("withheld")]
        assert len(pm_withheld) >= 2
        for w in pm_withheld:
            assert "text" not in w
            assert "evidence" not in w
            assert w["withheld"] is True
            assert w["access_level"] == "restricted"

        # --- Rule c: Developer vs PM visible types differ ---
        dev_visible = [c for c in data_dev["claims"] if not c.get("withheld")]
        pm_visible = [c for c in data_pm["claims"] if not c.get("withheld")]

        dev_visible_types = set(c["type"] for c in dev_visible)
        pm_visible_types = set(c["type"] for c in pm_visible)

        # Developer emphasis: owner, decision, risk, dependency, contact
        dev_allowed_types = {"owner", "decision", "risk", "dependency", "contact"}
        assert dev_visible_types.issubset(dev_allowed_types)

        # PM emphasis: owner, open_question, blocker, risk, next_action
        pm_allowed_types = {"owner", "open_question", "blocker", "risk", "next_action"}
        assert pm_visible_types.issubset(pm_allowed_types)

        # Visible types MUST differ
        assert dev_visible_types != pm_visible_types
        # Specifically: dependency visible to dev, blocker/open_question visible to PM
        if "dependency" in dev_visible_types:
            assert "dependency" not in pm_visible_types
        if "blocker" in pm_visible_types:
            assert "blocker" not in dev_visible_types

        # --- Confidential claims: unapproved and NEVER shown to ANY role ---
        for raw_resp in [resp_lead.text, resp_dev.text, resp_pm.text]:
            assert "FictionalCloud" not in raw_resp
            assert "1,20,000" not in raw_resp

        for data in [data_lead, data_dev, data_pm]:
            for c in data["claims"]:
                assert c["access_level"] != "confidential"

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

    def test_acknowledge_receipt_frontend_payload_with_note(self, client):
        """Verify POST /api/projects/{id}/acknowledge accepts frontend payload with recipient_name and note."""
        payload = {
            "role": "incoming_dev",
            "recipient_name": "Sam Taylor",
            "note": "Completed handover walkthrough with lead",
        }
        resp = client.post("/api/projects/1/acknowledge", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["ok"] is True
        assert data["recipient_name"] == "Sam Taylor"
        assert data["actor_name"] == "Sam Taylor"
        assert "acknowledged_at" in data
        assert data["note"] == "Completed handover walkthrough with lead"

        # Verify AuditLog record
        with Session(engine) as s:
            log = s.exec(
                select(AuditLog)
                .where(AuditLog.action == "handover_acknowledged")
                .where(AuditLog.project_id == 1)
            ).all()
            assert any(
                "Sam Taylor" in (l.detail or "") and "Completed handover walkthrough" in (l.detail or "")
                for l in log
            )

    def test_acknowledge_receipt_missing_recipient_name(self, client):
        """Verify POST /api/projects/{id}/acknowledge returns 400 when recipient name is missing or blank."""
        # Missing field
        resp1 = client.post("/api/projects/1/acknowledge", json={"role": "incoming_dev"})
        assert resp1.status_code == 400
        data1 = resp1.json()
        assert "Recipient name is required" in data1["detail"]

        # Blank/whitespace name
        resp2 = client.post(
            "/api/projects/1/acknowledge",
            json={"role": "incoming_pm", "recipient_name": "   ", "note": "Some note"},
        )
        assert resp2.status_code == 400
        data2 = resp2.json()
        assert "Recipient name is required" in data2["detail"]

        # Missing project (404)
        resp3 = client.post(
            "/api/projects/99999/acknowledge",
            json={"role": "incoming_dev", "recipient_name": "Nobody"},
        )
        assert resp3.status_code == 404

