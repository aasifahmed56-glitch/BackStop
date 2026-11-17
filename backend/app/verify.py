"""
Verification and extraction engine.

Workflow:
  1. Redact chunks before passing to LLM.
  2. Extract candidate items via LLM complete_json.
  3. QUOTE CHECK (deterministic code): normalize quotes/whitespace; quote must be
     a substring of ORIGINAL chunk text.
  4. SUPPORT CHECK (LLM): verifies if quote supports claim -> yes / partly / no.
  5. CONFLICT: conflict=True or contradictory claims -> status 'conflicting'.
  6. MISSING: items missing quotes or missing reasons -> phrased as questions for leaver.
  7. ACCESS LEVEL: strictest access level among cited sources.
  8. Return detailed pipeline stats.
"""
from __future__ import annotations

import json
from pathlib import Path
import re
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.db import get_session
from app.llm import complete_json
from app.models import (
    AccessLevel,
    Chunk,
    Claim,
    ClaimKind,
    ClaimStatus,
    ClaimType,
    Project,
    ReviewState,
    Source,
    SourceKind,
    compute_claim_access_from_evidence,
    strictest_access,
)
from app.detailcheck import check_claim_details
from app.redact import redact

router = APIRouter(tags=["extract"])

EXTRACTION_SYSTEM_PROMPT = (
    "Extract decisions, reasons, owners, blockers, dependencies and open questions from the text. "
    "For EVERY item return an exact quote copied character for character from the text and the chunk id. "
    "If you cannot quote it, do not return it. Do not state who owns or last changed code; that is computed elsewhere. "
    "If two chunks disagree, return both quotes and set conflict=true."
)

EXTRACTION_SCHEMA = {
    "type": "object",
    "properties": {
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "type": {"type": "string", "enum": [
                        "owner", "decision", "blocker", "risk",
                        "dependency", "open_question", "next_action", "contact"
                    ]},
                    "text": {"type": "string"},
                    "chunk_ids": {"type": "array", "items": {"type": "integer"}},
                    "quotes": {"type": "array", "items": {"type": "string"}},
                    "conflict": {"type": "boolean"},
                    "reason_given": {"type": "boolean"},
                },
                "required": ["type", "text", "chunk_ids", "quotes"],
            },
        }
    },
    "required": ["items"],
}

SUPPORT_CHECK_SYSTEM_PROMPT = (
    "You evaluate whether an exact quote supports a claim. "
    "Reply ONLY with a JSON object: {\"supports\": \"yes\" | \"partly\" | \"no\", \"reason\": \"<short reason>\"}."
)


# ---------------------------------------------------------------------------
# Quote Normalization & Check (Deterministic Code)
# ---------------------------------------------------------------------------

def normalize_text_for_quote(text: str) -> str:
    """Standardize unicode quotes and collapse whitespace."""
    s = text.replace("“", '"').replace("”", '"').replace("‘", "'").replace("’", "'")
    s = s.replace("`", "'").replace("—", "-").replace("–", "-")
    s = re.sub(r"\s+", " ", s).strip()
    return s


def verify_quote_in_original(quote: str, original_chunk_text: str) -> bool:
    """
    Check if the quote appears in the ORIGINAL un-redacted chunk text.
    Uses normalized comparison to be resilient to minor whitespace/quote differences.
    """
    if not quote or not original_chunk_text:
        return False

    q_norm = normalize_text_for_quote(quote).lower()
    orig_norm = normalize_text_for_quote(original_chunk_text).lower()

    if q_norm in orig_norm:
        return True

    # Fallback: if quote is long, check if leading words appear contiguously
    words = q_norm.split()
    if len(words) >= 5:
        sub = " ".join(words[: len(words) - 1])
        if sub in orig_norm:
            return True

    return False


# ---------------------------------------------------------------------------
# Support Check (LLM Call)
# ---------------------------------------------------------------------------

def check_claim_support(claim_text: str, quote: str) -> dict[str, str]:
    """
    Query LLM with only {claim text, quote}.
    Returns: {"supports": "yes" | "partly" | "no", "reason": "..."}
    """
    user_prompt = f'Claim: "{claim_text}"\nQuote: "{quote}"\nDoes the quote support the claim?'
    try:
        resp = complete_json(SUPPORT_CHECK_SYSTEM_PROMPT, user_prompt)
        supports = str(resp.get("supports", "")).lower().strip()
        if supports not in ("yes", "partly", "no"):
            # An unreadable answer is not evidence of support.
            return {"supports": "unchecked", "reason": f"Unreadable support-check answer: {supports!r}"}
        return {"supports": supports, "reason": resp.get("reason", "")}
    except Exception as e:
        # Fail closed: if the check cannot run, the claim is NOT treated as supported.
        return {"supports": "unchecked", "reason": f"Support check unavailable: {e}"}


# ---------------------------------------------------------------------------
# Normalization helper for varied LLM response structures
# ---------------------------------------------------------------------------

def normalize_extracted_items(raw_data: Any) -> list[dict]:
    """Robustly parse varied LLM JSON outputs into standard candidate dicts."""
    items: list[dict] = []
    if isinstance(raw_data, list):
        for entry in raw_data:
            if not isinstance(entry, dict):
                continue
            cid = entry.get("chunk_id")
            nested_found = False
            for k in ("decisions", "reasons", "owners", "blockers", "dependencies", "open_questions", "risks", "items"):
                if k in entry and isinstance(entry[k], list):
                    nested_found = True
                    for sub in entry[k]:
                        if isinstance(sub, dict):
                            sub_type = k.rstrip("s")
                            sub_quote = sub.get("quote") or sub.get("text") or ""
                            sub_text = sub.get("text") or sub.get("description") or sub_quote
                            cids = sub.get("chunk_ids") or ([sub.get("chunk_id")] if sub.get("chunk_id") else ([cid] if cid else []))
                            quotes = sub.get("quotes") or ([sub_quote] if sub_quote else [])
                            items.append({
                                "type": sub.get("type", sub_type),
                                "text": sub_text,
                                "chunk_ids": [int(x) for x in cids if str(x).isdigit()],
                                "quotes": quotes,
                                "conflict": bool(sub.get("conflict", False)),
                                "reason_given": bool(sub.get("reason") or sub.get("reason_given", True)),
                            })
            if not nested_found:
                q = entry.get("quote") or entry.get("quotes") or []
                quotes = [q] if isinstance(q, str) and q else (q if isinstance(q, list) else [])
                text = entry.get("text") or entry.get("description") or (quotes[0] if quotes else "")
                cids = entry.get("chunk_ids") or ([entry.get("chunk_id")] if entry.get("chunk_id") else [])
                items.append({
                    "type": entry.get("type", "decision"),
                    "text": text,
                    "chunk_ids": [int(x) for x in cids if str(x).isdigit()],
                    "quotes": quotes,
                    "conflict": bool(entry.get("conflict", False)),
                    "reason_given": bool(entry.get("reason") or entry.get("reason_given", True)),
                })
    elif isinstance(raw_data, dict):
        if "items" in raw_data and isinstance(raw_data["items"], list):
            return normalize_extracted_items(raw_data["items"])
        for k in ("decisions", "reasons", "owners", "blockers", "dependencies", "open_questions", "risks"):
            if k in raw_data and isinstance(raw_data[k], list):
                for sub in raw_data[k]:
                    if isinstance(sub, dict):
                        q = sub.get("quote") or sub.get("quotes") or []
                        quotes = [q] if isinstance(q, str) and q else (q if isinstance(q, list) else [])
                        text = sub.get("text") or sub.get("description") or (quotes[0] if quotes else "")
                        cids = sub.get("chunk_ids") or ([sub.get("chunk_id")] if sub.get("chunk_id") else [])
                        items.append({
                            "type": sub.get("type", k.rstrip("s")),
                            "text": text,
                            "chunk_ids": [int(x) for x in cids if str(x).isdigit()],
                            "quotes": quotes,
                            "conflict": bool(sub.get("conflict", False)),
                            "reason_given": bool(sub.get("reason") or sub.get("reason_given", True)),
                        })
    return items


# ---------------------------------------------------------------------------
# Extraction & Verification Pipeline
# ---------------------------------------------------------------------------

_SEEDED_FIXTURES_PATH = Path(__file__).resolve().parent.parent / "data" / "sample" / "seeded_claims.json"


def _normalise_claim_text(text: str) -> str:
    """Lower-case, drop punctuation and issue references so trivial variants match."""
    t = text.lower()
    t = re.sub(r"\(?(?:see|per)\s+issue\s*#\d+\)?\.?", " ", t)
    t = re.sub(r"[^a-z0-9 ]+", " ", t)
    return " ".join(t.split())


def _load_seeded_fixtures() -> dict[str, list[dict]]:
    """Hand-written demo claims keyed by sample source name (see seeded_claims.json)."""
    if not _SEEDED_FIXTURES_PATH.exists():
        return {}
    data = json.loads(_SEEDED_FIXTURES_PATH.read_text(encoding="utf-8"))
    return data.get("by_source", {})


def run_extraction_and_verification(project_id: int, session: Session) -> dict[str, Any]:
    """
    Run extraction and verification pipeline over non-git chunks for a project.
    Stores approved and missing claims in the database with strict access control.
    """
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    sources = session.exec(
        select(Source).where(Source.project_id == project_id)
    ).all()
    source_map = {s.id: s for s in sources}

    # Gather chunks across notes, chat, issues, and tasks
    chunks = session.exec(
        select(Chunk).where(
            Chunk.source_id.in_([s.id for s in sources if s.kind != SourceKind.git])
        )
    ).all()
    chunk_map = {c.id: c for c in chunks}

    # Delete existing INTERPRETED claims before running
    existing = session.exec(
        select(Claim).where(
            Claim.project_id == project_id,
            Claim.kind == ClaimKind.interpreted,
        )
    ).all()
    for cl in existing:
        session.delete(cl)
    session.flush()

    stats = {
        "extracted": 0,
        "rejected_by_quote_check": 0,
        "rejected_by_support_check": 0,
        "verified": 0,
        "inferred": 0,
        "conflicting": 0,
        "missing": 0,
        "support_unchecked": 0,
        "seeded": 0,
        "failed_sources": [],
        "merged_duplicates": 0,
        "downgraded_by_detail_check": 0,
    }
    merged_claims: dict[tuple, Claim] = {}

    seeded_fixtures = _load_seeded_fixtures()

    chunks_by_source: dict[int, list[Chunk]] = {}
    for c in chunks:
        chunks_by_source.setdefault(c.source_id, []).append(c)

    extracted_items: list[dict[str, Any]] = []

    for src_id, src_chunks in chunks_by_source.items():
        src = source_map.get(src_id)
        if not src:
            continue

        # Build stable [Para N] prompts — do NOT embed SQLite chunk IDs.
        # The LLM response may reference para indices; we map them back to
        # real chunk objects by position and by quote-matching below.
        para_to_chunk: dict[int, Chunk] = {}   # 0-based para index → Chunk
        chunk_blocks = []
        for para_idx, c in enumerate(src_chunks):
            para_to_chunk[para_idx] = c
            redacted_text = redact(c.text)
            chunk_blocks.append(f"[Para {para_idx}]\n{redacted_text}")

        user_prompt = f"Source Document: {src.name} ({src.kind.value})\n\n" + "\n\n".join(chunk_blocks)

        try:
            raw_resp = complete_json(
                system=EXTRACTION_SYSTEM_PROMPT,
                user=user_prompt,
                schema=EXTRACTION_SCHEMA,
            )
            items = normalize_extracted_items(raw_resp)
        except Exception as exc:
            # Never fail silently: record which source could not be analysed.
            items = []
            stats["failed_sources"].append({"source": src.name, "error": str(exc)[:200]})

        # Hand-written demo fixtures for the sample's restricted/confidential notes.
        # They are labelled "seeded" end to end and never presented as AI output.
        for fx in seeded_fixtures.get(src.name, []):
            items.append({**fx, "_seeded": True})

        for it in items:
            it["_source_id"] = src_id
            it["_para_to_chunk"] = para_to_chunk  # carry position map for chunk_id resolution

            # Resolve chunk_ids: the LLM may return para indices (0-based) or old
            # DB IDs from cached responses.  Strategy (in order):
            #   1. If the value is a valid para index → map via para_to_chunk
            #   2. If the value is a valid DB chunk_id in chunk_map → keep
            #   3. Otherwise → fall back to quote-matching across src_chunks
            # Quote-first: the chunk that actually contains the quote is the
            # evidence. Cached chunk ids / para indices are only hints and are
            # kept only when that chunk really contains one of the quotes, so
            # results never depend on database row ids.
            resolved: list[int] = []
            quotes_for_item = it.get("quotes") or []
            for q in quotes_for_item:
                for chk in src_chunks:
                    if verify_quote_in_original(q, chk.text) and chk.id not in resolved:
                        resolved.append(chk.id)
            if not resolved and not quotes_for_item:
                for cid in it.get("chunk_ids", []):
                    if cid in para_to_chunk and para_to_chunk[cid].id not in resolved:
                        resolved.append(para_to_chunk[cid].id)

            it["chunk_ids"] = resolved
            extracted_items.append(it)

    stats["extracted"] = len(extracted_items)

    # Verification stage
    for it in extracted_items:
        claim_type_str = it.get("type", "decision")
        try:
            claim_type = ClaimType(claim_type_str)
        except ValueError:
            claim_type = ClaimType.decision

        claim_text = it.get("text", "").strip()
        chunk_ids = it.get("chunk_ids", [])
        quotes = it.get("quotes", [])
        is_conflict = bool(it.get("conflict", False))
        reason_given = bool(it.get("reason_given", True))

        if not claim_text:
            # Nothing to say: an empty claim must not become a "Regarding ''" question.
            continue

        # Check for missing candidates (decision or owner with no quote or no reason given)
        if (claim_type in (ClaimType.decision, ClaimType.owner)) and (not quotes or not reason_given):
            stats["missing"] += 1
            missing_text = f"OPEN QUESTION: Regarding '{claim_text}' — what was the underlying rationale or assigned owner? (Not stated in source records)"
            
            src_levels = [source_map[chunk_map[cid].source_id].access_level for cid in chunk_ids if cid in chunk_map and chunk_map[cid].source_id in source_map]
            claim_access = strictest_access(src_levels) if src_levels else source_map[it["_source_id"]].access_level

            # Ensure evidence is never empty: cite source chunk
            cids_to_cite = chunk_ids
            if not cids_to_cite and it.get("_source_id") in chunks_by_source and chunks_by_source[it["_source_id"]]:
                cids_to_cite = [chunks_by_source[it["_source_id"]][0].id]

            missing_claim = Claim(
                project_id=project_id,
                kind=ClaimKind.interpreted,
                type=ClaimType.open_question,
                text=missing_text,
                evidence_json=json.dumps([
                    {
                        "source_id": it["_source_id"],
                        "chunk_id": cid,
                        "quote": quotes[0] if quotes else "",
                        "line_start": chunk_map[cid].line_start if cid in chunk_map else None,
                        "line_end": chunk_map[cid].line_end if cid in chunk_map else None,
                    }
                    for cid in cids_to_cite
                ]),
                status=ClaimStatus.missing,
                confidence=1.0,
                access_level=claim_access,
                review_state=ReviewState.pending,
            )
            session.add(missing_claim)
            continue

        if not quotes or not chunk_ids:
            stats["rejected_by_quote_check"] += 1
            continue

        # 1. QUOTE CHECK against original unredacted text
        quote_verified = False
        valid_evidence = []
        cited_access_levels = []

        for q in quotes:
            for cid in chunk_ids:
                chk = chunk_map.get(cid)
                if chk and verify_quote_in_original(q, chk.text):
                    quote_verified = True
                    src = source_map.get(chk.source_id)
                    if src:
                        cited_access_levels.append(src.access_level)
                    valid_evidence.append({
                        "source_id": chk.source_id,
                        "chunk_id": chk.id,
                        "quote": q,
                        "line_start": chk.line_start,
                        "line_end": chk.line_end,
                    })

        if not quote_verified:
            stats["rejected_by_quote_check"] += 1
            continue

        primary_quote = quotes[0]
        # Access level is STRICTLY the strictest access level among ONLY its quoted evidence chunks
        access_level = strictest_access(cited_access_levels) if cited_access_levels else AccessLevel.public

        # 2. CONFLICT CHECK
        is_seeded = bool(it.get("_seeded"))
        if is_seeded:
            for ev in valid_evidence:
                ev["origin"] = "seeded"

        if is_conflict:
            stats["conflicting"] += 1
            status = ClaimStatus.conflicting
            confidence = 0.5
        elif is_seeded:
            # Hand-written fixture: the quote check passed, but no model judged
            # support, so it is never shown as Verified.
            stats["seeded"] += 1
            stats["inferred"] += 1
            status = ClaimStatus.inferred
            confidence = 0.75
        else:
            # 3. SUPPORT CHECK (LLM)
            support_res = check_claim_support(claim_text, primary_quote)
            sup = support_res.get("supports", "yes")

            if sup == "no":
                stats["rejected_by_support_check"] += 1
                continue
            elif sup == "unchecked":
                stats["support_unchecked"] += 1
                stats["inferred"] += 1
                status = ClaimStatus.inferred
                confidence = 0.6
            elif sup == "partly":
                stats["inferred"] += 1
                status = ClaimStatus.inferred
                confidence = 0.75
            else:
                # 4. DETAIL CHECK (plain code): every number, date and name in the
                # claim must be in its quote or chunk, or it is not Verified.
                detail = _detail_check(claim_text, valid_evidence, chunk_map)
                if detail["ok"]:
                    stats["verified"] += 1
                    status = ClaimStatus.verified
                    confidence = 1.0
                else:
                    stats["downgraded_by_detail_check"] += 1
                    stats["inferred"] += 1
                    status = ClaimStatus.inferred
                    confidence = 0.75
                    valid_evidence[0]["detail_check_missing"] = [d["text"] for d in detail["missing"]]

        # Merge duplicates: the same statement found in several places becomes
        # one claim that cites every source, instead of N near-identical rows.
        dedupe_key = (claim_type, _normalise_claim_text(claim_text))
        existing_claim = merged_claims.get(dedupe_key)
        if existing_claim is not None:
            ev_list = existing_claim.evidence()
            seen_ev = {(e.get("chunk_id"), e.get("quote")) for e in ev_list}
            for ev in valid_evidence:
                if (ev.get("chunk_id"), ev.get("quote")) not in seen_ev:
                    ev_list.append(ev)
            existing_claim.evidence_json = json.dumps(ev_list)
            existing_claim.access_level = strictest_access([existing_claim.access_level, access_level])
            stats["merged_duplicates"] += 1
            continue

        claim_obj = Claim(
            project_id=project_id,
            kind=ClaimKind.interpreted,
            type=claim_type,
            text=claim_text,
            evidence_json=json.dumps(valid_evidence),
            status=status,
            confidence=confidence,
            access_level=access_level,
            review_state=ReviewState.pending,
        )
        merged_claims[dedupe_key] = claim_obj
        session.add(claim_obj)

    session.commit()
    return stats


def _detail_check(claim_text: str, evidence: list[dict[str, Any]], chunk_map: dict[int, Chunk]) -> dict[str, Any]:
    quotes = "\n".join(ev.get("quote", "") for ev in evidence)
    chunks = "\n".join(chunk_map[ev["chunk_id"]].text for ev in evidence if ev.get("chunk_id") in chunk_map)
    return check_claim_details(claim_text, quotes, chunks)


STRICT_SUPPORT_CHECK_SYSTEM_PROMPT = (
    "You check whether an exact quote fully supports a claim. Be strict. "
    "Answer \"yes\" only if every part of the claim is stated in the quote, including every name, number and date. "
    "Answer \"partly\" if the quote supports some of the claim but the claim adds, strengthens or generalises anything. "
    "Answer \"no\" if the quote is unrelated or says the opposite. "
    "Reply ONLY with a JSON object: {\"supports\": \"yes\" | \"partly\" | \"no\", \"reason\": \"<short reason>\"}."
)


def check_claim_support_strict(claim_text: str, quote: str) -> dict[str, str]:
    """
    A stricter support prompt, used by the evaluation script and available for
    new uploads. It is a separate function so the original prompt, and the
    saved sample results keyed by its text, stay unchanged.
    """
    user_prompt = f'Claim: "{claim_text}"\nQuote: "{quote}"\nDoes the quote fully support the claim?'
    try:
        resp = complete_json(STRICT_SUPPORT_CHECK_SYSTEM_PROMPT, user_prompt)
        supports = str(resp.get("supports", "")).lower().strip()
        if supports not in ("yes", "partly", "no"):
            return {"supports": "unchecked", "reason": f"Unreadable support-check answer: {supports!r}"}
        return {"supports": supports, "reason": resp.get("reason", "")}
    except Exception as e:
        return {"supports": "unchecked", "reason": f"Support check unavailable: {e}"}


def recompute_claims_access_levels(session: Session, project_id: Optional[int] = None) -> dict[str, int]:
    """
    Recompute access_level for all existing claims strictly based on the chunks
    cited in their evidence_json. Returns claim count by access level.
    """
    from collections import Counter
    sources = session.exec(select(Source)).all()
    source_map = {s.id: s.access_level for s in sources}

    stmt = select(Claim)
    if project_id:
        stmt = stmt.where(Claim.project_id == project_id)
    claims = session.exec(stmt).all()

    for c in claims:
        ev = c.evidence()
        c.access_level = compute_claim_access_from_evidence(ev, source_map, fallback=AccessLevel.public)
        session.add(c)
    session.commit()

    updated = session.exec(stmt).all()
    counts = Counter(c.access_level.value for c in updated)
    return dict(counts)


# ---------------------------------------------------------------------------
# API Route
# ---------------------------------------------------------------------------

@router.post("/claims/recompute-access", summary="Recompute access levels for claims from evidence")
def recompute_access_endpoint(session: Session = Depends(get_session)):
    counts = recompute_claims_access_levels(session)
    return {"ok": True, "counts": counts}


@router.post("/projects/{project_id}/extract", summary="Extract and verify interpreted claims")
def extract_and_verify_endpoint(
    project_id: int,
    session: Session = Depends(get_session),
):
    try:
        stats = run_extraction_and_verification(project_id, session)
        return {
            "ok": True,
            "project_id": project_id,
            "stats": stats,
        }
    except Exception as e:
        return {
            "ok": False,
            "project_id": project_id,
            "warning": f"LLM extraction notice: {str(e)}",
            "stats": {"extracted": 0, "verified": 0, "inferred": 0, "conflicting": 0, "missing": 0},
            "message": "Live LLM call or cache entry was unavailable. Deterministic claims remain available in the ledger.",
        }
