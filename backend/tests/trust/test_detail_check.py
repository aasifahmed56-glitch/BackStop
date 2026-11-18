"""Tests for the deterministic number / date / name check (app.detailcheck)."""
import json
from pathlib import Path

from app.detailcheck import check_claim_details, extract_details


def test_invented_date_is_caught():
    r = check_claim_details("Kabir is to implement the refund endpoint by 5 Jan.", "Kabir to implement refund endpoint by 20 Dec.")
    assert not r["ok"]
    assert {d["text"] for d in r["missing"]} == {"5", "Jan"}


def test_invented_name_is_caught():
    r = check_claim_details("Meena takes over auth with support from Arjun.", "Meena: takes over auth/ (with Sara's support).")
    assert not r["ok"] and [d["text"] for d in r["missing"]] == ["Arjun"]


def test_changed_number_is_caught():
    assert not check_claim_details("The Events API is 95% complete.", "Events API: 80% complete.")["ok"]


def test_amount_with_commas_matches():
    assert check_claim_details("Hosting costs 1,20,000 a year.", "Hosting | 120000")["ok"]


def test_month_name_and_abbreviation_match():
    assert check_claim_details("Sessions failed in the October demo.", "Sessions had load failures in the Oct demo")["ok"]
    assert check_claim_details("It is due on 20 February.", "due on 20 Feb 2026")["ok"]


def test_claim_naming_a_term_absent_from_its_quote_is_caught():
    # The old pipeline test claimed "JWT chosen over sessions" from a quote that never mentions JWT.
    r = check_claim_details("JWT chosen over sessions", "Sessions failed under load in the demo")
    assert not r["ok"] and [d["text"] for d in r["missing"]] == ["JWT"]


def test_number_words_match_digits():
    assert check_claim_details("There were two reverts.", "2 reverts in April")["ok"]
    assert not check_claim_details("There were three reverts.", "2 reverts in April")["ok"]


def test_detail_found_in_chunk_but_not_quote_passes():
    chunk = "## Decision\n- Payments migration on 20 Feb 2026.\n- Kabir leads testing."
    assert check_claim_details("Kabir leads testing for the 20 Feb migration.", "Kabir leads testing.", chunk)["ok"]


def test_sentence_start_words_are_not_names():
    assert check_claim_details("The vault configuration is not documented.", "Vault config is NOT documented.")["ok"]
    assert check_claim_details("Only Riya fully knows the deploy process.", "Deploy process is only fully known to Riya.")["ok"]


def test_sentence_initial_name_is_still_checked():
    assert not check_claim_details("Arjun owns deploy.", "Dev will own deploy after 15 Mar.")["ok"]


def test_possessive_is_stripped():
    assert check_claim_details("Sara reviewed Riya's PRs.", "Sara has reviewed all of Riya's auth PRs.")["ok"]


def test_meaning_changes_with_same_words_are_not_caught():
    # Documented limit: reversal with the same words passes. That is the AI check's job.
    assert check_claim_details("The polling implementation is unstable.", "Polling implementation is stable.")["ok"]


def test_extract_details_kinds():
    kinds = {(d["kind"], d["text"]) for d in extract_details("Riya leaves on 15 Mar 2026 with three tasks.")}
    assert ("number", "15") in kinds and ("date", "Mar") in kinds and ("number", "three") in kinds


def test_saved_evaluation_has_no_false_rejects_and_catches_every_invented_detail():
    after = json.loads((Path(__file__).resolve().parents[2] / "data" / "trust" / "support_eval_after.json").read_text())
    alone = after["detail_check_alone"]
    assert alone["per_category"]["invented_detail"]["caught"] == 5
    assert alone["falsely_rejected"] == 0


def test_offline_sample_has_zero_cache_misses_and_no_downgrades():
    from fastapi.testclient import TestClient
    from app.main import app
    with TestClient(app) as client:
        res = client.post("/api/sample/reset").json()
    st = res["extract_stats"]
    assert st["support_unchecked"] == 0 and not st["failed_sources"]
    assert st["downgraded_by_detail_check"] == 0
    assert st["verified"] == 83
