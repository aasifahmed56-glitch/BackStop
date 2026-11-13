"""
Unit tests for compute_claim_access_from_evidence().

A claim's access_level must equal the STRICTEST level among only the
chunks it actually cites in evidence_json (its quoted chunks), never
the entire extraction batch.

Hierarchy (strictest last):  public < team < restricted < confidential

The function signature is:
    compute_claim_access_from_evidence(
        evidence_list: list[dict],      # parsed evidence items
        source_access_map: dict[int, AccessLevel],  # source_id -> AccessLevel
        fallback: AccessLevel = AccessLevel.public,
    ) -> AccessLevel
"""

import pytest
from app.models import AccessLevel, compute_claim_access_from_evidence


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _ev(source_ids: list[int]) -> list[dict]:
    """Build a minimal evidence_list referencing the given source_ids."""
    return [{"source_id": sid, "quote": "some quote"} for sid in source_ids]


# Source-id → AccessLevel maps
SRC_PUBLIC      = {1: AccessLevel.public}
SRC_TEAM        = {2: AccessLevel.team}
SRC_RESTRICTED  = {3: AccessLevel.restricted}
SRC_CONFIDENTIAL = {4: AccessLevel.confidential}

ALL_SOURCES = {
    1: AccessLevel.public,
    2: AccessLevel.team,
    3: AccessLevel.restricted,
    4: AccessLevel.confidential,
}


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_single_public_source_gives_public():
    result = compute_claim_access_from_evidence(_ev([1]), ALL_SOURCES)
    assert result == AccessLevel.public


def test_single_team_source_gives_team():
    result = compute_claim_access_from_evidence(_ev([2]), ALL_SOURCES)
    assert result == AccessLevel.team


def test_single_restricted_source_gives_restricted():
    result = compute_claim_access_from_evidence(_ev([3]), ALL_SOURCES)
    assert result == AccessLevel.restricted


def test_single_confidential_source_gives_confidential():
    result = compute_claim_access_from_evidence(_ev([4]), ALL_SOURCES)
    assert result == AccessLevel.confidential


def test_public_plus_team_gives_team():
    """Strictest of public+team is team."""
    result = compute_claim_access_from_evidence(_ev([1, 2]), ALL_SOURCES)
    assert result == AccessLevel.team


def test_public_plus_restricted_gives_restricted():
    result = compute_claim_access_from_evidence(_ev([1, 3]), ALL_SOURCES)
    assert result == AccessLevel.restricted


def test_team_plus_confidential_gives_confidential():
    result = compute_claim_access_from_evidence(_ev([2, 4]), ALL_SOURCES)
    assert result == AccessLevel.confidential


def test_all_levels_gives_confidential():
    """When all levels are cited the strictest (confidential) wins."""
    result = compute_claim_access_from_evidence(_ev([1, 2, 3, 4]), ALL_SOURCES)
    assert result == AccessLevel.confidential


def test_empty_evidence_defaults_to_public():
    """No cited chunks → safest fallback is public."""
    result = compute_claim_access_from_evidence([], ALL_SOURCES)
    assert result == AccessLevel.public


def test_unknown_source_id_skipped_gracefully():
    """A source_id not in the map is silently ignored; known sources govern."""
    evidence = [
        {"source_id": 9999, "quote": "ghost"},   # unknown
        {"source_id": 2, "quote": "real"},        # team
    ]
    result = compute_claim_access_from_evidence(evidence, ALL_SOURCES)
    assert result == AccessLevel.team


def test_only_unknown_source_ids_default_to_public():
    """If every cited source_id is unknown, fall back to public."""
    result = compute_claim_access_from_evidence(
        [{"source_id": 8888, "quote": "ghost"}], ALL_SOURCES
    )
    assert result == AccessLevel.public


def test_restricted_not_inflated_by_public_siblings():
    """
    Critical property: a claim that cites ONE restricted source plus several
    public sources must be restricted — not public, not team.
    """
    evidence = [
        {"source_id": 1, "quote": "a"},  # public
        {"source_id": 1, "quote": "b"},  # public
        {"source_id": 3, "quote": "c"},  # restricted
    ]
    result = compute_claim_access_from_evidence(evidence, ALL_SOURCES)
    assert result == AccessLevel.restricted


def test_custom_fallback_used_when_no_matches():
    """The caller may pass a custom fallback for empty evidence."""
    result = compute_claim_access_from_evidence(
        [], ALL_SOURCES, fallback=AccessLevel.team
    )
    assert result == AccessLevel.team
