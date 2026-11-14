"""
LLM abstraction layer with swappable providers, daily call limiting,
caching, retries, and JSON output parsing.

Supported providers:
  - gemini (default)
  - anthropic
  - openai
  - none (offline mode: reads from backend/data/cache/<hash>.json)

Cache-key stability guarantee
------------------------------
The cache key must be identical whether the app runs locally or in a Docker
container that starts with a fresh database (and therefore different SQLite
auto-increment IDs).  To achieve this:

  1. CRLF → LF normalisation on both system and user prompts.
  2. ``[Chunk ID: <digits>]`` tokens are replaced with ``[Para <digits>]``
     (the caller in verify.py now uses sequential 0-based paragraph indices,
     not database row IDs).
  3. In ``none`` mode the model name is *not* part of the key so a different
     ``LLM_MODEL`` env var on Render does not cause cache misses.
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import time
from datetime import date, datetime
from pathlib import Path
from typing import Any, Callable, Optional

import httpx
from dotenv import load_dotenv
from sqlmodel import Session, select

from app.db import engine
from app.models import LLMCallRecord

# Load environment
load_dotenv()

CACHE_DIR = Path(__file__).parent.parent / "data" / "cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

logger = logging.getLogger(__name__)

# Fake provider hook for unit tests
_fake_provider: Optional[Callable[[str, str, Optional[dict]], dict]] = None


def set_fake_provider(fn: Optional[Callable[[str, str, Optional[dict]], dict]]) -> None:
    """Set or clear a mock provider function for testing."""
    global _fake_provider
    _fake_provider = fn


def _normalize_prompt(text: str) -> str:
    """Normalise line endings and strip trailing whitespace so the key is
    stable across Windows (CRLF) and Linux (LF) environments."""
    return re.sub(r"\r\n|\r", "\n", text).strip()


def get_cache_key(model: str, system: str, user: str, *, offline: bool = False) -> str:
    """Return a stable SHA-256 cache key.

    When *offline* is True (LLM_PROVIDER=none) the model name is excluded so
    that different ``LLM_MODEL`` values on Render produce the same key.

    Both prompts are CRLF-normalised before hashing.
    """
    s = _normalize_prompt(system)
    u = _normalize_prompt(user)
    if offline:
        payload = f"{s}|{u}".encode("utf-8")
    else:
        payload = f"{model}|{s}|{u}".encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def _offline_cache_key(system: str, user: str) -> str:
    """Model-agnostic key — used both when writing (live call) and reading (none mode).

    Writing a second file with this key after every live call ensures the cache
    is readable in production even when LLM_MODEL differs from the local value.
    """
    s = _normalize_prompt(system)
    u = _normalize_prompt(user)
    payload = f"{s}|{u}".encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def _get_daily_call_count(session: Session, today_str: str) -> int:
    stmt = select(LLMCallRecord).where(LLMCallRecord.date_str == today_str)
    return len(session.exec(stmt).all())


def _record_call(model: str) -> None:
    today_str = date.today().isoformat()
    with Session(engine) as session:
        rec = LLMCallRecord(date_str=today_str, model=model)
        session.add(rec)
        session.commit()


def _clean_json_text(text: str) -> str:
    """Strip markdown code fence wrappers from LLM response text."""
    s = text.strip()
    if s.startswith("```"):
        # Match ```json ... ``` or ``` ... ```
        m = re.match(r"^```(?:json)?\s*([\s\S]*?)\s*```$", s)
        if m:
            s = m.group(1).strip()
    return s


def complete_json(
    system: str,
    user: str,
    schema: Optional[dict] = None,
    timeout_secs: float = 30.0,
) -> dict:
    """
    Send prompt to configured LLM and return parsed JSON dict.
    In 'none' mode, reads exclusively from disk cache.
    Caches every successful real response to backend/data/cache/<hash>.json.

    Cache-key stability: prompts are CRLF-normalised; in none mode the model
    name is excluded so differing LLM_MODEL values on Render don't cause misses.
    """
    # 0. Test mock override
    if _fake_provider is not None:
        return _fake_provider(system, user, schema)

    provider = os.getenv("LLM_PROVIDER", "none").lower()
    model = os.getenv("LLM_MODEL", "gemini-3.5-flash-lite")
    api_key = os.getenv("LLM_API_KEY", "")
    daily_limit = int(os.getenv("LLM_DAILY_CALL_LIMIT", "50"))

    # Offline key: model-agnostic + CRLF-normalised (stable across environments)
    offline_key = _offline_cache_key(system, user)
    offline_file = CACHE_DIR / f"{offline_key}.json"

    # Live key: includes model (for backward compat with existing cache files)
    live_key = get_cache_key(model, system, user, offline=False)
    live_file = CACHE_DIR / f"{live_key}.json"

    # 1. Offline "none" mode — try offline key first, then live key as fallback
    if provider == "none":
        if offline_file.exists():
            logger.debug("cache HIT (offline-key) key=%s", offline_key[:16])
            return json.loads(offline_file.read_text(encoding="utf-8"))
        if live_file.exists():
            logger.debug("cache HIT (live-key fallback) key=%s", live_key[:16])
            return json.loads(live_file.read_text(encoding="utf-8"))
        logger.warning(
            "cache MISS offline_key=%s live_key=%s  prompt_prefix=%.120s",
            offline_key[:16], live_key[:16], user[:120],
        )
        raise RuntimeError(
            f"LLM_PROVIDER=none and cache missing for key {offline_key}. "
            "Run with a live provider first to populate the cache."
        )

    # 2. Daily call limit check
    today_str = date.today().isoformat()
    with Session(engine) as session:
        current_calls = _get_daily_call_count(session, today_str)

    if current_calls >= daily_limit:
        for f in (offline_file, live_file):
            if f.exists():
                return json.loads(f.read_text(encoding="utf-8"))
        raise RuntimeError(
            f"Daily LLM call limit ({daily_limit}) reached for {today_str}. "
            f"No cache entry found for key {offline_key}."
        )

    # 3. If already cached, return immediately
    for f in (offline_file, live_file):
        if f.exists():
            try:
                return json.loads(f.read_text(encoding="utf-8"))
            except Exception:
                pass

    # 4. Execute with retries (max 2 retries = 3 attempts total)
    max_retries = 2
    last_err: Optional[Exception] = None

    for attempt in range(max_retries + 1):
        try:
            raw_text = _dispatch_call(provider, model, api_key, system, user, schema, timeout_secs)
            cleaned = _clean_json_text(raw_text)
            parsed = json.loads(cleaned)

            # Record call & save BOTH keys so production (none mode) can find it
            _record_call(model)
            json_text = json.dumps(parsed, indent=2)
            offline_file.write_text(json_text, encoding="utf-8")
            live_file.write_text(json_text, encoding="utf-8")
            return parsed

        except (httpx.TimeoutException, httpx.HTTPStatusError, json.JSONDecodeError, KeyError) as e:
            last_err = e
            if attempt < max_retries:
                time.sleep(1.5 * (attempt + 1))
                continue

    raise RuntimeError(
        f"LLM call failed after {max_retries + 1} attempts ({provider}/{model}): {last_err}"
    )


def _dispatch_call(
    provider: str,
    model: str,
    api_key: str,
    system: str,
    user: str,
    schema: Optional[dict],
    timeout_secs: float,
) -> str:
    """Dispatch HTTP request to the selected provider."""
    if provider == "gemini":
        return _call_gemini_api(model, api_key, system, user, timeout_secs)
    if provider == "anthropic":
        return _call_anthropic_api(model, api_key, system, user, timeout_secs)
    if provider == "openai":
        return _call_openai_api(model, api_key, system, user, timeout_secs)
    raise ValueError(f"Unsupported LLM_PROVIDER: {provider}")


def _call_gemini_api(
    model: str,
    api_key: str,
    system: str,
    user: str,
    timeout_secs: float,
) -> str:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    payload: dict[str, Any] = {
        "contents": [{"parts": [{"text": user}]}],
        "generationConfig": {"responseMimeType": "application/json"},
    }
    if system:
        payload["system_instruction"] = {"parts": [{"text": system}]}

    resp = httpx.post(url, json=payload, timeout=timeout_secs)
    resp.raise_for_status()
    data = resp.json()
    candidates = data.get("candidates", [])
    if not candidates:
        raise RuntimeError(f"Gemini returned no candidates: {data}")
    return candidates[0]["content"]["parts"][0]["text"]


def _call_anthropic_api(
    model: str,
    api_key: str,
    system: str,
    user: str,
    timeout_secs: float,
) -> str:
    url = "https://api.anthropic.com/v1/messages"
    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "max_tokens": 4096,
        "system": system,
        "messages": [{"role": "user", "content": f"Respond in JSON.\n\n{user}"}],
    }
    resp = httpx.post(url, headers=headers, json=payload, timeout=timeout_secs)
    resp.raise_for_status()
    data = resp.json()
    return data["content"][0]["text"]


def _call_openai_api(
    model: str,
    api_key: str,
    system: str,
    user: str,
    timeout_secs: float,
) -> str:
    url = "https://api.openai.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    }
    resp = httpx.post(url, headers=headers, json=payload, timeout=timeout_secs)
    resp.raise_for_status()
    data = resp.json()
    return data["choices"][0]["message"]["content"]
