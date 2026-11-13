"""
Backtest: score a handover against post-departure ground truth.

Ground truth is loaded from backend/data/sample/ground_truth.json.
It is NEVER shown to any AI — only used here for scoring.

Score = F1-like measure over {flagged modules, decisions, contacts, risks}
"""
from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.db import get_session
from app.models import Claim, ClaimType, ReviewState, Role

router = APIRouter(prefix="/backtest", tags=["backtest"])

_GROUND_TRUTH_PATH = Path(__file__).parent.parent / "data" / "sample" / "ground_truth.json"


def _load_ground_truth() -> dict:
    if not _GROUND_TRUTH_PATH.exists():
        return {}
    return json.loads(_GROUND_TRUTH_PATH.read_text(encoding="utf-8"))


def _extract_handover_items(claims: list[Claim]) -> dict:
    """Extract the key items from approved claims for scoring."""
    items: dict[str, set[str]] = {
        "owners": set(),
        "decisions": set(),
        "risks": set(),
        "contacts": set(),
        "blockers": set(),
    }
    for c in claims:
        if c.review_state != ReviewState.approved:
            continue
        t = c.text.lower()
        if c.type == ClaimType.owner:
            items["owners"].add(t)
        elif c.type == ClaimType.decision:
            items["decisions"].add(t)
        elif c.type == ClaimType.risk:
            items["risks"].add(t)
        elif c.type == ClaimType.contact:
            items["contacts"].add(t)
        elif c.type == ClaimType.blocker:
            items["blockers"].add(t)
    return items


def _score(predicted: set[str], expected: list[str]) -> dict:
    """
    Keyword-overlap score: for each expected item, check if any keyword
    from the item appears in any predicted string.
    Returns precision, recall, f1.
    """
    if not expected:
        return {"precision": 1.0, "recall": 1.0, "f1": 1.0, "hits": [], "misses": []}

    hits, misses = [], []
    for item in expected:
        keywords = set(item.lower().split())
        matched = any(
            len(keywords & set(pred.split())) >= 2
            for pred in predicted
        )
        (hits if matched else misses).append(item)

    recall = len(hits) / len(expected)
    precision = len(hits) / max(len(predicted), 1)
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0
    return {
        "precision": round(precision, 3),
        "recall": round(recall, 3),
        "f1": round(f1, 3),
        "hits": hits,
        "misses": misses,
    }


@router.get("/projects/{project_id}")
def backtest(project_id: int, session: Session = Depends(get_session)):
    """Score the approved handover for project_id against ground truth."""
    gt = _load_ground_truth()
    if not gt:
        raise HTTPException(status_code=404, detail="Ground truth file not found.")

    claims = session.exec(select(Claim).where(Claim.project_id == project_id)).all()
    handover = _extract_handover_items(claims)

    scores = {
        "sole_knowledge_modules": _score(
            handover["risks"],
            gt.get("sole_knowledge_modules", []),
        ),
        "key_decisions": _score(
            handover["decisions"],
            gt.get("key_decisions", []),
        ),
        "critical_contacts": _score(
            handover["contacts"],
            gt.get("critical_contacts", []),
        ),
        "open_risks": _score(
            handover["risks"],
            gt.get("open_risks", []),
        ),
        "modules_should_not_flag": _false_positive_check(
            handover["risks"] | handover["owners"],
            gt.get("modules_should_not_flag", []),
        ),
    }

    overall = sum(s["f1"] for s in scores.values() if "f1" in s) / len(scores)
    return {
        "project_id": project_id,
        "overall_score": round(overall, 3),
        "scores": scores,
        "note": "Ground truth is never shown to any AI — used only for scoring.",
    }


def _false_positive_check(predicted: set[str], should_not_flag: list[str]) -> dict:
    """Check that well-covered modules are NOT flagged as risks."""
    false_positives = []
    for item in should_not_flag:
        kw = set(item.lower().split())
        if any(len(kw & set(p.split())) >= 2 for p in predicted):
            false_positives.append(item)
    score = 1.0 - len(false_positives) / max(len(should_not_flag), 1)
    return {
        "precision": round(score, 3),
        "recall": 1.0,
        "f1": round(score, 3),
        "false_positives": false_positives,
    }

