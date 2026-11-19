"""
Teams, project access and activity.

The hierarchy:

    Admin    sees and changes everything.
    Manager  oversees one or more teams: every project and person in them.
    Lead     runs one team: the team's projects and its members.
    Member   (new developer / new project manager) works only on the
             projects a lead, manager or admin assigned to them.

A team has a name, an optional manager and lead, members, and projects.
A member is given projects one by one (ProjectMember). Leads and managers
reach a project through their team. Anyone can also be assigned directly.

Access is enforced in the sign-in guard (see auth.role_guard): any request
that names a project the account cannot reach gets 404, as if the project
did not exist. Activity (what each person opened or changed, and in which
project) is recorded so leads, managers and admins can see who is working
on what.
"""
from __future__ import annotations

import re
from datetime import date, datetime, timedelta
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlmodel import Field, Session, SQLModel, select

from app.db import engine, get_session
from app.models import Claim, Project, Role, Source

# ---------------------------------------------------------------------------
# Tables
# ---------------------------------------------------------------------------


class Team(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    manager_id: Optional[int] = Field(default=None, index=True)
    lead_id: Optional[int] = Field(default=None, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class TeamMember(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    team_id: int = Field(index=True)
    user_id: int = Field(index=True)


class TeamProject(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    team_id: int = Field(index=True)
    project_id: int = Field(index=True)


class ProjectMember(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = Field(index=True)
    user_id: int = Field(index=True)
    assigned_by: Optional[str] = None
    assigned_at: datetime = Field(default_factory=datetime.utcnow)


class Activity(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(index=True)
    username: str
    project_id: Optional[int] = Field(default=None, index=True)
    action: str
    detail: Optional[str] = None
    at: datetime = Field(default_factory=datetime.utcnow, index=True)


# ---------------------------------------------------------------------------
# Who can reach what
# ---------------------------------------------------------------------------

def rank_of(user) -> str:
    if user.role == Role.admin:
        return "admin"
    if user.role == Role.lead:
        return "manager" if getattr(user, "is_manager", False) else "lead"
    return "member"


def teams_overseen(session: Session, user) -> list[Team]:
    """Teams this account runs: all for admin, managed teams for a manager, led teams for a lead."""
    r = rank_of(user)
    if r == "admin":
        return list(session.exec(select(Team).order_by(Team.id)).all())
    if r == "manager":
        return list(session.exec(select(Team).where(Team.manager_id == user.id).order_by(Team.id)).all())
    if r == "lead":
        return list(session.exec(select(Team).where(Team.lead_id == user.id).order_by(Team.id)).all())
    return []


def accessible_project_ids(session: Session, user) -> Optional[set[int]]:
    """None means every project (admin)."""
    if rank_of(user) == "admin":
        return None
    ids = {pm.project_id for pm in session.exec(select(ProjectMember).where(ProjectMember.user_id == user.id)).all()}
    team_ids = [t.id for t in teams_overseen(session, user)]
    if team_ids:
        ids |= {tp.project_id for tp in session.exec(select(TeamProject).where(TeamProject.team_id.in_(team_ids))).all()}
    return ids


_PROJECT_PATH = re.compile(r"^/api/(?:backtest/)?projects/(\d+)(?:/|$)")
_CLAIM_PATH = re.compile(r"^/api/claims/(\d+)/")
_DEFAULT_PROJECT_PATHS = {"/api/claims", "/api/claims/stats", "/api/claims/bulk-approve-verified"}


def project_of_request(request: Request, session: Session) -> Optional[int]:
    path = request.url.path
    m = _PROJECT_PATH.match(path)
    if m:
        return int(m.group(1))
    m = _CLAIM_PATH.match(path)
    if m:
        claim = session.get(Claim, int(m.group(1)))
        return claim.project_id if claim else None
    if path in _DEFAULT_PROJECT_PATHS:
        raw = request.query_params.get("project_id", "1")
        return int(raw) if raw.isdigit() else None
    if path.startswith("/api/sample/"):
        return 1
    return None


def check_project_access(request: Request, session: Session, user) -> Optional[str]:
    """Return a refusal message, or None if the request may go ahead."""
    pid = project_of_request(request, session)
    request.state.project_id = pid
    allowed = accessible_project_ids(session, user)
    request.state.allowed_projects = allowed
    if pid is None or allowed is None:
        return None
    if pid not in allowed:
        return "Project not found."
    return None


def allowed_projects_for(request: Request) -> Optional[set[int]]:
    """Projects the signed-in account may list (None = all, also when sign-in is off)."""
    return getattr(request.state, "allowed_projects", None)


def attach_new_project(session: Session, request: Request, project_id: int) -> None:
    """A project made by a lead or manager joins the teams they run, and they are assigned to it."""
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        return
    from app.auth import UserAccount
    user = session.get(UserAccount, user_id)
    if not user:
        return
    if rank_of(user) in ("lead", "manager"):
        for t in teams_overseen(session, user):
            session.add(TeamProject(team_id=t.id, project_id=project_id))
    session.add(ProjectMember(project_id=project_id, user_id=user.id, assigned_by=user.username))
    session.commit()


def forget_project(session: Session, project_id: int) -> None:
    for model in (TeamProject, ProjectMember):
        for row in session.exec(select(model).where(model.project_id == project_id)).all():
            session.delete(row)


def forget_user(session: Session, user_id: int) -> None:
    for model in (TeamMember, ProjectMember):
        for row in session.exec(select(model).where(model.user_id == user_id)).all():
            session.delete(row)
    for t in session.exec(select(Team)).all():
        if t.manager_id == user_id:
            t.manager_id = None
        if t.lead_id == user_id:
            t.lead_id = None
        session.add(t)


# ---------------------------------------------------------------------------
# Activity
# ---------------------------------------------------------------------------

_DESCRIBE = [
    ("POST", re.compile(r"^/api/claims/\d+/approve$"), "Approved a claim"),
    ("POST", re.compile(r"^/api/claims/\d+/reject$"), "Rejected a claim"),
    ("POST", re.compile(r"^/api/claims/\d+/edit$"), "Corrected a claim"),
    ("POST", re.compile(r"bulk-approve-verified$"), "Approved all verified claims"),
    ("POST", re.compile(r"^/api/projects/\d+/acknowledge$"), "Signed for the handover"),
    ("POST", re.compile(r"^/api/projects/\d+/debrief/answer$"), "Answered a debrief question"),
    ("POST", re.compile(r"^/api/projects/\d+/tripwires/check$"), "Checked a change against tripwires"),
    ("POST", re.compile(r"^/api/projects/\d+/sources/paste$"), "Added a record"),
    ("POST", re.compile(r"^/api/projects/\d+/sources/github$"), "Imported a repository"),
    ("POST", re.compile(r"^/api/projects/\d+/upload$"), "Uploaded a record"),
    ("DELETE", re.compile(r"^/api/projects/\d+/sources/\d+$"), "Removed a record"),
    ("POST", re.compile(r"^/api/projects/\d+/analyse$"), "Built the claims"),
    ("POST", re.compile(r"^/api/projects/\d+/(derive|extract)$"), "Rebuilt the claims"),
    ("POST", re.compile(r"^/api/projects$"), "Created a project"),
    ("DELETE", re.compile(r"^/api/projects/\d+$"), "Deleted a project"),
    ("POST", re.compile(r"^/api/sample/"), "Reset the sample project"),
    ("GET", re.compile(r"^/api/projects/\d+/handover$"), "Read the handover"),
    ("GET", re.compile(r"^/api/projects/\d+/debrief$"), "Opened the debrief questions"),
    ("GET", re.compile(r"^/api/projects/\d+/repo-map$"), "Opened the repository map"),
    ("GET", re.compile(r"^/api/projects/\d+/sources$"), "Opened the records"),
    ("GET", re.compile(r"^/api/claims/\d+/context$"), "Checked a claim's source"),
    ("POST", re.compile(r"^/api/(admin|org)/"), "Changed teams or accounts"),
    ("PUT", re.compile(r"^/api/(admin|org)/"), "Changed teams or accounts"),
    ("DELETE", re.compile(r"^/api/(admin|org)/"), "Changed teams or accounts"),
]
_DEDUPE = timedelta(minutes=2)


def describe(method: str, path: str) -> Optional[str]:
    for m, rx, text in _DESCRIBE:
        if m == method and rx.search(path):
            return text
    return None


def _claim_label(session: Session, path: str) -> Optional[str]:
    m = _CLAIM_PATH.match(path)
    if not m:
        return None
    claim = session.get(Claim, int(m.group(1)))
    if not claim:
        return None
    return f"claim #{claim.id}"


def record_activity(request: Request, status: int) -> None:
    """Called by the guard after a request. Only successful, meaningful actions are kept."""
    user_id = getattr(request.state, "user_id", None)
    if not user_id or status >= 400:
        return
    path, method = request.url.path, request.method
    action = describe(method, path)
    if not action:
        return
    pid = getattr(request.state, "project_id", None)
    with Session(engine) as session:
        if method == "GET":
            recent = session.exec(
                select(Activity).where(Activity.user_id == user_id, Activity.action == action,
                                       Activity.project_id == pid, Activity.at > datetime.utcnow() - _DEDUPE)
            ).first()
            if recent:
                return
        session.add(Activity(user_id=user_id, username=getattr(request.state, "username", "?"),
                             project_id=pid, action=action, detail=_claim_label(session, path)))
        session.commit()


# ---------------------------------------------------------------------------
# Demo organisation
# ---------------------------------------------------------------------------

DEMO_SECOND_PROJECT = "Mobile Check-in App"


def seed_org() -> None:
    """With DEMO_ACCOUNTS=1: one manager over two teams, each with a lead and two members."""
    import os
    if os.getenv("DEMO_ACCOUNTS", "") != "1":
        return
    from app.auth import UserAccount
    with Session(engine) as session:
        if session.exec(select(Team)).first():
            return
        users = {u.username: u for u in session.exec(select(UserAccount)).all()}
        need = ["manager", "lead", "dev", "pm", "lead2", "dev2", "pm2"]
        if any(n not in users for n in need):
            return
        sample = session.get(Project, 1)
        second = session.exec(select(Project).where(Project.name == DEMO_SECOND_PROJECT)).first()
        if not second:
            second = Project(name=DEMO_SECOND_PROJECT, leaver_name="Arun", departure_date=date(2026, 6, 30))
            session.add(second)
            session.commit()
            session.refresh(second)
        teams = [
            ("Platform team", users["lead"], [users["dev"], users["pm"]], sample),
            ("Mobile team", users["lead2"], [users["dev2"], users["pm2"]], second),
        ]
        for name, lead, members, project in teams:
            team = Team(name=name, manager_id=users["manager"].id, lead_id=lead.id)
            session.add(team)
            session.commit()
            session.refresh(team)
            for m in members:
                session.add(TeamMember(team_id=team.id, user_id=m.id))
                if project:
                    session.add(ProjectMember(project_id=project.id, user_id=m.id, assigned_by=lead.username))
            if project:
                session.add(TeamProject(team_id=team.id, project_id=project.id))
        session.commit()


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

router = APIRouter(tags=["org"])


def _me(request: Request, session: Session):
    from app.auth import user_from_request
    user = user_from_request(request, session)
    if not user:
        raise HTTPException(401, "Sign in required.")
    return user


def _person(u, session: Session, last_seen: dict[int, Activity], team_names: dict[int, list[str]],
            projects: dict[int, str]) -> dict[str, Any]:
    reach = accessible_project_ids(session, u)
    pids = sorted(projects) if reach is None else sorted(reach)
    last = last_seen.get(u.id)
    return {
        "id": u.id,
        "username": u.username,
        "display_name": u.display_name,
        "rank": rank_of(u),
        "role": u.role.value,
        "active": u.active,
        "teams": team_names.get(u.id, []),
        "projects": [{"id": p, "name": projects[p]} for p in pids if p in projects],
        "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
        "last_activity": _activity_out(last, projects) if last else None,
    }


def _activity_out(a: Activity, projects: dict[int, str]) -> dict[str, Any]:
    return {
        "id": a.id,
        "user_id": a.user_id,
        "username": a.username,
        "action": a.action,
        "detail": a.detail,
        "project_id": a.project_id,
        "project_name": projects.get(a.project_id) if a.project_id else None,
        "at": a.at.isoformat(),
    }


@router.get("/org/overview", summary="Teams, people, their projects and recent activity, as far as this account oversees")
def overview(request: Request, session: Session = Depends(get_session)):
    from app.auth import UserAccount
    me = _me(request, session)
    rank = rank_of(me)
    if rank == "member":
        raise HTTPException(403, "Leads, managers and admins only.")
    teams = teams_overseen(session, me)
    team_ids = [t.id for t in teams]
    all_users = {u.id: u for u in session.exec(select(UserAccount)).all()}
    projects = {p.id: p.name for p in session.exec(select(Project)).all()}

    members_by_team: dict[int, list[int]] = {}
    for tm in session.exec(select(TeamMember)).all():
        members_by_team.setdefault(tm.team_id, []).append(tm.user_id)
    projects_by_team: dict[int, list[int]] = {}
    for tp in session.exec(select(TeamProject)).all():
        projects_by_team.setdefault(tp.team_id, []).append(tp.project_id)
    assigned: dict[int, set[int]] = {}
    for pm in session.exec(select(ProjectMember)).all():
        assigned.setdefault(pm.user_id, set()).add(pm.project_id)

    # People in view: admin sees everyone; others see their teams' people (and themselves).
    if rank == "admin":
        visible = set(all_users)
    else:
        visible = {me.id}
        for t in teams:
            visible |= set(members_by_team.get(t.id, []))
            visible |= {x for x in (t.lead_id, t.manager_id) if x}

    team_names: dict[int, list[str]] = {}
    for t in session.exec(select(Team)).all():
        for uid in set(members_by_team.get(t.id, [])) | {x for x in (t.lead_id, t.manager_id) if x}:
            team_names.setdefault(uid, []).append(t.name)

    acts = session.exec(
        select(Activity).where(Activity.user_id.in_(visible)).order_by(Activity.at.desc()).limit(300)
    ).all()
    last_seen: dict[int, Activity] = {}
    for a in acts:
        last_seen.setdefault(a.user_id, a)

    def short(uid):
        u = all_users.get(uid)
        return {"id": u.id, "display_name": u.display_name, "username": u.username, "rank": rank_of(u)} if u else None

    out_teams = []
    for t in teams:
        mids = members_by_team.get(t.id, [])
        tpids = [p for p in projects_by_team.get(t.id, []) if p in projects]
        out_teams.append({
            "id": t.id,
            "name": t.name,
            "manager": short(t.manager_id),
            "lead": short(t.lead_id),
            "projects": [{"id": p, "name": projects[p]} for p in tpids],
            "members": [
                {**short(uid), "projects": sorted(assigned.get(uid, set()) & set(tpids)),
                 "last_activity": _activity_out(last_seen[uid], projects) if uid in last_seen else None}
                for uid in mids if uid in all_users
            ],
            "can_assign": True,
        })

    people = [_person(all_users[uid], session, last_seen, team_names, projects)
              for uid in sorted(visible) if uid in all_users]
    return {
        "scope": rank,
        "me": short(me.id),
        "teams": out_teams,
        "people": people,
        "projects": [{"id": p, "name": n} for p, n in sorted(projects.items())] if rank == "admin"
        else [{"id": p, "name": projects[p]} for p in sorted(accessible_project_ids(session, me) or []) if p in projects],
        "activity": [_activity_out(a, projects) for a in acts[:60]],
        "stats": {
            "people": len(people),
            "teams": len(out_teams),
            "projects": len({p for t in out_teams for p in (x["id"] for x in t["projects"])}) if rank != "admin" else len(projects),
            "active_today": len({a.user_id for a in acts if a.at > datetime.utcnow() - timedelta(hours=24)}),
        },
    }


class AssignIn(BaseModel):
    user_id: int
    project_ids: list[int]


@router.put("/org/teams/{team_id}/assignments", summary="Set which of the team's projects a member works on")
def set_assignments(team_id: int, body: AssignIn, request: Request, session: Session = Depends(get_session)):
    me = _me(request, session)
    team = session.get(Team, team_id)
    if not team or team.id not in {t.id for t in teams_overseen(session, me)}:
        raise HTTPException(404, "Team not found.")
    members = {tm.user_id for tm in session.exec(select(TeamMember).where(TeamMember.team_id == team_id)).all()}
    if body.user_id not in members:
        raise HTTPException(422, "That person is not in this team.")
    team_projects = {tp.project_id for tp in session.exec(select(TeamProject).where(TeamProject.team_id == team_id)).all()}
    wanted = set(body.project_ids)
    if not wanted <= team_projects:
        raise HTTPException(422, "Assign only projects that belong to this team.")
    current = session.exec(select(ProjectMember).where(ProjectMember.user_id == body.user_id)).all()
    for pm in current:
        if pm.project_id in team_projects and pm.project_id not in wanted:
            session.delete(pm)
    have = {pm.project_id for pm in current}
    for pid in wanted - have:
        session.add(ProjectMember(project_id=pid, user_id=body.user_id, assigned_by=me.username))
    session.commit()
    return {"ok": True, "user_id": body.user_id, "project_ids": sorted(wanted)}


# ---- Admin: teams -----------------------------------------------------------

class TeamIn(BaseModel):
    name: str
    manager_id: Optional[int] = None
    lead_id: Optional[int] = None
    member_ids: list[int] = []
    project_ids: list[int] = []


class TeamUpdate(BaseModel):
    name: Optional[str] = None
    manager_id: Optional[int] = None
    lead_id: Optional[int] = None
    member_ids: Optional[list[int]] = None
    project_ids: Optional[list[int]] = None
    clear_manager: bool = False
    clear_lead: bool = False


def _require_admin(request: Request, session: Session):
    me = _me(request, session)
    if rank_of(me) != "admin":
        raise HTTPException(403, "Admins only.")
    return me


def _check_people(session: Session, manager_id, lead_id, member_ids) -> None:
    from app.auth import UserAccount
    if manager_id is not None:
        u = session.get(UserAccount, manager_id)
        if not u or rank_of(u) != "manager":
            raise HTTPException(422, "The manager must be a manager account.")
    if lead_id is not None:
        u = session.get(UserAccount, lead_id)
        if not u or rank_of(u) != "lead":
            raise HTTPException(422, "The lead must be a lead account.")
    for mid in member_ids or []:
        u = session.get(UserAccount, mid)
        if not u or rank_of(u) != "member":
            raise HTTPException(422, "Members must be developer or project manager accounts.")


def _set_links(session: Session, team_id: int, member_ids, project_ids) -> None:
    if member_ids is not None:
        for tm in session.exec(select(TeamMember).where(TeamMember.team_id == team_id)).all():
            session.delete(tm)
        for mid in dict.fromkeys(member_ids):
            session.add(TeamMember(team_id=team_id, user_id=mid))
    if project_ids is not None:
        for pid in project_ids:
            if not session.get(Project, pid):
                raise HTTPException(422, f"Project {pid} does not exist.")
        for tp in session.exec(select(TeamProject).where(TeamProject.team_id == team_id)).all():
            session.delete(tp)
        for pid in dict.fromkeys(project_ids):
            session.add(TeamProject(team_id=team_id, project_id=pid))


@router.post("/admin/teams", summary="Create a team (admin)", status_code=201)
def create_team(body: TeamIn, request: Request, session: Session = Depends(get_session)):
    _require_admin(request, session)
    name = " ".join(body.name.split())[:60]
    if not name:
        raise HTTPException(422, "Give the team a name.")
    _check_people(session, body.manager_id, body.lead_id, body.member_ids)
    team = Team(name=name, manager_id=body.manager_id, lead_id=body.lead_id)
    session.add(team)
    session.commit()
    session.refresh(team)
    _set_links(session, team.id, body.member_ids, body.project_ids)
    session.commit()
    return {"id": team.id, "name": team.name}


@router.put("/admin/teams/{team_id}", summary="Change a team (admin)")
def update_team(team_id: int, body: TeamUpdate, request: Request, session: Session = Depends(get_session)):
    _require_admin(request, session)
    team = session.get(Team, team_id)
    if not team:
        raise HTTPException(404, "Team not found.")
    _check_people(session, body.manager_id, body.lead_id, body.member_ids)
    if body.name is not None and body.name.strip():
        team.name = " ".join(body.name.split())[:60]
    if body.clear_manager:
        team.manager_id = None
    elif body.manager_id is not None:
        team.manager_id = body.manager_id
    if body.clear_lead:
        team.lead_id = None
    elif body.lead_id is not None:
        team.lead_id = body.lead_id
    session.add(team)
    _set_links(session, team.id, body.member_ids, body.project_ids)
    session.commit()
    return {"id": team.id, "name": team.name}


@router.delete("/admin/teams/{team_id}", summary="Delete a team (admin)")
def delete_team(team_id: int, request: Request, session: Session = Depends(get_session)):
    _require_admin(request, session)
    team = session.get(Team, team_id)
    if not team:
        raise HTTPException(404, "Team not found.")
    _set_links(session, team.id, [], [])
    session.delete(team)
    session.commit()
    return {"ok": True}
