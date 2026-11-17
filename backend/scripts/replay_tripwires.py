"""
Replay validation for tripwires on the synthetic sample and the real mocha dataset.

Run from backend/:
  python scripts/replay_tripwires.py

Writes backend/data/trust/tripwire_replay.json. Plain code, no AI, no network.
The rules are in app/tripwires_replay.py and docs/TRIPWIRES.md.
"""
from __future__ import annotations

import json
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.derived import _module_of  # noqa: E402
from app.realbacktest import commits_from_log, dataset_dir, module_of  # noqa: E402
from app.tripwires import REPLAY_PATH  # noqa: E402
from app.tripwires_replay import FIX_DAYS, TROUBLE_RE, WINDOW_DAYS, replay  # noqa: E402

BACKEND = Path(__file__).resolve().parents[1]
SAMPLE_DEPARTURE = date(2026, 3, 15)
SAMPLE_REPLAY_CUTOFF = SAMPLE_DEPARTURE - timedelta(days=60)


def run() -> dict:
    sample_commits = commits_from_log((BACKEND / "data" / "sample" / "git_log.txt").read_text(encoding="utf-8"))
    sample = replay(sample_commits, "Riya", SAMPLE_REPLAY_CUTOFF, _module_of)
    sample["dataset"] = {
        "name": "sample",
        "label": "Synthetic sample (Campus Event App)",
        "leaver": "Riya",
        "note": ("The sample git log ends on the departure date (15 Mar 2026), so there are no "
                 "commits after the real departure. The replay uses a cutoff 60 days earlier "
                 "(14 Jan 2026) and treats the following commits as proposed changes. "
                 "The leaver is still active in that window. Synthetic data: not a real-world result."),
    }

    d = dataset_dir("mocha")
    meta = json.loads((d / "metadata.json").read_text(encoding="utf-8"))
    mocha_commits = commits_from_log((d / "git_log.txt").read_text(encoding="utf-8"))
    mocha = replay(mocha_commits, meta["leaver"], date.fromisoformat(meta["departure_date"]), module_of)
    mocha["dataset"] = {
        "name": "mocha",
        "label": "mochajs/mocha (MIT), pseudonymised",
        "leaver": meta["leaver"],
        "repository_url": meta["repository_url"],
        "departure_evidence": meta["departure_evidence"],
        "note": "Real public history; contributors are pseudonymised.",
    }

    return {
        "generated_by": "backend/scripts/replay_tripwires.py",
        "ai_used": False,
        "rules": {
            "window_days": WINDOW_DAYS,
            "fix_days": FIX_DAYS,
            "trouble_pattern": TROUBLE_RE.pattern,
            "problematic": ("Reverted later (a revert names its hash or quotes its message), or a commit "
                            f"matching the trouble pattern touches the same files within {FIX_DAYS} days. "
                            "'same_module' is a looser secondary rule."),
            "tripwires_used": ("Only git-based tripwires (reverted work, sole knowledge, stale modules) built "
                               "from pre-cutoff commits. Decision and conflict tripwires need reviewed claims, "
                               "which have no dates, so the replay cannot use them."),
            "baseline": "Flag every commit that touches a module whose top author before the cutoff is the leaver.",
        },
        "datasets": [sample, mocha],
    }


def main() -> int:
    res = run()
    REPLAY_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPLAY_PATH.write_text(json.dumps(res, indent=2) + "\n", encoding="utf-8")
    for ds in res["datasets"]:
        print(f"== {ds['dataset']['label']}: cutoff {ds['cutoff']}, {ds['proposed_changes']} proposed changes, "
              f"{ds['tripwires_built']} tripwires {ds['tripwires_by_kind']}")
        for rule, r in ds["results"].items():
            print(f"  [{rule}] problematic {r['problematic']} (base rate {r['base_rate']})")
            for name in ("tripwires", "baseline_leaver_owned_module", "flag_everything"):
                print(f"    {name:30s} {r[name]}")
            for k, m in r["tripwires_by_kind"].items():
                print(f"      only {k:24s} {m}")
    print(f"Saved {REPLAY_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
