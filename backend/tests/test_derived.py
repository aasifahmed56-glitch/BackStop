"""
Derived-claims unit tests.

Uses a hand-crafted commit fixture whose numbers can be verified by hand:

Modules (Alice = leaver, cutoff = 2026-01-15):
  auth/    Alice×5, Bob×1   → leaver_share = 5/6 ≈ 0.8333
  deploy/  Alice×3          → leaver_share = 3/3 = 1.0 (sole knowledge, no others)
  web/     Bob×3, Carol×2   → Alice not involved
  api/     Alice×1 (Nov-01) → stale (75 days before cutoff), sole knowledge
  notif/   Alice×2 (Jan-10, Jan-11) → revert present, NOT stale (4 days)

Expected sole-knowledge modules: auth, deploy, api, notif  (leaver ≥ 70%, ≤1 other)
Expected stale modules: api  (threshold = cutoff − 30 days = Dec-16-2025)
Expected knowledge_at_risk_scores (formula verified below):
  deploy:  1.0 × (1+0) / max(1,0) = 1.0
  api:     1.0 × (1 + (75-30)/30) / 1 = 1.0 × 2.5 = 2.5
  auth:    0.8333 × (1+0) / 1        = 0.8333
  notif:   1.0 × (1+0) / 1           = 1.0
Expected reverted:  "Revert: Add websocket" (Jan-11)
Expected contacts for auth:  Bob (1 commit)
"""
from datetime import date

import pytest

from app.derived import (
    compute_contact_overlap,
    compute_knowledge_at_risk_score,
    compute_ownership,
    compute_reverted,
    compute_sole_knowledge,
    compute_stale_modules,
)

# ---------------------------------------------------------------------------
# Fixture
# ---------------------------------------------------------------------------

LEAVER = "Alice"
CUTOFF = date(2026, 1, 15)
STALE_DAYS = 30

COMMITS = [
    # auth/: Alice ×5, Bob ×1
    {"hash": "a1", "author": "Alice", "date": date(2026, 1, 1),  "message": "Add login",    "files": ["auth/login.py"],    "chunk_id": 1},
    {"hash": "a2", "author": "Alice", "date": date(2026, 1, 2),  "message": "Add token",    "files": ["auth/token.py"],    "chunk_id": 2},
    {"hash": "a3", "author": "Alice", "date": date(2026, 1, 3),  "message": "Fix auth",     "files": ["auth/login.py"],    "chunk_id": 3},
    {"hash": "a4", "author": "Alice", "date": date(2026, 1, 4),  "message": "Harden auth",  "files": ["auth/security.py"], "chunk_id": 4},
    {"hash": "a5", "author": "Alice", "date": date(2026, 1, 5),  "message": "Auth tests",   "files": ["auth/tests.py"],    "chunk_id": 5},
    {"hash": "b1", "author": "Bob",   "date": date(2026, 1, 6),  "message": "Fix typo",     "files": ["auth/login.py"],    "chunk_id": 6},
    # deploy/: Alice ×3 only
    {"hash": "d1", "author": "Alice", "date": date(2026, 1, 1),  "message": "Add Dockerfile","files": ["deploy/Dockerfile"],"chunk_id": 7},
    {"hash": "d2", "author": "Alice", "date": date(2026, 1, 2),  "message": "Add CI",        "files": ["deploy/ci.yml"],    "chunk_id": 8},
    {"hash": "d3", "author": "Alice", "date": date(2026, 1, 3),  "message": "Add nginx",     "files": ["deploy/nginx.conf"],"chunk_id": 9},
    # web/: Bob ×3, Carol ×2 — Alice not involved
    {"hash": "w1", "author": "Bob",   "date": date(2026, 1, 5),  "message": "Add home",     "files": ["web/home.jsx"],     "chunk_id": 10},
    {"hash": "w2", "author": "Bob",   "date": date(2026, 1, 6),  "message": "Add nav",      "files": ["web/nav.jsx"],      "chunk_id": 11},
    {"hash": "w3", "author": "Bob",   "date": date(2026, 1, 7),  "message": "Add footer",   "files": ["web/footer.jsx"],   "chunk_id": 12},
    {"hash": "c1", "author": "Carol", "date": date(2026, 1, 8),  "message": "Add form",     "files": ["web/form.jsx"],     "chunk_id": 13},
    {"hash": "c2", "author": "Carol", "date": date(2026, 1, 9),  "message": "Add button",   "files": ["web/button.jsx"],   "chunk_id": 14},
    # api/: Alice ×1, 75 days before cutoff → stale
    {"hash": "api1","author": "Alice", "date": date(2025, 11, 1),"message": "Add endpoint", "files": ["api/endpoints.py"], "chunk_id": 15},
    # notif/: Alice ×2, includes a revert; last commit Jan-11 → NOT stale
    {"hash": "n1", "author": "Alice", "date": date(2026, 1, 10), "message": "Add websocket","files": ["notif/ws.py"],      "chunk_id": 16},
    {"hash": "n2", "author": "Alice", "date": date(2026, 1, 11), "message": "Revert: Add websocket","files": ["notif/ws.py"],"chunk_id": 17},
    # post-cutoff commit (must be ignored)
    {"hash": "z1", "author": "Dev",   "date": date(2026, 2, 1),  "message": "Post-departure fix","files": ["deploy/fix.sh"],"chunk_id": 18},
]


# ---------------------------------------------------------------------------
# compute_ownership
# ---------------------------------------------------------------------------

class TestOwnership:
    def setup_method(self):
        self.ownership = compute_ownership(COMMITS, LEAVER, CUTOFF)
        self.by_module = {o["module"]: o for o in self.ownership}

    def test_auth_total(self):
        assert self.by_module["auth"]["total"] == 6

    def test_auth_leaver_count(self):
        assert self.by_module["auth"]["leaver_count"] == 5

    def test_auth_leaver_share(self):
        assert self.by_module["auth"]["leaver_share"] == pytest.approx(5 / 6, rel=1e-3)

    def test_auth_top_author_is_leaver(self):
        assert self.by_module["auth"]["top_author"] == LEAVER

    def test_deploy_leaver_share_is_one(self):
        assert self.by_module["deploy"]["leaver_share"] == pytest.approx(1.0)

    def test_web_leaver_count_is_zero(self):
        # Alice never touched web/
        assert self.by_module["web"]["leaver_count"] == 0

    def test_web_top_author_is_bob(self):
        assert self.by_module["web"]["top_author"] == "Bob"

    def test_post_cutoff_commit_ignored(self):
        # deploy/ post-cutoff commit (z1) must not be counted
        assert self.by_module["deploy"]["total"] == 3

    def test_sorted_by_leaver_share_descending(self):
        shares = [o["leaver_share"] for o in self.ownership]
        assert shares == sorted(shares, reverse=True)


# ---------------------------------------------------------------------------
# compute_sole_knowledge
# ---------------------------------------------------------------------------

class TestSoleKnowledge:
    def setup_method(self):
        ownership = compute_ownership(COMMITS, LEAVER, CUTOFF)
        self.sk = compute_sole_knowledge(ownership, LEAVER)
        self.mods = {s["module"] for s in self.sk}

    def test_auth_flagged(self):
        # 83 % leaver share, 1 other (Bob)
        assert "auth" in self.mods

    def test_deploy_flagged(self):
        # 100 % leaver share, 0 others
        assert "deploy" in self.mods

    def test_api_flagged(self):
        # 100 % leaver share, 0 others
        assert "api" in self.mods

    def test_notif_flagged(self):
        # 100 % leaver share (both pre-cutoff commits by Alice), 0 others
        assert "notif" in self.mods

    def test_web_not_flagged(self):
        # Alice has 0 % of web/ → leaver_share < 70 %
        assert "web" not in self.mods

    def test_auth_other_contributors(self):
        auth = next(s for s in self.sk if s["module"] == "auth")
        assert auth["other_contributors"] == ["Bob"]

    def test_deploy_no_other_contributors(self):
        deploy = next(s for s in self.sk if s["module"] == "deploy")
        assert deploy["num_other_contributors"] == 0


# ---------------------------------------------------------------------------
# compute_stale_modules
# ---------------------------------------------------------------------------

class TestStaleModules:
    def setup_method(self):
        self.stale = compute_stale_modules(COMMITS, CUTOFF, STALE_DAYS)
        self.mods = {s["module"] for s in self.stale}

    def test_api_is_stale(self):
        # Last commit Nov-01-2025; threshold = Jan-15 − 30 = Dec-16-2025 → stale
        assert "api" in self.mods

    def test_api_days_stale(self):
        api = next(s for s in self.stale if s["module"] == "api")
        # (Jan-15-2026) − (Nov-01-2025) = 75 days
        assert api["days_stale"] == 75

    def test_auth_not_stale(self):
        # Last commit Jan-06 (Bob), 9 days before cutoff → not stale
        assert "auth" not in self.mods

    def test_notif_not_stale(self):
        # Last commit Jan-11, 4 days before cutoff → not stale
        assert "notif" not in self.mods

    def test_deploy_not_stale(self):
        # Last commit Jan-03, 12 days → not stale
        assert "deploy" not in self.mods

    def test_sorted_by_days_stale_descending(self):
        days = [s["days_stale"] for s in self.stale]
        assert days == sorted(days, reverse=True)


# ---------------------------------------------------------------------------
# compute_contact_overlap
# ---------------------------------------------------------------------------

class TestContactOverlap:
    def setup_method(self):
        ownership = compute_ownership(COMMITS, LEAVER, CUTOFF)
        sk = compute_sole_knowledge(ownership, LEAVER)
        at_risk = {s["module"] for s in sk}
        self.contacts = compute_contact_overlap(COMMITS, LEAVER, CUTOFF, at_risk)

    def test_bob_suggested_for_auth(self):
        auth_contacts = [c for c in self.contacts if c["module"] == "auth"]
        assert any(c["contact"] == "Bob" for c in auth_contacts)

    def test_bob_has_one_commit_in_auth(self):
        bob = next(c for c in self.contacts
                   if c["module"] == "auth" and c["contact"] == "Bob")
        assert bob["commits"] == 1

    def test_no_contacts_for_deploy(self):
        # Nobody else touched deploy/
        deploy_contacts = [c for c in self.contacts if c["module"] == "deploy"]
        assert deploy_contacts == []

    def test_leaver_not_in_contacts(self):
        for c in self.contacts:
            assert c["contact"] != LEAVER


# ---------------------------------------------------------------------------
# compute_reverted
# ---------------------------------------------------------------------------

class TestReverted:
    def setup_method(self):
        self.reverted = compute_reverted(COMMITS, CUTOFF)

    def test_one_revert_found(self):
        assert len(self.reverted) == 1

    def test_revert_message(self):
        assert self.reverted[0]["revert_message"] == "Revert: Add websocket"

    def test_original_message_extracted(self):
        assert self.reverted[0]["original_message"] == "Add websocket"

    def test_original_hash_resolved(self):
        # "Add websocket" (n1) should be linked
        assert self.reverted[0]["original_hash"] == "n1"

    def test_revert_date(self):
        assert self.reverted[0]["revert_date"] == "2026-01-11"

    def test_files_present(self):
        assert "notif/ws.py" in self.reverted[0]["files"]


# ---------------------------------------------------------------------------
# compute_knowledge_at_risk_score
# ---------------------------------------------------------------------------

class TestKnowledgeAtRiskScore:
    def setup_method(self):
        ownership = compute_ownership(COMMITS, LEAVER, CUTOFF)
        stale = compute_stale_modules(COMMITS, CUTOFF, STALE_DAYS)
        self.scores = compute_knowledge_at_risk_score(ownership, stale, LEAVER, STALE_DAYS)

    def test_api_score(self):
        # leaver_share=1.0, staleness=(75−30)/30=1.5, num_others=0
        # score = 1.0 × (1+1.5) / max(1,0) = 2.5
        assert self.scores["api"] == pytest.approx(2.5, rel=1e-3)

    def test_deploy_score(self):
        # leaver_share=1.0, staleness=0, num_others=0 → 1.0
        assert self.scores["deploy"] == pytest.approx(1.0, rel=1e-3)

    def test_notif_score(self):
        # leaver_share=1.0, staleness=0, num_others=0 → 1.0
        assert self.scores["notif"] == pytest.approx(1.0, rel=1e-3)

    def test_auth_score(self):
        # leaver_share=5/6≈0.8333, staleness=0, num_others=1 → 0.8333/1=0.8333
        assert self.scores["auth"] == pytest.approx(5 / 6, rel=1e-3)

    def test_web_score_is_zero(self):
        # Alice has 0 % of web → score = 0
        assert self.scores.get("web", 0.0) == pytest.approx(0.0, abs=1e-6)

    def test_sorted_descending(self):
        vals = list(self.scores.values())
        assert vals == sorted(vals, reverse=True)

