"""
Backtest on a real-project dataset (backend/data/real/<name>).

Rules are fixed in docs/BACKTEST_METHOD.md and were written before results
were computed. Plain code only, no AI.

The ranking sees ONLY commits on or before the cutoff (see rank_modules).
Ground truth is computed ONLY from commits after the cutoff (see ground_truth).
"""
from __future__ import annotations

import json
import re
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path
from typing import Any, Optional

from app.backtest import compute_precision_recall_at_k
from app.derived import (
    _DEFAULT_STALE_DAYS,
    compute_knowledge_at_risk_score,
    compute_ownership,
    compute_stale_modules,
    parse_commits_from_chunks,
)
from app.ingest import parse_git_log

REAL_DIR = Path(__file__).parent.parent / "data" / "real"
METHOD_URL = "https://github.com/aasifahmed56-glitch/BackStop/blob/main/docs/BACKTEST_METHOD.md"

WINDOW_DAYS = 180
MIN_NEW_AUTHOR_COMMITS = 2
_TROUBLE_RE = re.compile(r"\b(revert|fix|fixes|fixed|bug)\b", re.I)
_SPLIT_DIRS = {"lib", "src", "test"}
CONTROL_MONTHS = (12, 18, 24)


def module_of(path: str) -> str:
    """Top-level directory; lib/, src/ and test/ split one level deeper; root files -> 'root'."""
    parts = path.strip().split("/")
    if len(parts) == 1:
        return "root"
    if parts[0] in _SPLIT_DIRS and len(parts) > 2:
        return f"{parts[0]}/{parts[1]}"
    return parts[0]


def list_datasets() -> list[dict[str, Any]]:
    out = []
    if REAL_DIR.exists():
        for d in sorted(REAL_DIR.iterdir()):
            meta = d / "metadata.json"
            if meta.exists():
                out.append(json.loads(meta.read_text(encoding="utf-8")))
    return out


def dataset_dir(name: str) -> Path:
    if not re.fullmatch(r"[a-z0-9][a-z0-9_-]{0,63}", name or ""):
        raise ValueError("Unknown dataset.")
    d = REAL_DIR / name
    if not (d / "metadata.json").exists():
        raise ValueError("Unknown dataset.")
    return d


def load_commits(d: Path) -> list[dict]:
    chunks = parse_git_log((d / "git_log.txt").read_text(encoding="utf-8"), source_id=0)
    for i, c in enumerate(chunks):
        c.id = i + 1
    return [c for c in parse_commits_from_chunks(chunks) if c.get("date")]


# ---------------------------------------------------------------------------
# Ranking: pre-cutoff data only
# ---------------------------------------------------------------------------

def rank_modules(commits: list[dict], leaver: str, cutoff: date) -> dict[str, list[dict]]:
    """Return the three rankings. Filters to pre-cutoff commits first."""
    pre = [c for c in commits if c["date"] <= cutoff]
    own = compute_ownership(pre, leaver, cutoff, module_fn=module_of)
    stale = compute_stale_modules(pre, cutoff, _DEFAULT_STALE_DAYS, module_fn=module_of)
    scores = compute_knowledge_at_risk_score(own, stale, leaver, _DEFAULT_STALE_DAYS)
    by = {o["module"]: o for o in own}
    mods = [o["module"] for o in own if o["leaver_count"] > 0]

    def rows(order: list[str]) -> list[dict]:
        return [{
            "module": m,
            "score": scores.get(m, 0.0),
            "leaver_commits": by[m]["leaver_count"],
            "leaver_share": by[m]["leaver_share"],
            "total_commits": by[m]["total"],
        } for m in order]

    tie = lambda m: (by[m]["total"], m)  # noqa: E731
    return {
        "backstop": rows(sorted(mods, key=lambda m: (scores.get(m, 0.0), *tie(m)), reverse=True)),
        "commit_count": rows(sorted(mods, key=lambda m: (by[m]["leaver_count"], *tie(m)), reverse=True)),
        "commit_share": rows(sorted(mods, key=lambda m: (by[m]["leaver_share"], *tie(m)), reverse=True)),
    }


# ---------------------------------------------------------------------------
# Ground truth: post-cutoff data only
# ---------------------------------------------------------------------------

def ground_truth(commits: list[dict], leaver: str, cutoff: date,
                 window_days: int = WINDOW_DAYS) -> dict[str, dict]:
    """Per module evidence; a module is positive if both rule conditions hold."""
    before_authors: dict[str, set[str]] = defaultdict(set)
    for c in commits:
        if c["date"] <= cutoff:
            for f in c["files"]:
                before_authors[module_of(f)].add(c["author"])

    end = cutoff + timedelta(days=window_days)
    new_commits: dict[str, int] = defaultdict(int)
    trouble: dict[str, list[str]] = defaultdict(list)
    for c in commits:
        if not (cutoff < c["date"] <= end):
            continue
        for m in dict.fromkeys(module_of(f) for f in c["files"]):
            if c["author"] != leaver and c["author"] not in before_authors[m]:
                new_commits[m] += 1
            if _TROUBLE_RE.search(c["message"]):
                trouble[m].append(c["hash"][:10])

    out = {}
    for m in set(new_commits) | set(trouble):
        out[m] = {
            "new_author_commits": new_commits[m],
            "fix_or_revert_commits": len(trouble[m]),
            "example_commits": trouble[m][:3],
            "positive": new_commits[m] >= MIN_NEW_AUTHOR_COMMITS and len(trouble[m]) >= 1,
        }
    return out


def evaluate(commits: list[dict], leaver: str, cutoff: date, k_max: int = 5) -> dict[str, Any]:
    rankings = rank_modules(commits, leaver, cutoff)
    gt = ground_truth(commits, leaver, cutoff)
    ranked_modules = [r["module"] for r in rankings["backstop"]]
    positives = sorted(m for m, v in gt.items() if v["positive"] and m in ranked_modules)
    pos_set = set(positives)
    result: dict[str, Any] = {
        "cutoff": cutoff.isoformat(),
        "modules_ranked": len(ranked_modules),
        "positives": positives,
        "positive_count": len(positives),
        "chance_precision": round(len(positives) / len(ranked_modules), 3) if ranked_modules else 0.0,
        "ground_truth": {m: gt[m] for m in sorted(gt) if m in ranked_modules},
        "rankings": {},
        "metrics": {},
    }
    for name, rows in rankings.items():
        for r in rows:
            r["is_positive"] = r["module"] in pos_set
        result["rankings"][name] = rows
        metrics = compute_precision_recall_at_k([r["module"] for r in rows], pos_set, k_max)
        for x in metrics:
            x["misses"] = sorted(x["misses"])
        result["metrics"][name] = metrics
    return result


def _months_before(d: date, months: int) -> date:
    y, m = divmod(d.month - 1 - months, 12)
    return date(d.year + y, m + 1, min(d.day, 28))


def run_real_backtest(name: str) -> dict[str, Any]:
    d = dataset_dir(name)
    meta = json.loads((d / "metadata.json").read_text(encoding="utf-8"))
    commits = load_commits(d)
    cutoff = date.fromisoformat(meta["departure_date"])
    leaver = meta["leaver"]
    main = evaluate(commits, leaver, cutoff)
    controls = []
    for months in CONTROL_MONTHS:
        cd = _months_before(cutoff, months)
        r = evaluate(commits, leaver, cd)
        controls.append({
            "months_before": months,
            "cutoff": r["cutoff"],
            "positive_count": r["positive_count"],
            "modules_ranked": r["modules_ranked"],
            "chance_precision": r["chance_precision"],
            "metrics": r["metrics"],
        })
    return {
        "dataset": meta,
        "method": {
            "url": METHOD_URL,
            "window_days": WINDOW_DAYS,
            "min_new_author_commits": MIN_NEW_AUTHOR_COMMITS,
            "trouble_pattern": _TROUBLE_RE.pattern,
            "module_rule": "Top-level directory; lib/, src/ and test/ split one level deeper; root files grouped as 'root'.",
        },
        "result": main,
        "controls": controls,
        "limitations": [
            "One real project and one departure: a case study, not a statistical result.",
            "'fix' or 'revert' in a commit message is a rough signal of trouble.",
            "Modules are directories, which is coarse for a small project.",
            "The departure is inferred from public posts and the commit record.",
        ],
    }


def save_result(name: str) -> Path:
    res = run_real_backtest(name)
    out = dataset_dir(name) / "backtest_result.json"
    out.write_text(json.dumps(res, indent=2) + "\n", encoding="utf-8")
    return out
