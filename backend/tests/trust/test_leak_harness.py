"""
Runs the leak harness inside the normal test suite.

Fails if any attack leaks, if any API route is not attacked, or if the
harness has gone blind (the controls below check that permitted roles still
see what they should, so "0 leaked" means something).
"""
from fastapi.testclient import TestClient

from app.main import app
from tests.trust.leak_harness import LeakHarness, api_routes, print_summary


def _run():
    with TestClient(app) as client:
        h = LeakHarness(client)
        rep = h.run()
        return h, rep


def test_no_leaks_on_any_route_or_role():
    h, rep = _run()
    print_summary(rep)
    assert rep["summary"]["attacks_run"] > 1000
    assert rep["summary"]["leaked"] == 0, rep["failures"][:5]


def test_every_api_route_is_attacked():
    h, _ = _run()
    missing = api_routes(app) - h.covered
    assert not missing, f"routes with no leak cases: {sorted(missing)}"


def test_controls_permitted_roles_still_see_their_claims():
    with TestClient(app) as client:
        client.post("/api/sample/reset")
        admin = client.get("/api/claims", params={"role": "admin"}).json()
        lead = client.get("/api/claims", params={"role": "lead"}).json()
        dev = client.get("/api/claims", params={"role": "incoming_dev"}).json()
        no_role = client.get("/api/claims").json()

        conf = [c for c in admin if c["access_level"] == "confidential"]
        restr = [c for c in admin if c["access_level"] == "restricted"]
        assert conf and restr
        assert all(not c["withheld"] for c in admin)
        # Lead sees restricted text but not confidential.
        lead_by_id = {c["id"]: c for c in lead}
        assert all(not lead_by_id[c["id"]]["withheld"] for c in restr)
        assert all(lead_by_id[c["id"]]["withheld"] for c in conf)
        # A missing role is treated exactly like the lowest role.
        assert no_role == dev
        assert all(c["withheld"] for c in dev if c["access_level"] in ("restricted", "confidential"))

        # Lead can still read the context and history of a restricted claim.
        rid = restr[0]["id"]
        r = client.get(f"/api/claims/{rid}/context", params={"role": "lead"})
        assert r.status_code == 200 and r.json()["contexts"]
        assert client.get(f"/api/claims/{rid}/versions", params={"role": "lead"}).status_code == 200
        assert client.get(f"/api/claims/{rid}/context").status_code == 403


def test_secret_in_cited_chunk_is_masked_for_every_role():
    with TestClient(app) as client:
        client.post("/api/sample/reset")
        seen_mask = False
        for c in client.get("/api/claims", params={"role": "admin"}).json():
            r = client.get(f"/api/claims/{c['id']}/context", params={"role": "admin"})
            assert "sk_test_FAKE" not in r.text
            seen_mask = seen_mask or "[REDACTED_SECRET]" in r.text
        assert seen_mask, "expected at least one cited chunk with a masked secret"


def test_lower_role_cannot_review_and_missing_role_cannot_review():
    with TestClient(app) as client:
        client.post("/api/sample/reset")
        admin = client.get("/api/claims", params={"role": "admin"}).json()
        team = next(c for c in admin if c["access_level"] == "team")
        conf = next(c for c in admin if c["access_level"] == "confidential")
        assert client.post(f"/api/claims/{team['id']}/approve", json={}).status_code == 403
        assert client.post(f"/api/claims/{team['id']}/approve", json={"role": "incoming_pm"}).status_code == 403
        assert client.post(f"/api/claims/{conf['id']}/edit", json={"role": "lead", "corrected_text": "x"}).status_code == 403
        assert client.post("/api/claims/bulk-approve-verified", json={}).status_code == 403
