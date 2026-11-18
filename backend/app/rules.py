"""
Keyword-rule extraction (plain code, no AI).

When no language model is configured (LLM_PROVIDER=none), uploaded notes,
issues, chat and tasks still need to produce claims. This module reads each
sentence of a source and keeps the ones that match a small, published set of
keyword rules: blockers, decisions, warnings, dependencies, contacts, owners,
next steps and open questions.

Every claim it makes quotes its sentence word for word, so the quote check
passes by construction. That proves only that the record says it, not that it
is still true, so rule claims start as *Inferred* (or *Missing evidence* for
a decision with no stated reason) and wait for a person like any other claim.
"""
from __future__ import annotations

import json
import re
from typing import Iterable, Optional

from app.models import (
    Chunk,
    Claim,
    ClaimKind,
    ClaimStatus,
    ClaimType,
    ReviewState,
    Source,
    SourceKind,
)
from app.redact import redact

MIN_LEN = 18
MAX_LEN = 400
MAX_PER_SOURCE = 60
RULE_CONFIDENCE = 0.5

# Order matters: the first matching rule names the claim type.
RULES: list[tuple[ClaimType, re.Pattern]] = [
    (ClaimType.blocker, re.compile(r"\b(blocked|blocking|blocker|waiting (?:on|for)|stuck on|can(?:no|')t proceed|on hold)\b", re.I)),
    (ClaimType.decision, re.compile(r"\b(we decided|decided to|decided that|decision|we chose|chose to|went with|agreed to|agreed that|switched to|settled on|opted for)\b", re.I)),
    (ClaimType.risk, re.compile(r"\b(don'?t|do not|never|careful|warning|fragile|breaks|broke|hack(?:y)?|workaround|risk(?:y)?|flaky|deprecated|expires?|expiry|outage|single point)\b", re.I)),
    (ClaimType.dependency, re.compile(r"\b(depends on|dependency|relies on|requires|api key|credentials?|vendor|third[- ]party|licen[cs]e)\b", re.I)),
    (ClaimType.contact, re.compile(r"\b(contact|reach out to|point of contact|ask (?:[A-Z][a-z]+)|escalate to)\b")),
    (ClaimType.owner, re.compile(r"\b(owner|owns|owned by|maintained by|maintains|responsible for|in charge of)\b", re.I)),
    (ClaimType.next_action, re.compile(r"\b(todo|to-do|next step|need to|needs to|must|follow[- ]up|remember to|still have to|plan to)\b", re.I)),
]
_REASON_RE = re.compile(r"\b(because|since|so that|so we|to avoid|due to|as it|as the|reason|in order to|otherwise)\b", re.I)
_SKIP_LINE_RE = re.compile(r"^(Issue #\d+:|Status:|Labels:|Comment on Issue #\d+)", re.I)
_SPLIT_RE = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9\"'(\[])")
_BULLET_RE = re.compile(r"^\s*(?:[-*+•]|\d+[.)]|#+)\s+")
_CHAT_PREFIX_RE = re.compile(r"^\[[^\]]{1,60}\]:\s*")


def sentences(text: str) -> Iterable[str]:
    """Split a chunk into candidate sentences, keeping each one verbatim."""
    for line in text.splitlines():
        line = line.strip()
        if not line or _SKIP_LINE_RE.match(line):
            continue
        line = _CHAT_PREFIX_RE.sub("", _BULLET_RE.sub("", line))
        for part in _SPLIT_RE.split(line):
            part = part.strip()
            if MIN_LEN <= len(part) <= MAX_LEN:
                yield part


def classify(sentence: str) -> Optional[ClaimType]:
    if sentence.rstrip().endswith("?"):
        return ClaimType.open_question
    for ctype, rx in RULES:
        if rx.search(sentence):
            return ctype
    return None


def _task_sentences(text: str) -> Iterable[tuple[ClaimType, str]]:
    """Task rows read 'field: value | field: value'. A blocked row is a blocker."""
    fields = {}
    for part in text.split(" | "):
        k, _, v = part.partition(": ")
        fields[k.strip().lower()] = v.strip()
    status = fields.get("status", "").lower()
    title = fields.get("title") or fields.get("task") or fields.get("name") or ""
    if title and status in {"blocked", "on hold", "waiting"}:
        yield ClaimType.blocker, text


def extract_rule_claims(project_id: int, source: Source, chunks: list[Chunk],
                        known: Optional[set[tuple[int, str]]] = None) -> list[Claim]:
    """Return new (unsaved) rule claims for one source. `known` holds
    (source_id, quote) pairs that already have a claim, so re-running never
    duplicates a claim or drops a person's review."""
    known = known if known is not None else set()
    out: list[Claim] = []
    for ch in chunks:
        if source.kind == SourceKind.task:
            found = list(_task_sentences(ch.text))
        else:
            found = [(t, s) for s in sentences(ch.text) if (t := classify(s))]
        for ctype, sent in found:
            key = (source.id, sent.lower())
            if key in known:
                continue
            known.add(key)
            status = ClaimStatus.inferred
            text = redact(sent)
            if ctype == ClaimType.decision and not _REASON_RE.search(sent):
                status = ClaimStatus.missing
                ctype = ClaimType.open_question
                text = f"OPEN QUESTION: Regarding '{redact(sent).rstrip('.')}' — what was the reason? (Not stated in the records)"
            out.append(Claim(
                project_id=project_id,
                kind=ClaimKind.rule,
                type=ctype,
                text=text,
                evidence_json=json.dumps([{
                    "source_id": source.id,
                    "chunk_id": ch.id,
                    "quote": sent,
                    "line_start": ch.line_start,
                    "line_end": ch.line_end,
                }]),
                status=status,
                confidence=RULE_CONFIDENCE,
                access_level=source.access_level,
                review_state=ReviewState.pending,
            ))
            if len(out) >= MAX_PER_SOURCE:
                return out
    return out
