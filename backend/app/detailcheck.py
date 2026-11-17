"""
Deterministic detail check (plain code, no AI).

Every number, date and capitalised name in a claim must appear in the quote
it cites or in that quote's chunk. If one does not, the claim states a detail
its evidence does not contain, so it must not be shown as Verified.

This catches invented details (a wrong date, an extra person, a changed
amount). It cannot judge meaning: a claim that reverses or overstates its
quote using the same words passes this check. That is the support check's job.
"""
from __future__ import annotations

import re
from typing import Any

_MONTHS = {
    "january": "jan", "february": "feb", "march": "mar", "april": "apr", "may": "may",
    "june": "jun", "july": "jul", "august": "aug", "september": "sep", "sept": "sep",
    "october": "oct", "november": "nov", "december": "dec",
    "jan": "jan", "feb": "feb", "mar": "mar", "apr": "apr", "jun": "jun", "jul": "jul",
    "aug": "aug", "sep": "sep", "oct": "oct", "nov": "nov", "dec": "dec",
}
_WEEKDAYS = {"monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"}

_NUMBER_WORDS = {
    "zero": "0", "one": "1", "two": "2", "three": "3", "four": "4", "five": "5", "six": "6",
    "seven": "7", "eight": "8", "nine": "9", "ten": "10", "eleven": "11", "twelve": "12",
}

# Ordinary words that are capitalised only because they start a sentence.
# A sentence-initial word NOT in this list is still checked (it may be a name).
_SENTENCE_STARTERS = {
    "a", "an", "the", "this", "that", "these", "those", "it", "its", "there", "they", "we",
    "he", "she", "i", "you", "our", "their", "if", "when", "after", "before", "until", "while",
    "only", "no", "nobody", "none", "nothing", "all", "every", "each", "some", "most", "any",
    "both", "either", "neither", "one", "two", "three", "also", "and", "but", "or", "so", "as",
    "because", "since", "once", "please", "still", "currently", "now", "then", "here", "who",
    "what", "which", "why", "how", "do", "does", "did", "is", "are", "was", "were", "has", "have",
    "had", "can", "could", "will", "would", "should", "must", "may", "might", "not", "never",
    "open", "question", "regarding", "per", "see", "for", "to", "in", "on", "at", "by", "of",
}

_TOKEN = re.compile(r"[A-Za-z][A-Za-z0-9'’\-]*|\d[\d,]*(?:\.\d+)?")


def _numbers_in(text: str) -> set[str]:
    nums = {n.replace(",", "").lstrip("0") or "0" for n in re.findall(r"\d[\d,]*(?:\.\d+)?", text)}
    for w, d in _NUMBER_WORDS.items():
        if re.search(rf"\b{w}\b", text, re.IGNORECASE):
            nums.add(d)
    return nums


def _months_in(text: str) -> set[str]:
    return {_MONTHS[w.lower()] for w in re.findall(r"[A-Za-z]+", text) if w.lower() in _MONTHS}


def _sentences(text: str) -> list[str]:
    return [s for s in re.split(r"(?<=[.!?;:])\s+|\n+", text) if s.strip()]


def extract_details(claim: str) -> list[dict[str, str]]:
    """Numbers, dates (month and weekday names) and capitalised names in a claim."""
    out: list[dict[str, str]] = []
    for sentence in _sentences(claim):
        for i, tok in enumerate(_TOKEN.findall(sentence)):
            if tok[0].isdigit():
                out.append({"kind": "number", "text": tok})
                continue
            low = tok.lower()
            if low in _NUMBER_WORDS and low != "one":
                out.append({"kind": "number", "text": tok})
                continue
            if not tok[0].isupper():
                continue
            if low in _MONTHS:
                if low == "may" and i == 0:
                    continue
                out.append({"kind": "date", "text": tok})
            elif low in _WEEKDAYS:
                out.append({"kind": "date", "text": tok})
            elif i == 0 and low in _SENTENCE_STARTERS:
                continue
            else:
                name = re.sub(r"['’]s$", "", tok)
                if name.lower() in _SENTENCE_STARTERS or len(name) < 2:
                    continue
                out.append({"kind": "name", "text": name})
    return out


def check_claim_details(claim: str, quote: str, chunk_text: str = "") -> dict[str, Any]:
    """
    Return {"ok": bool, "checked": [...], "missing": [...]}.
    ok is False when any number, date or capitalised name in the claim is in
    neither the quote nor its chunk.
    """
    context = f"{quote}\n{chunk_text}"
    ctx_low = context.lower()
    ctx_nums = _numbers_in(context)
    ctx_months = _months_in(context)
    checked = extract_details(claim)
    missing = []
    for d in checked:
        t = d["text"]
        if d["kind"] == "number":
            norm = _NUMBER_WORDS.get(t.lower()) or (t.replace(",", "").lstrip("0") or "0")
            found = norm in ctx_nums
        elif d["kind"] == "date" and t.lower() in _MONTHS:
            found = _MONTHS[t.lower()] in ctx_months
        else:
            found = re.search(rf"(?<![A-Za-z0-9]){re.escape(t.lower())}(?![A-Za-z0-9])", ctx_low) is not None
        if not found:
            missing.append(d)
    return {"ok": not missing, "checked": checked, "missing": missing}
