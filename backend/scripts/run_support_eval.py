"""
Support-check evaluation.

Runs the 40 labelled pairs in backend/data/trust/support_eval.json through:
  BEFORE  the support check used by the pipeline (app.verify.check_claim_support,
          unchanged prompt).
  AFTER   the same support check followed by the deterministic detail check
          (app.detailcheck), exactly as the pipeline now combines them.
          The detail check is also scored on its own.
  STRICT  (optional, --strict) the stricter prompt in
          app.verify.check_claim_support_strict, with the detail check.

A bad claim counts as CAUGHT when the verdict is "no" or "partly" (it would not
be shown as Verified). A correct claim is FALSELY REJECTED when its verdict is
"no" or "partly". "unchecked" means the AI check did not run (no key, or no
saved answer); it is reported separately and never counted as caught.

Usage (from backend/):
    python scripts/run_support_eval.py                    # uses LLM_PROVIDER from the environment
    LLM_PROVIDER=anthropic ANTHROPIC_API_KEY=... python scripts/run_support_eval.py --strict

Writes data/trust/support_eval_before.json and data/trust/support_eval_after.json
(and support_eval_strict.json with --strict). Live answers are cached in
data/cache, so a run with a key can be replayed later with LLM_PROVIDER=none.
"""
from __future__ import annotations

import json
import os
import sys
import tempfile
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
TRUST = BACKEND / "data" / "trust"

VERDICTS = ["yes", "partly", "no", "unchecked"]


def _setup():
    os.environ.setdefault("LLM_PROVIDER", "none")
    os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mkdtemp(prefix='backstop-eval-')}/eval.db"
    sys.path.insert(0, str(BACKEND))
    import logging
    logging.disable(logging.WARNING)


def _resolve_chunks(pairs):
    """Find, for every pair, the real sample chunk that contains its quote."""
    from datetime import date
    from sqlmodel import Session, select
    from app.db import create_db_and_tables, engine
    from app.ingest import _ingest_all, _load_manifest
    from app.models import Chunk, Project, Source
    from app.verify import verify_quote_in_original

    create_db_and_tables()
    sample = BACKEND / "data" / "sample"
    with Session(engine) as s:
        proj = Project(name="Campus Event App", departure_date=date(2026, 3, 15), leaver_name="Riya")
        s.add(proj)
        s.flush()
        _ingest_all(s, proj, sample, _load_manifest(sample))
        s.commit()
        out = {}
        for p in pairs:
            src = s.exec(select(Source).where(Source.name == p["source"])).first()
            if src is None:
                raise SystemExit(f"{p['id']}: source {p['source']} not in sample")
            if src.access_level.value not in ("public", "team"):
                raise SystemExit(f"{p['id']}: evaluation pairs must come from public or team sources")
            chunk = next((c for c in s.exec(select(Chunk).where(Chunk.source_id == src.id)).all()
                          if verify_quote_in_original(p["quote"], c.text)), None)
            if chunk is None:
                raise SystemExit(f"{p['id']}: quote not found in {p['source']}")
            out[p["id"]] = chunk.text
        return out


def _sample_effect():
    """Run the real pipeline on the sample: how many claims the detail check downgrades, and cache misses."""
    from sqlmodel import Session
    from app.db import engine
    from app.derived import derive_claims
    from app.verify import run_extraction_and_verification
    with Session(engine) as s:
        derive_claims(1, s)
        st = run_extraction_and_verification(1, s)
    return {
        "verified": st["verified"],
        "inferred": st["inferred"],
        "downgraded_by_detail_check": st["downgraded_by_detail_check"],
        "ai_answers_missing_from_cache": st["support_unchecked"] + len(st["failed_sources"]),
        "seeded_fixtures": st["seeded"],
    }


def _score(rows, key):
    bad = [r for r in rows if r["category"] != "correct"]
    good = [r for r in rows if r["category"] == "correct"]
    flagged = lambda r: r[key] in ("no", "partly")
    not_run = sum(1 for r in rows if r[key] == "unchecked")
    caught = sum(1 for r in bad if flagged(r))
    false_rej = sum(1 for r in good if flagged(r))
    cats = sorted({r["category"] for r in rows}, key=lambda c: (c != "correct", c))
    matrix = {c: {v: sum(1 for r in rows if r["category"] == c and r[key] == v) for v in VERDICTS} for c in cats}
    per_cat = {
        c: {"pairs": sum(matrix[c].values()),
            "caught" if c != "correct" else "falsely_rejected": matrix[c]["no"] + matrix[c]["partly"]}
        for c in cats
    }
    misses = [
        {"id": r["id"], "category": r["category"], "claim": r["claim"], "quote": r["quote"],
         "verdict": r[key], "why": r.get(key + "_reason", "")}
        for r in rows if (r["category"] != "correct" and not flagged(r))
    ]
    false_rejects = [
        {"id": r["id"], "claim": r["claim"], "quote": r["quote"], "verdict": r[key], "why": r.get(key + "_reason", "")}
        for r in good if flagged(r)
    ]
    return {
        "pairs": len(rows),
        "bad_pairs": len(bad),
        "correct_pairs": len(good),
        "ai_check_not_run": not_run,
        "caught": caught,
        "catch_rate": round(caught / len(bad), 3) if bad else None,
        "falsely_rejected": false_rej,
        "false_reject_rate": round(false_rej / len(good), 3) if good else None,
        "per_category": per_cat,
        "confusion_matrix": matrix,
        "misses": misses,
        "false_rejects": false_rejects,
    }


def _combine(ai_verdict: str, detail_ok: bool) -> str:
    """What the pipeline does: a 'yes' with a missing detail is downgraded to 'partly' (Inferred)."""
    if not detail_ok and ai_verdict in ("yes", "unchecked"):
        return "partly"
    return ai_verdict


def main(argv):
    _setup()
    from app.detailcheck import check_claim_details
    from app.verify import check_claim_support, check_claim_support_strict

    data = json.loads((TRUST / "support_eval.json").read_text(encoding="utf-8"))
    pairs = data["pairs"]
    chunks = _resolve_chunks(pairs)
    sample_effect = _sample_effect()
    strict = "--strict" in argv
    provider = os.getenv("LLM_PROVIDER", "none")

    rows = []
    for p in pairs:
        ai = check_claim_support(p["claim"], p["quote"])
        det = check_claim_details(p["claim"], p["quote"], chunks[p["id"]])
        row = {**p,
               "ai": ai["supports"], "ai_reason": ai.get("reason", ""),
               "detail": "yes" if det["ok"] else "partly",
               "detail_reason": "missing from quote and chunk: " + ", ".join(d["text"] for d in det["missing"]) if det["missing"] else "all details found",
               }
        row["after"] = _combine(row["ai"], det["ok"])
        row["after_reason"] = row["detail_reason"] if not det["ok"] else row["ai_reason"]
        if strict:
            st = check_claim_support_strict(p["claim"], p["quote"])
            row["strict"] = _combine(st["supports"], det["ok"])
            row["strict_reason"] = st.get("reason", "")
        rows.append(row)

    ai_ran = any(r["ai"] != "unchecked" for r in rows)
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    common = {
        "generated_at": now,
        "llm_provider": provider,
        "ai_check_ran": ai_ran,
        "labels_file": "support_eval.json",
        "rule": "A bad claim is caught when the verdict is 'no' or 'partly'. 'unchecked' = the AI check did not run.",
    }
    if not ai_ran:
        common["note"] = ("The AI support check did not run: no API key was available and no saved answer exists for "
                          "these pairs, so every AI verdict is 'unchecked'. In the app an unchecked claim is never "
                          "shown as Verified (fail closed). The live AI numbers still need a run with a key.")

    before = {**common, "system": "AI support check (existing prompt, unchanged)", **_score(rows, "ai")}
    after = {**common,
             "system": "AI support check + deterministic detail check (numbers, dates, names)",
             **_score(rows, "after"),
             "detail_check_alone": _score(rows, "detail"),
             "effect_on_sample_claims": sample_effect,
             "rows": [{k: r[k] for k in ("id", "category", "expected", "ai", "detail", "after", "detail_reason")} for r in rows]}
    TRUST.mkdir(parents=True, exist_ok=True)
    (TRUST / "support_eval_before.json").write_text(json.dumps(before, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (TRUST / "support_eval_after.json").write_text(json.dumps(after, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    if strict:
        st = {**common, "system": "Stricter AI prompt + detail check", **_score(rows, "strict")}
        (TRUST / "support_eval_strict.json").write_text(json.dumps(st, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    def line(name, s):
        cr = "n/a" if s["catch_rate"] is None else f"{s['catch_rate']:.0%}"
        fr = "n/a" if s["false_reject_rate"] is None else f"{s['false_reject_rate']:.0%}"
        return f"  {name:<34} caught {s['caught']}/{s['bad_pairs']} ({cr}), false rejects {s['falsely_rejected']}/{s['correct_pairs']} ({fr}), AI not run {s['ai_check_not_run']}"

    print(f"Support-check evaluation, {len(rows)} pairs, LLM_PROVIDER={provider}")
    print(line("before: AI check", before))
    print(line("detail check alone", after["detail_check_alone"]))
    print(line("after: AI check + detail check", after))
    print(f"  sample pipeline: {sample_effect}")
    if not ai_ran:
        print("  NOTE: the AI check did not run (no key). Live AI numbers still need a run with a key.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
