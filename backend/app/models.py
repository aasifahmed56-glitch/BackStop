"""
Backstop — SQLModel database models.
All tables use integer primary keys for SQLite simplicity.
"""
from __future__ import annotations

import json
from datetime import date, datetime
from enum import Enum
from typing import Any, Optional

from sqlalchemy.orm import relationship
from sqlmodel import Column, Field, Relationship, SQLModel, String, Text


# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------

class SourceKind(str, Enum):
    git = "git"
    issue = "issue"
    note = "note"
    task = "task"
    chat = "chat"


class AccessLevel(str, Enum):
    public = "public"
    team = "team"
    restricted = "restricted"
    confidential = "confidential"

    # Ordering: public=0, team=1, restricted=2, confidential=3
    def rank(self) -> int:
        return _ACCESS_RANK[self]


_ACCESS_RANK: dict[AccessLevel, int] = {
    AccessLevel.public: 0,
    AccessLevel.team: 1,
    AccessLevel.restricted: 2,
    AccessLevel.confidential: 3,
}


class ClaimKind(str, Enum):
    derived = "derived"
    interpreted = "interpreted"


class ClaimType(str, Enum):
    owner = "owner"
    decision = "decision"
    blocker = "blocker"
    risk = "risk"
    dependency = "dependency"
    open_question = "open_question"
    next_action = "next_action"
    contact = "contact"


class ClaimStatus(str, Enum):
    verified = "verified"
    inferred = "inferred"
    conflicting = "conflicting"
    missing = "missing"


class ReviewState(str, Enum):
    pending = "pending"
    approved = "approved"
    corrected = "corrected"
    rejected = "rejected"


class Role(str, Enum):
    lead = "lead"
    incoming_dev = "incoming_dev"
    incoming_pm = "incoming_pm"
    admin = "admin"


# Max access level per role
ROLE_MAX_ACCESS: dict[Role, AccessLevel] = {
    Role.lead: AccessLevel.restricted,
    Role.incoming_dev: AccessLevel.team,
    Role.incoming_pm: AccessLevel.team,
    Role.admin: AccessLevel.confidential,
}


def role_can_see(role: Role, level: AccessLevel) -> bool:
    """Return True if the role is permitted to view the given access level."""
    return level.rank() <= ROLE_MAX_ACCESS[role].rank()


def strictest_access(levels: list[AccessLevel]) -> AccessLevel:
    """Return the strictest (highest-rank) access level from a list."""
    if not levels:
        return AccessLevel.public
    return max(levels, key=lambda a: a.rank())


def compute_claim_access_from_evidence(
    evidence_list: list[dict[str, Any]],
    source_access_map: dict[int, AccessLevel],
    fallback: AccessLevel = AccessLevel.public,
) -> AccessLevel:
    """
    A claim's access level is the strictest level among ONLY the chunks it actually
    cites in evidence_json (its quoted chunks), never the whole extraction batch.
    """
    cited_levels = []
    for ev in evidence_list:
        src_id = ev.get("source_id")
        if src_id in source_access_map:
            cited_levels.append(source_access_map[src_id])
    if not cited_levels:
        return fallback
    return strictest_access(cited_levels)


# ---------------------------------------------------------------------------
# Tables
# ---------------------------------------------------------------------------

class Project(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    departure_date: date
    leaver_name: str

    sources: list[Source] = Relationship(
        sa_relationship=relationship("Source", back_populates="project", uselist=True)
    )
    claims: list[Claim] = Relationship(
        sa_relationship=relationship("Claim", back_populates="project", uselist=True)
    )


class Source(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id", index=True)
    kind: SourceKind
    name: str                        # filename or identifier
    access_level: AccessLevel
    raw_text: str = Field(sa_column=Column(Text))

    project: Optional[Project] = Relationship(
        sa_relationship=relationship("Project", back_populates="sources")
    )
    chunks: list[Chunk] = Relationship(
        sa_relationship=relationship("Chunk", back_populates="source", uselist=True)
    )


class Chunk(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    source_id: int = Field(foreign_key="source.id", index=True)
    text: str = Field(sa_column=Column(Text))
    author: Optional[str] = None
    timestamp: Optional[datetime] = None
    line_start: Optional[int] = None
    line_end: Optional[int] = None

    source: Optional[Source] = Relationship(
        sa_relationship=relationship("Source", back_populates="chunks")
    )


class Claim(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id", index=True)
    kind: ClaimKind
    type: ClaimType
    text: str = Field(sa_column=Column(Text))
    # JSON: list of {source_id, chunk_id, quote, line_start, line_end}
    evidence_json: str = Field(default="[]", sa_column=Column(Text))
    status: ClaimStatus
    confidence: float = Field(default=1.0)   # 0.0–1.0
    access_level: AccessLevel
    review_state: ReviewState = Field(default=ReviewState.pending)
    current_version: int = Field(default=1)

    project: Optional[Project] = Relationship(
        sa_relationship=relationship("Project", back_populates="claims")
    )
    versions: list[ClaimVersion] = Relationship(
        sa_relationship=relationship("ClaimVersion", back_populates="claim", cascade="all, delete-orphan", uselist=True)
    )
    audit_logs: list[AuditLog] = Relationship(
        sa_relationship=relationship("AuditLog", back_populates="claim", cascade="all, delete-orphan", uselist=True)
    )

    def evidence(self) -> list[dict[str, Any]]:
        return json.loads(self.evidence_json)


class ClaimVersion(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    claim_id: int = Field(foreign_key="claim.id", index=True)
    version: int
    text: str = Field(sa_column=Column(Text))
    evidence_json: str = Field(default="[]", sa_column=Column(Text))
    status: ClaimStatus
    confidence: float
    access_level: AccessLevel
    review_state: ReviewState
    changed_by: str                  # role or system
    changed_at: datetime = Field(default_factory=datetime.utcnow)
    change_note: Optional[str] = None

    claim: Optional[Claim] = Relationship(
        sa_relationship=relationship("Claim", back_populates="versions")
    )


class AuditLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    claim_id: Optional[int] = Field(default=None, foreign_key="claim.id", index=True, nullable=True)
    project_id: Optional[int] = Field(default=None, index=True, nullable=True)
    action: str                      # e.g. "review_approved", "access_denied", "handover_acknowledged"
    actor_role: str
    detail: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    claim: Optional[Claim] = Relationship(
        sa_relationship=relationship("Claim", back_populates="audit_logs")
    )

class LLMCallRecord(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    date_str: str = Field(index=True)  # YYYY-MM-DD
    model: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
