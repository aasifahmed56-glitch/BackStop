"""
Unit tests for cache key stability, offline LLM reading, and idempotency of sample project loading.
"""
import os
import pytest
from app.llm import get_cache_key, _offline_cache_key, complete_json
from app.models import Project, Claim, ClaimKind, AccessLevel
from sqlmodel import Session, SQLModel, create_engine, select
from sqlmodel.pool import StaticPool
from datetime import date
from pathlib import Path


def test_cache_key_crlf_lf_stability():
    """CRLF and LF prompt strings must produce identical SHA-256 cache keys."""
    sys_lf = "System instruction.\nSecond line.\n"
    sys_crlf = "System instruction.\r\nSecond line.\r\n"

    user_lf = "User prompt line 1.\nUser prompt line 2.\n"
    user_crlf = "User prompt line 1.\r\nUser prompt line 2.\r\n"

    key_lf = get_cache_key("model-a", sys_lf, user_lf)
    key_crlf = get_cache_key("model-a", sys_crlf, user_crlf)

    assert key_lf == key_crlf, "Cache keys must match regardless of CRLF or LF line endings"


def test_cache_key_model_agnostic_in_offline_mode():
    """In offline mode (offline=True / _offline_cache_key), key does not depend on model name."""
    sys_prompt = "Extract items."
    user_prompt = "Document content."

    key_model1 = get_cache_key("gemini-3.5-flash-lite", sys_prompt, user_prompt, offline=True)
    key_model2 = get_cache_key("totally-different-model", sys_prompt, user_prompt, offline=True)
    off_key = _offline_cache_key(sys_prompt, user_prompt)

    assert key_model1 == key_model2 == off_key, "Offline cache key must be independent of LLM_MODEL"


def test_offline_complete_json_reads_cache(monkeypatch):
    """When LLM_PROVIDER=none and LLM_MODEL is arbitrary, complete_json reads from disk cache."""
    monkeypatch.setenv("LLM_PROVIDER", "none")
    monkeypatch.setenv("LLM_MODEL", "arbitrary-render-model-name")

    from app.verify import EXTRACTION_SYSTEM_PROMPT
    from app.redact import redact

    # Test reading notes/advisor-private.md cached extraction
    sample_dir = Path(__file__).parent.parent / "data" / "sample"
    note_path = sample_dir / "notes" / "advisor-private.md"
    assert note_path.exists()

    raw = note_path.read_text(encoding="utf-8")
    paras = [p for p in raw.split("\n\n") if p.strip()]
    blocks = [f"[Para {i}]\n{redact(p)}" for i, p in enumerate(paras)]
    user_prompt = f"Source Document: notes/advisor-private.md (note)\n\n" + "\n\n".join(blocks)

    resp = complete_json(system=EXTRACTION_SYSTEM_PROMPT, user=user_prompt)
    assert isinstance(resp, (dict, list)), "complete_json must successfully return cached JSON"


def test_sample_load_and_reset_idempotent():
    """Repeated calls to load_sample / reset_sample_project must not accumulate duplicate claims."""
    test_engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(test_engine)

    from app.ingest import _ingest_all, _load_manifest
    from app.derived import derive_claims
    from app.verify import run_extraction_and_verification

    sample_dir = Path(__file__).parent.parent / "data" / "sample"
    manifest = _load_manifest(sample_dir)

    with Session(test_engine) as session:
        # Load 1
        proj = Project(id=1, name="Campus Event App", departure_date=date(2026, 3, 15), leaver_name="Riya")
        session.add(proj)
        session.commit()

        _ingest_all(session, proj, sample_dir, manifest)
        session.commit()
        derive_claims(1, session)
        run_extraction_and_verification(1, session)

        claims_1 = session.exec(select(Claim).where(Claim.project_id == 1)).all()
        derived_count_1 = sum(1 for c in claims_1 if c.kind == ClaimKind.derived)
        interp_count_1 = sum(1 for c in claims_1 if c.kind == ClaimKind.interpreted)

        # Re-derive and re-extract (simulating re-load / reset)
        derive_claims(1, session)
        run_extraction_and_verification(1, session)

        claims_2 = session.exec(select(Claim).where(Claim.project_id == 1)).all()
        derived_count_2 = sum(1 for c in claims_2 if c.kind == ClaimKind.derived)
        interp_count_2 = sum(1 for c in claims_2 if c.kind == ClaimKind.interpreted)

        assert len(claims_1) == len(claims_2), f"Claim count changed after re-run: {len(claims_1)} vs {len(claims_2)}"
        assert derived_count_1 == derived_count_2, "Derived claims count must remain constant"
        assert interp_count_1 == interp_count_2, "Interpreted claims count must remain constant"

        # Check access levels for sensitive notes
        restricted = [c for c in claims_2 if c.access_level == AccessLevel.restricted]
        confidential = [c for c in claims_2 if c.access_level == AccessLevel.confidential]
        assert len(restricted) >= 2, f"Expected at least 2 restricted claims, got {len(restricted)}"
        assert len(confidential) >= 3, f"Expected at least 3 confidential claims, got {len(confidential)}"
