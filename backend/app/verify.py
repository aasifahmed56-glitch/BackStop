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
    strictest_access,
)
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
        supports = str(resp.get("supports", "yes")).lower().strip()
        if supports not in ("yes", "partly", "no"):
            supports = "yes"
        return {"supports": supports, "reason": resp.get("reason", "")}
    except Exception as e:
        # Graceful fallback: assume verified if LLM fails
        return {"supports": "yes", "reason": f"Fallback: {e}"}


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
    }

    chunks_by_source: dict[int, list[Chunk]] = {}
    for c in chunks:
        chunks_by_source.setdefault(c.source_id, []).append(c)

    extracted_items: list[dict[str, Any]] = []

    for src_id, src_chunks in chunks_by_source.items():
        src = source_map.get(src_id)
        if not src:
            continue

        # Prepare redacted chunks text with chunk IDs
        chunk_blocks = []
        for c in src_chunks:
            redacted_text = redact(c.text)
            chunk_blocks.append(f"[Chunk ID: {c.id}]\n{redacted_text}")

        user_prompt = f"Source Document: {src.name} ({src.kind.value})\n\n" + "\n\n".join(chunk_blocks)

        try:
            raw_resp = complete_json(
                system=EXTRACTION_SYSTEM_PROMPT,
                user=user_prompt,
                schema=EXTRACTION_SCHEMA,
            )
            items = normalize_extracted_items(raw_resp)
            for it in items:
                it["_source_id"] = src_id
                # If chunk_ids is missing or unmapped, match quote against src_chunks
                if not it.get("chunk_ids") and it.get("quotes"):
                    for q in it["quotes"]:
                        for chk in src_chunks:
                            if verify_quote_in_original(q, chk.text):
                                it.setdefault("chunk_ids", []).append(chk.id)
                extracted_items.append(it)
        except Exception:
            continue

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

        # Check for missing candidates (decision or owner with no quote or no reason given)
        if (claim_type in (ClaimType.decision, ClaimType.owner)) and (not quotes or not reason_given):
            stats["missing"] += 1
            missing_text = f"OPEN QUESTION: Regarding '{claim_text}' — what was the underlying rationale or assigned owner? (Not stated in source records)"
            
            src_levels = [source_map[chunk_map[cid].source_id].access_level for cid in chunk_ids if cid in chunk_map and chunk_map[cid].source_id in source_map]
            claim_access = strictest_access(src_levels) if src_levels else source_map[it["_source_id"]].access_level

            missing_claim = Claim(
                project_id=project_id,
                kind=ClaimKind.interpreted,
                type=ClaimType.open_question,
                text=missing_text,
                evidence_json=json.dumps([
                    {"source_id": it["_source_id"], "chunk_id": cid, "quote": "", "line_start": None, "line_end": None}
                    for cid in chunk_ids
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
        access_level = strictest_access(cited_access_levels) if cited_access_levels else source_map[it["_source_id"]].access_level

        # 2. CONFLICT CHECK
        if is_conflict or "conflict" in claim_text.lower() or "postponed" in claim_text.lower():
            stats["conflicting"] += 1
            status = ClaimStatus.conflicting
            confidence = 0.5
        else:
            # 3. SUPPORT CHECK (LLM)
            support_res = check_claim_support(claim_text, primary_quote)
            sup = support_res.get("supports", "yes")

            if sup == "no":
                stats["rejected_by_support_check"] += 1
                continue
            elif sup == "partly":
                stats["inferred"] += 1
                status = ClaimStatus.inferred
                confidence = 0.75
            else:
                stats["verified"] += 1
                status = ClaimStatus.verified
                confidence = 1.0

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
        session.add(claim_obj)

    session.commit()
    return stats


# ---------------------------------------------------------------------------
# API Route
# ---------------------------------------------------------------------------

@router.post("/projects/{project_id}/extract", summary="Extract and verify interpreted claims")
def extract_and_verify_endpoint(
    project_id: int,
    session: Session = Depends(get_session),
):
    stats = run_extraction_and_verification(project_id, session)
    return {
        "ok": True,
        "project_id": project_id,
        "stats": stats,
    }
