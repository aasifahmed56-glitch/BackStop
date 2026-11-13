"""
Unit tests for access control rules (models.py).

Tests verify:
  - AccessLevel ordering: public < team < restricted < confidential
  - role_can_see: each role's ceiling is enforced
  - strictest_access: returns the max-rank level
  - admin sees everything; incoming_dev/pm capped at team
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from app.models import (
    AccessLevel,
    Role,
    role_can_see,
    strictest_access,
)


class TestAccessLevelOrdering:
    def test_ranks_are_ordered(self):
        assert AccessLevel.public.rank() < AccessLevel.team.rank()
        assert AccessLevel.team.rank() < AccessLevel.restricted.rank()
        assert AccessLevel.restricted.rank() < AccessLevel.confidential.rank()

    def test_public_rank_is_zero(self):
        assert AccessLevel.public.rank() == 0

    def test_confidential_rank_is_highest(self):
        levels = list(AccessLevel)
        assert max(levels, key=lambda a: a.rank()) == AccessLevel.confidential


class TestRoleCanSee:
    # admin — sees everything
    def test_admin_sees_public(self):
        assert role_can_see(Role.admin, AccessLevel.public)

    def test_admin_sees_team(self):
        assert role_can_see(Role.admin, AccessLevel.team)

    def test_admin_sees_restricted(self):
        assert role_can_see(Role.admin, AccessLevel.restricted)

    def test_admin_sees_confidential(self):
        assert role_can_see(Role.admin, AccessLevel.confidential)

    # lead — up to restricted
    def test_lead_sees_public(self):
        assert role_can_see(Role.lead, AccessLevel.public)

    def test_lead_sees_team(self):
        assert role_can_see(Role.lead, AccessLevel.team)

    def test_lead_sees_restricted(self):
        assert role_can_see(Role.lead, AccessLevel.restricted)

    def test_lead_cannot_see_confidential(self):
        assert not role_can_see(Role.lead, AccessLevel.confidential)

    # incoming_dev — up to team
    def test_incoming_dev_sees_public(self):
        assert role_can_see(Role.incoming_dev, AccessLevel.public)

    def test_incoming_dev_sees_team(self):
        assert role_can_see(Role.incoming_dev, AccessLevel.team)

    def test_incoming_dev_cannot_see_restricted(self):
        assert not role_can_see(Role.incoming_dev, AccessLevel.restricted)

    def test_incoming_dev_cannot_see_confidential(self):
        assert not role_can_see(Role.incoming_dev, AccessLevel.confidential)

    # incoming_pm — up to team
    def test_incoming_pm_sees_public(self):
        assert role_can_see(Role.incoming_pm, AccessLevel.public)

    def test_incoming_pm_sees_team(self):
        assert role_can_see(Role.incoming_pm, AccessLevel.team)

    def test_incoming_pm_cannot_see_restricted(self):
        assert not role_can_see(Role.incoming_pm, AccessLevel.restricted)

    def test_incoming_pm_cannot_see_confidential(self):
        assert not role_can_see(Role.incoming_pm, AccessLevel.confidential)


class TestStrictestAccess:
    def test_empty_list_returns_public(self):
        assert strictest_access([]) == AccessLevel.public

    def test_single_level(self):
        assert strictest_access([AccessLevel.team]) == AccessLevel.team

    def test_mixed_returns_strictest(self):
        levels = [AccessLevel.public, AccessLevel.confidential, AccessLevel.team]
        assert strictest_access(levels) == AccessLevel.confidential

    def test_all_same(self):
        assert strictest_access([AccessLevel.restricted, AccessLevel.restricted]) == AccessLevel.restricted

    def test_claim_access_is_strictest_of_sources(self):
        """A claim citing a team source and a restricted source must be restricted."""
        source_levels = [AccessLevel.team, AccessLevel.restricted]
        assert strictest_access(source_levels) == AccessLevel.restricted

    def test_public_sources_give_public_claim(self):
        assert strictest_access([AccessLevel.public, AccessLevel.public]) == AccessLevel.public

