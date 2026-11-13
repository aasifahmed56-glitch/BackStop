"""
Unit tests for verification and extraction logic with a mock LLM provider.

Requirements verified:
  1. A made-up quote is rejected by quote check.
  2. A real quote passes quote check.
  3. "no" from support check causes claim rejection.
  4. conflict=True is labelled with status 'conflicting'.
  5. Missing reason/quote is transformed into a 'missing' claim.
  6. Pipeline stats add up correctly.
"""
from datetime import date
import pytest
from sqlmodel import Session, select

from app.db import create_db_and_tables, engine
from app.llm import set_fake_provider
from app.models import (
    AccessLevel,
    Chunk,
    Claim,
    ClaimKind,
    ClaimStatus,
    ClaimType,
    Project,
    Source,
    SourceKind,
)
from app.verify import (
    normalize_text_for_quote,
    run_extraction_and_verification,
    verify_quote_in_original,
)


@pytest.fixture(autouse=True)
def setup_db_and_provider():
    create_db_and_tables()
    yield
    set_fake_provider(None)


class TestQuoteCheckUnit:
    def test_exact_substring_passes(self):
        original = "Sessions failed under load in the demo. JWT is stateless."
        quote = "Sessions failed under load in the demo"
        assert verify_quote_in_original(quote, original) is True

    def test_made_up_quote_fails(self):
        original = "Sessions failed under load in the demo. JWT is stateless."
        fake_quote = "We used Redis sessions because they are fast"
        assert verify_quote_in_original(fake_quote, original) is False

    def test_quote_whitespace_resilience(self):
        original = "Payments migration  to the\nnew gateway is on 20 Feb"
        quote = "Payments migration to the new gateway is on 20 Feb"
        assert verify_quote_in_original(quote, original) is True

    def test_curly_quotes_normalization(self):
        original = 'Riya said: “Sessions failed under load”.'
        quote = 'Riya said: "Sessions failed under load".'
        assert verify_quote_in_original(quote, original) is True


class TestExtractionAndVerificationPipeline:
    def test_pipeline_with_mock_provider(self):
        with Session(engine) as session:
            # Create project
            project = Project(
                name="Test Verify App",
                departure_date=date(2026, 3, 15),
                leaver_name="Riya",
            )
            session.add(project)
            session.commit()
            session.refresh(project)

            # Create sample note source and chunk
            src = Source(
                project_id=project.id,
                kind=SourceKind.note,
                name="notes/test-note.md",
                access_level=AccessLevel.team,
                raw_text="Sessions failed under load in the demo. Web migration postponed to April.",
            )
            session.add(src)
            session.commit()
            session.refresh(src)

            chk = Chunk(
                source_id=src.id,
                text="Sessions failed under load in the demo. Web migration postponed to April.",
                author="Riya",
                line_start=1,
                line_end=1,
            )
            session.add(chk)
            session.commit()
            session.refresh(chk)

            # Set mock LLM provider to return 5 distinct items:
            # 1. Real quote, support='yes' -> verified
            # 2. Made-up quote -> rejected by quote check
            # 3. Real quote, support='no' -> rejected by support check
            # 4. Conflict item -> conflicting
            # 5. Missing reason item -> missing
            def mock_llm(system: str, user: str, schema: dict | None) -> dict:
                if "Extract decisions" in system:
                    return {
                        "items": [
                            {
                                "type": "decision",
                                "text": "JWT chosen over sessions",
                                "chunk_ids": [chk.id],
                                "quotes": ["Sessions failed under load in the demo"],
                                "conflict": False,
                                "reason_given": True,
                            },
                            {
                                "type": "decision",
                                "text": "Fabricated redis claim",
                                "chunk_ids": [chk.id],
                                "quotes": ["Redis cache was implemented for auth"],
                                "conflict": False,
                                "reason_given": True,
                            },
                            {
                                "type": "risk",
                                "text": "Database is completely broken",
                                "chunk_ids": [chk.id],
                                "quotes": ["Sessions failed under load in the demo"],
                                "conflict": False,
                                "reason_given": True,
                            },
                            {
                                "type": "decision",
                                "text": "Migration date conflict",
                                "chunk_ids": [chk.id],
                                "quotes": ["Web migration postponed to April"],
                                "conflict": True,
                                "reason_given": True,
                            },
                            {
                                "type": "decision",
                                "text": "Unexplained architecture choice",
                                "chunk_ids": [chk.id],
                                "quotes": [],
                                "conflict": False,
                                "reason_given": False,
                            },
                        ]
                    }
                elif "evaluate whether an exact quote supports" in system:
                    if "Database is completely broken" in user:
                        return {"supports": "no", "reason": "Quote discusses session demo load, not db failure"}
                    return {"supports": "yes", "reason": "Directly supported"}
                return {"items": []}

            set_fake_provider(mock_llm)

            stats = run_extraction_and_verification(project.id, session)

            # 1. Total extracted: 5
            assert stats["extracted"] == 5

            # 2. Made-up quote rejected by quote check: 1
            assert stats["rejected_by_quote_check"] == 1

            # 3. Support='no' rejected by support check: 1
            assert stats["rejected_by_support_check"] == 1

            # 4. Verified: 1
            assert stats["verified"] == 1

            # 5. Conflicting: 1
            assert stats["conflicting"] == 1

            # 6. Missing: 1
            assert stats["missing"] == 1

            # 7. Stats add up perfectly
            total_accounted = (
                stats["rejected_by_quote_check"]
                + stats["rejected_by_support_check"]
                + stats["verified"]
                + stats["inferred"]
                + stats["conflicting"]
                + stats["missing"]
            )
            assert total_accounted == stats["extracted"]

            # Verify claims saved in database
            stored_claims = session.exec(
                select(Claim).where(Claim.project_id == project.id)
            ).all()

            statuses = {c.status for c in stored_claims}
            assert ClaimStatus.verified in statuses
            assert ClaimStatus.conflicting in statuses
            assert ClaimStatus.missing in statuses

            # Strictest access level checked
            for c in stored_claims:
                assert c.access_level == AccessLevel.team
                assert c.kind == ClaimKind.interpreted

