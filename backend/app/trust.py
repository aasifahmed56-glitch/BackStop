"""
Trust report: serves the SAVED results of the leak harness and the
support-check evaluation. No live checks or AI calls run per request.
"""
from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter

router = APIRouter(prefix="/trust", tags=["trust"])

TRUST_DIR = Path(__file__).resolve().parent.parent / "data" / "trust"


def _load(name: str) -> Optional[dict[str, Any]]:
    p = TRUST_DIR / name
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def _grouped_failures(rep: dict[str, Any]) -> list[dict[str, Any]]:
    groups: dict[str, dict[str, Any]] = defaultdict(lambda: {"count": 0, "roles": set(), "attacks": set(), "what": set()})
    for f in rep.get("failures", []):
        g = groups[f"{f['method']} {f['endpoint']}"]
        g["count"] += 1
        g["roles"].add(f["role"])
        g["attacks"].add(f["attack"])
        g["what"].update(f.get("leaked") or [f.get("detail", "")])
    out = []
    for ep, g in groups.items():
        kinds = sorted({_kind(w) for w in g["what"] if w})
        out.append({"endpoint": ep, "count": g["count"], "roles": sorted(g["roles"]), "attacks": sorted(g["attacks"]), "exposed": kinds})
    return sorted(out, key=lambda x: -x["count"])


def _kind(label: str) -> str:
    """Summarise a marker label without repeating any leaked text."""
    for k in ("confidential", "restricted", "fake API key", "personal email", "personal phone", "raw text"):
        if label.startswith(k) or k in label:
            return {"confidential": "confidential budget text", "restricted": "restricted advisor text"}.get(k, k)
    if "accepted" in label or "changed" in label:
        return "write accepted without a reviewer role"
    return label


def _eval_view(ev: Optional[dict[str, Any]]) -> Optional[dict[str, Any]]:
    if not ev:
        return None
    keep = ("generated_at", "llm_provider", "ai_check_ran", "note", "system", "rule", "pairs", "bad_pairs",
            "correct_pairs", "ai_check_not_run", "caught", "catch_rate", "falsely_rejected", "false_reject_rate",
            "per_category", "confusion_matrix", "misses", "false_rejects")
    return {k: ev[k] for k in keep if k in ev}


@router.get("/report")
def trust_report():
    after = _load("leak_report.json")
    before = _load("leak_report_before.json")
    ev_before = _load("support_eval_before.json")
    ev_after = _load("support_eval_after.json")
    replay = _load("tripwire_replay.json")
    fixes = _load("leak_fixes.json")
    return {
        "leak": {
            "available": after is not None,
            "generated_at": after.get("generated_at") if after else None,
            "note": after.get("note") if after else None,
            "now": after.get("summary") if after else None,
            "by_endpoint": after.get("by_endpoint") if after else None,
            "still_leaking": _grouped_failures(after) if after else [],
            "before_fixes": before.get("summary") if before else None,
            "found_before_fixes": _grouped_failures(before) if before else [],
            "fixes": (fixes or {}).get("fixes", []),
        },
        "support_eval": {
            "available": ev_after is not None,
            "before": _eval_view(ev_before),
            "after": _eval_view(ev_after),
            "detail_check_alone": _eval_view((ev_after or {}).get("detail_check_alone")),
            "effect_on_sample_claims": (ev_after or {}).get("effect_on_sample_claims"),
        },
        "tripwire_replay": replay,
        "limitations": [
            "Roles are simulated with a switcher and there is no sign-in. The server trusts the role value it is sent, so these are tested cases of the access rules, not a test of authentication.",
            "The leak harness checks for known planted strings and the text of known restricted and confidential claims. Text it was not told to look for would not be flagged.",
            "The support-check evaluation has 40 hand-written pairs from one synthetic project. It is a small set and the rates can move a lot with a few pairs.",
            "The AI support check has not been run on the evaluation pairs yet because no API key was available. Only the deterministic detail check has real numbers.",
            "The detail check only compares numbers, dates and capitalised names. A claim that reverses or exaggerates its quote with the same words passes it.",
            "All data is synthetic.",
        ],
    }
