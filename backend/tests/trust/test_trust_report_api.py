"""The Trust report endpoint serves saved results only and never repeats leaked text."""
from fastapi.testclient import TestClient

from app.main import app


def test_trust_report_serves_saved_results():
    with TestClient(app) as client:
        r = client.get("/api/trust/report")
    assert r.status_code == 200
    d = r.json()
    assert d["leak"]["now"]["leaked"] == 0
    assert d["leak"]["before_fixes"]["leaked"] > 0
    assert d["leak"]["found_before_fixes"] and d["leak"]["fixes"]
    assert d["support_eval"]["after"]["pairs"] == 40
    assert d["support_eval"]["after"]["ai_check_ran"] is False
    assert any("simulated" in l for l in d["limitations"])
    for planted in ("sk_test_FAKE", "1,20,000", "FictionalCloud", "engagement level", "example.org"):
        assert planted not in r.text
    assert "results" not in d["leak"]
