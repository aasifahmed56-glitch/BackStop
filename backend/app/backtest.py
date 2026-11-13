"""
Backtest: evaluate the handover and derived risk engine against post-departure ground truth.

GROUND TRUTH (backend/data/sample/ground_truth.json):
  Modules taken over after the cutoff by people new to them, plus modules
  with later reverts or reopened decisions.
  NEVER passed to any LLM — used strictly offline for empirical scoring.

EVALUATION:
  1. Re-runs the DERIVED engine using ONLY data up to the departure_date.
  2. Ranks modules by knowledge_at_risk_score.
     BASELINE: ranks modules by the leaver's raw commit count.
  3. Metrics: precision@k and recall@k for k=1..5 for both rankings,
     with exact hits and misses.
  4. Labeled: "Synthetic demonstration. Scores are on data we generated and are not real-world results."
"""
from __future__ import annotations

import json
from datetime import date
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.db import get_session
from app.derived import (
    _DEFAULT_STALE_DAYS,
    compute_knowledge_at_risk_score,
    compute_ownership,
    compute_stale_modules,
    parse_commits_from_chunks,
)
from app.models import Chunk, Project, Source, SourceKind

router = APIRouter(prefix="/backtest", tags=["backtest"])

_GROUND_TRUTH_PATH = Path(__file__).parent.parent / "data" / "sample" / "ground_truth.json"
SYNTHETIC_DISCLAIMER = "Synthetic demonstration. Scores are on data we generated and are not real-world results."


def load_ground_truth() -> dict[str, Any]:
    """Load the ground truth file (hidden from AI)."""
    if not _GROUND_TRUTH_PATH.exists():
        return {}
    return json.loads(_GROUND_TRUTH_PATH.read_text(encoding="utf-8"))


# ---------------------------------------------------------------------------
# Pure Evaluation Functions (Testable without DB)
# ---------------------------------------------------------------------------

def compute_precision_recall_at_k(
    ranked_modules: list[str],
    ground_truth: set[str],
    k_max: int = 5,
) -> list[dict[str, Any]]:
    """
    Compute precision@k and recall@k for k in 1..k_max.
    Precision@k = |top_k ∩ ground_truth| / k
    Recall@k = |top_k ∩ ground_truth| / |ground_truth|
    """
    total_relevant = len(ground_truth)
    results = []

    for k in range(1, k_max + 1):
        top_k = ranked_modules[:k]
        hits = [m for m in top_k if m in ground_truth]
        misses = [m for m in ground_truth if m not in top_k]

        precision = round(len(hits) / k, 3) if k > 0 else 0.0
        recall = round(len(hits) / total_relevant, 3) if total_relevant > 0 else 0.0

        results.append({
            "k": k,
            "precision": precision,
            "recall": recall,
            "top_k": top_k,
            "hits": hits,
            "misses": misses,
            "hit_count": len(hits),
            "relevant_count": total_relevant,
        })

    return results


def run_ranking_benchmark(
    commits: list[dict[str, Any]],
    leaver: str,
    cutoff: Optional[date],
    ground_truth_modules: list[str],
    stale_days: int = _DEFAULT_STALE_DAYS,
    k_max: int = 5,
) -> dict[str, Any]:
    """
    Pure function:
    1. Filters commits up to cutoff date.
    2. Computes ownership, staleness, and knowledge_at_risk_score per module.
    3. Ranks modules by Backstop score vs Baseline (leaver's raw commit count).
    4. Computes precision@k and recall@k for k=1..k_max for both rankings.
    """
    gt_set = set(ground_truth_modules)

    # Ensure commits have 'date' attribute if only 'timestamp' was provided
    for c in commits:
        if not c.get("date") and c.get("timestamp"):
            ts = c["timestamp"]
            c["date"] = ts.date() if hasattr(ts, "date") else None

    # 1. Compute ownership using ONLY data up to cutoff_date
    ownership = compute_ownership(commits, leaver, cutoff)
    stale = compute_stale_modules(commits, cutoff, stale_days)
    scores = compute_knowledge_at_risk_score(ownership, stale, leaver, stale_days)

    # Map raw counts
    leaver_commit_map: dict[str, int] = {}
    total_commit_map: dict[str, int] = {}
    for item in ownership:
        m = item["module"]
        leaver_commit_map[m] = item["leaver_count"]
        total_commit_map[m] = item["total"]

    all_modules = [item["module"] for item in ownership]

    # 2. Backstop Ranking: sorted descending by knowledge_at_risk_score
    # Tiebreak: leaver commits desc, then module name asc
    backstop_ranking = sorted(
        all_modules,
        key=lambda m: (scores.get(m, 0.0), leaver_commit_map.get(m, 0), m),
        reverse=True,
    )

    # 3. Baseline Ranking: sorted descending by leaver raw commit count
    # Tiebreak: total commits desc, then module name asc
    baseline_ranking = sorted(
        all_modules,
        key=lambda m: (leaver_commit_map.get(m, 0), total_commit_map.get(m, 0), m),
        reverse=True,
    )

    # 4. Metrics calculation
    backstop_metrics = compute_precision_recall_at_k(backstop_ranking, gt_set, k_max)
    baseline_metrics = compute_precision_recall_at_k(baseline_ranking, gt_set, k_max)

    return {
        "disclaimer": SYNTHETIC_DISCLAIMER,
        "cutoff_date": cutoff.isoformat() if cutoff else None,
        "leaver_name": leaver,
        "ground_truth_modules": sorted(list(gt_set)),
        "all_modules": all_modules,
        "backstop": {
            "ranking": [
                {
                    "rank": i + 1,
                    "module": m,
                    "score": round(scores.get(m, 0.0), 3),
                    "leaver_commits": leaver_commit_map.get(m, 0),
                    "total_commits": total_commit_map.get(m, 0),
                    "is_troubled": m in gt_set,
                }
                for i, m in enumerate(backstop_ranking)
            ],
            "metrics": backstop_metrics,
        },
        "baseline": {
            "ranking": [
                {
                    "rank": i + 1,
                    "module": m,
                    "leaver_commits": leaver_commit_map.get(m, 0),
                    "total_commits": total_commit_map.get(m, 0),
                    "is_troubled": m in gt_set,
                }
                for i, m in enumerate(baseline_ranking)
            ],
            "metrics": baseline_metrics,
        },
    }


# ---------------------------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------------------------

@router.get("/projects/{project_id}")
def backtest_project(project_id: int, session: Session = Depends(get_session)):
    """
    Score the derived engine against ground truth:
    1. Loads git commits for project up to departure_date.
    2. Ranks modules by Backstop knowledge_at_risk_score vs Baseline raw commit count.
    3. Returns precision@k and recall@k for k=1..5, hits, misses, and rankings.
    """
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    gt = load_ground_truth()
    if not gt:
        raise HTTPException(status_code=404, detail="Ground truth file not found.")

    # Determine ground truth troubled modules
    ground_truth_modules = gt.get("ground_truth_modules")
    if not ground_truth_modules:
        # Fallback: extract from post_cutoff_events if not explicitly listed
        events = gt.get("post_cutoff_events", [])
        ground_truth_modules = []
        for ev in events:
            for mod in ["deploy", "payments", "auth", "notifications", "events-api", "web-ui", "docs"]:
                if mod in ev.lower() and mod not in ground_truth_modules:
                    ground_truth_modules.append(mod)

    # Load git sources and chunks for project
    git_sources = session.exec(
        select(Source).where(
            Source.project_id == project_id,
            Source.kind == SourceKind.git,
        )
    ).all()

    git_chunks: list[Chunk] = []
    for src in git_sources:
        git_chunks.extend(session.exec(select(Chunk).where(Chunk.source_id == src.id)).all())

    commits = parse_commits_from_chunks(git_chunks)

    # Run pure benchmark
    benchmark = run_ranking_benchmark(
        commits=commits,
        leaver=project.leaver_name,
        cutoff=project.departure_date,
        ground_truth_modules=ground_truth_modules,
        k_max=5,
    )

    # Legacy overall F1 for backward compatibility
    # Compute mean F1 across k=1..5 for Backstop
    f1_scores = []
    for m in benchmark["backstop"]["metrics"]:
        p = m["precision"]
        r = m["recall"]
        f1 = (2 * p * r) / (p + r) if (p + r) > 0 else 0.0
        f1_scores.append(f1)
    overall_f1 = round(sum(f1_scores) / len(f1_scores), 3) if f1_scores else 0.0

    return {
        "project_id": project_id,
        "project_name": project.name,
        "overall_f1": overall_f1,
        **benchmark,
    }
