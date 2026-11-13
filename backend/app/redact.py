"""
Redaction: mask secrets and personal data BEFORE any LLM call.

Guarantees:
  - API keys / tokens → [REDACTED_SECRET]
  - Email addresses   → [REDACTED_EMAIL]
  - Phone numbers     → [REDACTED_PHONE]

The raw/original text is NEVER sent to an LLM; callers must call redact() first.
redact_with_counts() returns a count dict (never the values) suitable for the audit log.
"""
from __future__ import annotations

import re
from typing import NamedTuple

# ---------------------------------------------------------------------------
# Pattern table: (compiled_regex, replacement_tag, count_bucket)
# Apply most-specific first (sk_test_ before generic api_key=).
# ---------------------------------------------------------------------------

class _Rule(NamedTuple):
    pattern: re.Pattern
    replacement: str
    bucket: str          # "secret" | "email" | "phone"


_RULES: list[_Rule] = [
    # Stripe / generic test/live keys
    _Rule(re.compile(r'\bsk_(?:test|live)_[A-Za-z0-9_]{10,}\b'),
          "[REDACTED_SECRET]", "secret"),
    # Slack bot tokens
    _Rule(re.compile(r'\bxox[bpoas]-[A-Za-z0-9\-]{10,}\b'),
          "[REDACTED_SECRET]", "secret"),
    # GitHub PATs
    _Rule(re.compile(r'\bghp_[A-Za-z0-9]{36}\b'),
          "[REDACTED_SECRET]", "secret"),
    # AWS access key IDs
    _Rule(re.compile(r'\bAKIA[0-9A-Z]{16}\b'),
          "[REDACTED_SECRET]", "secret"),
    # Generic key=<long_value> patterns (belt-and-suspenders)
    _Rule(re.compile(
            r'(?i)\b(?:api[_\-]?key|secret|token|password)\s*[:=]\s*["\']?([A-Za-z0-9_\-]{16,})["\']?'),
          "[REDACTED_SECRET]", "secret"),
    # Email addresses
    _Rule(re.compile(r'[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}'),
          "[REDACTED_EMAIL]", "email"),
    # Indian mobile: +91 XXXXX XXXXX (space optional)
    _Rule(re.compile(r'\+91\s?\d{5}\s?\d{5}'),
          "[REDACTED_PHONE]", "phone"),
    # Generic international: +CC ... (10-15 digits, various separators)
    _Rule(re.compile(r'\+\d{1,3}[\s\-]?\(?\d{2,4}\)?[\s\-]?\d{3,5}[\s\-]?\d{4,6}'),
          "[REDACTED_PHONE]", "phone"),
]


def redact(text: str) -> str:
    """
    Return a copy of *text* with all secrets and personal data masked.
    Original text is NOT modified; this returns a new string.
    """
    for rule in _RULES:
        text = rule.pattern.sub(rule.replacement, text)
    return text


def redact_with_counts(text: str) -> tuple[str, dict[str, int]]:
    """
    Redact *text* and return ``(redacted_text, counts_by_type)``.
    ``counts_by_type`` has keys "secret", "email", "phone" with int counts.
    The actual values are never included — only the count is returned for auditing.
    """
    counts: dict[str, int] = {"secret": 0, "email": 0, "phone": 0}

    for rule in _RULES:
        # Use a closure to count replacements; re.sub calls the function per match.
        bucket = rule.bucket
        replacement = rule.replacement

        def _sub(m: re.Match, _b: str = bucket, _r: str = replacement) -> str:
            counts[_b] += 1
            return _r

        text = rule.pattern.sub(_sub, text)

    return text, counts


def redact_chunks(chunks: list[dict]) -> list[dict]:
    """
    Redact the 'text' field of each chunk dict (non-destructive copy).
    Used to sanitise chunk batches before passing to the LLM module.
    """
    return [{**c, "text": redact(c["text"])} for c in chunks]
