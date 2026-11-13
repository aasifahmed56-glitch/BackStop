"""
Unit tests for the Backtest engine (backtest.py).
Verifies that ranking, precision@k, recall@k, and hit/miss calculations
match hand-computed numbers on a tiny synthetic test dataset.
"""
from datetime import date, datetime
import pytest
from app.backtest import (
    compute_precision_recall_at_k,
    run_ranking_benchmark,
    SYNTHETIC_DISCLAIMER,
)


def _dt(s: str) -> datetime:
    return datetime.strptime(s, "%Y-%m-%d")


def test_compute_precision_recall_at_k_hand_calculated():
    # Ground truth: 2 troubled modules
    gt = {"M_RISK", "M_STALE"}

    # Perfect ranking
    ranked_perfect = ["M_RISK", "M_STALE", "M_POPULAR", "M_OTHER"]
    metrics = compute_precision_recall_at_k(ranked_perfect, gt, k_max=4)

    # k=1: top_k=["M_RISK"] -> 1 hit out of 1 -> p=1.0, r=0.5
    assert metrics[0]["k"] == 1
    assert metrics[0]["precision"] == 1.0
    assert metrics[0]["recall"] == 0.5
    assert metrics[0]["hits"] == ["M_RISK"]
    assert set(metrics[0]["misses"]) == {"M_STALE"}

    # k=2: top_k=["M_RISK", "M_STALE"] -> 2 hits out of 2 -> p=1.0, r=1.0
    assert metrics[1]["k"] == 2
    assert metrics[1]["precision"] == 1.0
    assert metrics[1]["recall"] == 1.0
    assert set(metrics[1]["hits"]) == {"M_RISK", "M_STALE"}
    assert metrics[1]["misses"] == []

    # k=3: top_k=["M_RISK", "M_STALE", "M_POPULAR"] -> 2 hits out of 3 -> p=2/3=0.667, r=1.0
    assert metrics[2]["k"] == 3
    assert metrics[2]["precision"] == 0.667
    assert metrics[2]["recall"] == 1.0

    # k=4: top_k=[...4] -> 2 hits out of 4 -> p=0.5, r=1.0
    assert metrics[3]["k"] == 4
    assert metrics[3]["precision"] == 0.5
    assert metrics[3]["recall"] == 1.0


def test_run_ranking_benchmark_backstop_vs_baseline():
    """
    Construct commits such that:
    - M_STALE: Alice has 5 commits, no one else touched it, stale (last commit 2026-01-01).
    - M_RISK: Alice has 8 commits, Bob has 1 commit, active.
    - M_POPULAR: Alice has 12 commits, but Charlie, Dave, Eve also have 10 each (well shared).
    - M_SHARED: Alice has 1 commit, Bob has 10 commits.

    Ground truth = {"M_STALE", "M_RISK"}
    """
    cutoff = date(2026, 3, 15)
    leaver = "Alice"

    commits = []

    # 1. M_STALE: 5 Alice commits, 73 days stale
    for i in range(5):
        commits.append({
            "chunk_id": i + 1,
            "author": "Alice",
            "timestamp": _dt("2026-01-01"),
            "files": ["M_STALE/code.py"],
            "message": "stale work",
        })

    # 2. M_RISK: 8 Alice, 1 Bob, active
    for i in range(8):
        commits.append({
            "chunk_id": 10 + i,
            "author": "Alice",
            "timestamp": _dt("2026-03-10"),
            "files": ["M_RISK/feature.py"],
            "message": "risk feature",
        })
    commits.append({
        "chunk_id": 19,
        "author": "Bob",
        "timestamp": _dt("2026-03-11"),
        "files": ["M_RISK/typo.py"],
        "message": "typo fix",
    })

    # 3. M_POPULAR: 12 Alice, 10 Charlie, 10 Dave, 10 Eve (well-shared team module)
    for i in range(12):
        commits.append({
            "chunk_id": 20 + i,
            "author": "Alice",
            "timestamp": _dt("2026-03-14"),
            "files": ["M_POPULAR/ui.py"],
            "message": "ui work",
        })
    for person in ["Charlie", "Dave", "Eve"]:
        for i in range(10):
            commits.append({
                "chunk_id": 100 + i,
                "author": person,
                "timestamp": _dt("2026-03-14"),
                "files": ["M_POPULAR/ui.py"],
                "message": f"collab by {person}",
            })

    # 4. M_SHARED: 1 Alice, 10 Bob
    commits.append({
        "chunk_id": 200,
        "author": "Alice",
        "timestamp": _dt("2026-03-10"),
        "files": ["M_SHARED/doc.md"],
        "message": "minor edit",
    })
    for i in range(10):
        commits.append({
            "chunk_id": 201 + i,
            "author": "Bob",
            "timestamp": _dt("2026-03-12"),
            "files": ["M_SHARED/main.py"],
            "message": "bob owns shared",
        })

    gt_modules = ["M_STALE", "M_RISK"]

    result = run_ranking_benchmark(
        commits=commits,
        leaver=leaver,
        cutoff=cutoff,
        ground_truth_modules=gt_modules,
        stale_days=30,
        k_max=4,
    )

    assert result["disclaimer"] == SYNTHETIC_DISCLAIMER
    assert result["leaver_name"] == "Alice"
    assert set(result["ground_truth_modules"]) == {"M_STALE", "M_RISK"}

    # Backstop ranking should rank M_STALE first (high staleness * sole author), then M_RISK
    backstop_order = [r["module"] for r in result["backstop"]["ranking"]]
    assert backstop_order[:2] == ["M_STALE", "M_RISK"]

    # Baseline ranking sorts by raw commits: M_POPULAR (12) > M_RISK (8) > M_STALE (5) > M_SHARED (1)
    baseline_order = [r["module"] for r in result["baseline"]["ranking"]]
    assert baseline_order == ["M_POPULAR", "M_RISK", "M_STALE", "M_SHARED"]

    # Compare Precision@1:
    # Backstop top 1 is M_STALE (in GT) -> Precision@1 = 1.0
    # Baseline top 1 is M_POPULAR (NOT in GT) -> Precision@1 = 0.0
    backstop_k1 = result["backstop"]["metrics"][0]
    baseline_k1 = result["baseline"]["metrics"][0]
    assert backstop_k1["precision"] == 1.0
    assert backstop_k1["recall"] == 0.5
    assert baseline_k1["precision"] == 0.0
    assert baseline_k1["recall"] == 0.0

    # Compare Precision@2:
    # Backstop top 2 is [M_STALE, M_RISK] -> Precision@2 = 1.0, Recall@2 = 1.0
    # Baseline top 2 is [M_POPULAR, M_RISK] -> Precision@2 = 0.5, Recall@2 = 0.5
    backstop_k2 = result["backstop"]["metrics"][1]
    baseline_k2 = result["baseline"]["metrics"][1]
    assert backstop_k2["precision"] == 1.0
    assert backstop_k2["recall"] == 1.0
    assert baseline_k2["precision"] == 0.5
    assert baseline_k2["recall"] == 0.5

