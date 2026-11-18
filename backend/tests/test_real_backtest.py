"""Real-project backtest: ranking never reads post-cutoff data; ground truth rules."""
import copy
import json
from datetime import date

from app.realbacktest import REAL_DIR, evaluate, ground_truth, module_of, rank_modules


def _c(h, author, d, files, msg="change"):
    return {"hash": f"{h:040x}", "author": author, "date": d, "files": files, "message": msg, "chunk_id": h}


CUT = date(2020, 6, 1)
PRE = [
    _c(1, "A", date(2020, 1, 1), ["lib/core.js", "lib/core2.js"]),
    _c(2, "A", date(2020, 2, 1), ["lib/reporters/x.js"]),
    _c(3, "B", date(2020, 3, 1), ["lib/reporters/y.js"]),
    _c(4, "A", date(2020, 4, 1), ["docs/a.md"]),
    _c(5, "B", date(2020, 5, 1), ["README.md"]),
]
POST = [
    _c(6, "C", date(2020, 7, 1), ["lib/core.js"], "Fix crash in core"),
    _c(7, "D", date(2020, 8, 1), ["lib/core.js"], "tidy"),
    _c(8, "C", date(2020, 9, 1), ["docs/a.md"], "typo"),
    _c(9, "B", date(2020, 9, 2), ["lib/reporters/x.js"], "fix reporter"),
    _c(10, "C", date(2021, 6, 1), ["docs/a.md"], "fix late"),  # outside 180 days
]


def test_module_rule():
    assert module_of("lib/reporters/spec.js") == "lib/reporters"
    assert module_of("lib/runner.js") == "lib"
    assert module_of("test/unit/a.js") == "test/unit"
    assert module_of("support/tail.js") == "support"
    assert module_of("Readme.md") == "root"


def test_ground_truth_rules_hand_example():
    gt = ground_truth(PRE + POST, "A", CUT)
    assert gt["lib"]["positive"]                      # 2 new-author commits + a fix
    assert not gt["docs"]["positive"]                 # new author, but no fix within window
    assert not gt["lib/reporters"]["positive"]        # fix, but B already knew the module
    assert gt["lib"]["new_author_commits"] == 2


def test_metrics_hand_example():
    r = evaluate(PRE + POST, "A", CUT, k_max=3)
    assert r["positives"] == ["lib"]
    m = {x["k"]: x for x in r["metrics"]["commit_count"]}
    # A's commits: lib 2 (two files in one commit count per file), lib/reporters 1, docs 1
    assert r["rankings"]["commit_count"][0]["module"] == "lib"
    assert m[1]["precision"] == 1.0 and m[1]["recall"] == 1.0
    assert m[3]["precision"] == round(1 / 3, 3)


def test_ranking_never_reads_post_cutoff_data():
    base = rank_modules(PRE + POST, "A", CUT)
    tampered = copy.deepcopy(POST)
    for c in tampered:
        c["author"] = "A"
        c["files"] = ["lib/reporters/x.js", "brand_new/z.js"]
    assert rank_modules(PRE + tampered, "A", CUT) == base
    assert rank_modules(PRE, "A", CUT) == base


def test_saved_mocha_result_is_consistent():
    saved = json.loads((REAL_DIR / "mocha" / "backtest_result.json").read_text())
    assert saved["dataset"]["leaver"] == "Contributor A"
    assert saved["dataset"]["licence"] == "MIT"
    assert len(saved["controls"]) == 3
    from app.realbacktest import run_real_backtest
    assert run_real_backtest("mocha")["result"]["metrics"] == saved["result"]["metrics"]


def test_dataset_endpoints():
    from fastapi.testclient import TestClient
    from app.main import app
    c = TestClient(app)
    ds = c.get("/api/backtest/datasets").json()
    assert ds[0]["id"] == "sample" and any(d["id"] == "mocha" for d in ds)
    r = c.get("/api/backtest/real/mocha")
    assert r.status_code == 200 and r.json()["dataset"]["leaver"] == "Contributor A"
    for bad in ["../sample", "MOCHA", "nope", "a;b"]:
        assert c.get(f"/api/backtest/real/{bad}").status_code == 404


def test_score_v2_formula_hand_example():
    from app.derived import compute_exposure_weighted_score
    own = [
        {"module": "big", "leaver_share": 0.5, "leaver_count": 16},    # 0.5 × 4 = 2.0
        {"module": "tiny", "leaver_share": 1.0, "leaver_count": 1},    # 1.0 × 1 = 1.0
        {"module": "none", "leaver_share": 0.0, "leaver_count": 0},
    ]
    s = compute_exposure_weighted_score(own)
    assert s == {"big": 2.0, "tiny": 1.0, "none": 0.0}
    assert list(s) == ["big", "tiny", "none"]


def test_v2_ranking_present_and_never_reads_post_cutoff_data():
    base = rank_modules(PRE + POST, "A", CUT)
    assert {r["module"] for r in base["backstop_v2"]} == {r["module"] for r in base["backstop"]}
    assert rank_modules(PRE, "A", CUT)["backstop_v2"] == base["backstop_v2"]


def test_saved_mocha_v2_result_is_reported_as_measured():
    saved = json.loads((REAL_DIR / "mocha" / "backtest_result.json").read_text())
    hits = {k: next(m["hit_count"] for m in v if m["k"] == 5) for k, v in saved["result"]["metrics"].items()}
    assert hits == {"backstop": 0, "backstop_v2": 4, "commit_count": 5, "commit_share": 2}
    assert any("in-sample" in x for x in saved["limitations"])
