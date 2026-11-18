"""
Replay validation for tripwires (plain code, no AI).

Rules (fixed before any result was computed; see docs/TRIPWIRES.md):
  1. Build tripwires from commits on or before the cutoff ONLY (build_git_tripwires).
  2. Every commit in the WINDOW_DAYS after the cutoff is treated as a proposed change:
     its file list and its message are passed to the same matcher the app uses.
  3. A proposed commit is 'later problematic' if
       (a) a later commit reverts it (message starts with 'revert' and names its hash
           or quotes its message), or
       (b) a later commit within FIX_DAYS whose message matches TROUBLE_RE touches
           one of the same files.
     A secondary, looser rule (b') uses 'same module' instead of 'same file'.
  4. Report flagged, hits, misses, flag rate, precision and recall, against
     (i) a trivial baseline that flags every commit touching a module the leaver
     owned (leaver is the top author before the cutoff), and (ii) flagging everything.
"""
from __future__ import annotations

import re
from datetime import date, timedelta
from typing import Any, Callable

from app.derived import compute_ownership
from app.tripwires import build_git_tripwires, match_change

WINDOW_DAYS = 180
FIX_DAYS = 30
TROUBLE_RE = re.compile(r"\b(revert|reverts|reverted|fix|fixes|fixed|bug)\b", re.I)


def _order(commits: list[dict]) -> list[dict]:
    return sorted(enumerate(commits), key=lambda ic: (ic[1].get("timestamp") or ic[1]["date"], ic[0]))


def later_problems(commits: list[dict], fix_days: int = FIX_DAYS,
                   module_fn: Callable[[str], str] | None = None) -> dict[str, list[str]]:
    """hash -> reasons it later proved problematic. module_fn=None means file-level rule."""
    ordered = [c for _, c in _order(commits)]
    out: dict[str, list[str]] = {}
    for i, c in enumerate(ordered):
        reasons: list[str] = []
        msg = c["message"].strip().lower()
        areas = set(c["files"]) if module_fn is None else {module_fn(f) for f in c["files"]}
        for later in ordered[i + 1:]:
            lmsg = later["message"].lower()
            if lmsg.startswith("revert") and (c["hash"][:7] in lmsg or (len(msg) >= 10 and msg in lmsg)):
                reasons.append(f"reverted by {later['hash'][:10]}")
                continue
            if (later["date"] - c["date"]).days > fix_days:
                continue
            if TROUBLE_RE.search(later["message"]):
                lareas = set(later["files"]) if module_fn is None else {module_fn(f) for f in later["files"]}
                if areas & lareas:
                    reasons.append(f"fix {later['hash'][:10]} touched the same "
                                   f"{'files' if module_fn is None else 'module'} within {fix_days} days")
        if reasons:
            out[c["hash"]] = reasons
    return out


def _metrics(flagged: set[str], problematic: set[str], total: int) -> dict[str, Any]:
    hits = flagged & problematic
    return {
        "flagged": len(flagged),
        "hits": len(hits),
        "misses": len(problematic - flagged),
        "false_alarms": len(flagged - problematic),
        "flag_rate": round(len(flagged) / total, 3) if total else 0.0,
        "precision": round(len(hits) / len(flagged), 3) if flagged else None,
        "recall": round(len(hits) / len(problematic), 3) if problematic else None,
    }


def replay(commits: list[dict], leaver: str, cutoff: date,
           module_fn: Callable[[str], str], window_days: int = WINDOW_DAYS,
           fix_days: int = FIX_DAYS) -> dict[str, Any]:
    pre = [c for c in commits if c["date"] <= cutoff]
    end = cutoff + timedelta(days=window_days)
    proposals = [c for _, c in _order(commits) if cutoff < c["date"] <= end]
    tripwires = build_git_tripwires(commits, leaver, cutoff, module_fn=module_fn)

    own = compute_ownership(pre, leaver, cutoff, module_fn=module_fn)
    owned = {o["module"] for o in own if o["top_author"] == leaver}

    flagged_tw: set[str] = set()
    flagged_by_kind: dict[str, set[str]] = {}
    by_kind: dict[str, int] = {}
    by_match: dict[str, int] = {"path": 0, "keyword": 0}
    examples: list[dict] = []
    for c in proposals:
        trig = match_change(tripwires, c["files"], c["message"], module_fn=module_fn)
        if trig:
            flagged_tw.add(c["hash"])
            for t in trig:
                by_kind[t["kind"]] = by_kind.get(t["kind"], 0) + 1
                flagged_by_kind.setdefault(t["kind"], set()).add(c["hash"])
            for m in {m for t in trig for m in t["matched_by"]}:
                by_match[m] += 1
            if len(examples) < 8:
                examples.append({"commit": c["hash"][:10], "date": c["date"].isoformat(),
                                 "message": c["message"][:120],
                                 "tripwires": [t["id"] for t in trig][:4]})
    flagged_base = {c["hash"] for c in proposals if any(module_fn(f) in owned for f in c["files"])}
    flagged_all = {c["hash"] for c in proposals}
    proposal_hashes = flagged_all

    results = {}
    for rule, mfn in (("same_file", None), ("same_module", module_fn)):
        probs = {h for h in later_problems(commits, fix_days, mfn) if h in proposal_hashes}
        results[rule] = {
            "problematic": len(probs),
            "base_rate": round(len(probs) / len(proposals), 3) if proposals else 0.0,
            "tripwires": _metrics(flagged_tw, probs, len(proposals)),
            "baseline_leaver_owned_module": _metrics(flagged_base, probs, len(proposals)),
            "flag_everything": _metrics(flagged_all, probs, len(proposals)),
            "tripwires_by_kind": {k: _metrics(v, probs, len(proposals))
                                  for k, v in sorted(flagged_by_kind.items())},
        }

    kinds: dict[str, int] = {}
    for t in tripwires:
        kinds[t.kind] = kinds.get(t.kind, 0) + 1
    return {
        "cutoff": cutoff.isoformat(),
        "window_end": end.isoformat(),
        "proposed_changes": len(proposals),
        "tripwires_built": len(tripwires),
        "tripwires_by_kind": kinds,
        "leaver_owned_modules": sorted(owned),
        "triggered_by_kind": by_kind,
        "flagged_commits_by_match": by_match,
        "results": results,
        "examples": examples,
    }
