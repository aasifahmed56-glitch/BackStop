"""Teams and project access: admin over all, manager over teams, lead over a team, members on assigned projects."""
import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app import main as main_mod
from app.auth import seed_accounts
from app.db import engine
from app.main import app
from app.models import Project
from app.org import DEMO_SECOND_PROJECT, Activity, seed_org

PW = "backstop-demo"


@pytest.fixture
def client(monkeypatch):
    monkeypatch.delenv("AUTH_DISABLED", raising=False)
    monkeypatch.setenv("DEMO_ACCOUNTS", "1")
    monkeypatch.delenv("DEMO_PASSWORD", raising=False)
    main_mod._rate_limits.clear()
    with TestClient(app) as c:
        seed_accounts()
        seed_org()
        yield c
    main_mod._rate_limits.clear()


def second_id():
    with Session(engine) as s:
        return s.exec(select(Project).where(Project.name == DEMO_SECOND_PROJECT)).first().id


def as_user(username):
    c = TestClient(app)
    path = "/api/auth/admin/login" if username == "admin" else "/api/auth/login"
    r = c.post(path, json={"username": username, "password": "admin" if username == "admin" else PW})
    assert r.status_code == 200, r.text
    return c


def project_ids(c):
    return {p["id"] for p in c.get("/api/projects").json()}


def test_project_lists_follow_the_hierarchy(client):
    mobile = second_id()
    assert {1, mobile} <= project_ids(as_user("admin"))
    assert {1, mobile} <= project_ids(as_user("manager"))
    assert project_ids(as_user("lead")) == {1}
    assert project_ids(as_user("lead2")) == {mobile}
    assert project_ids(as_user("dev")) == {1}
    assert project_ids(as_user("pm2")) == {mobile}


def test_members_cannot_open_other_projects(client):
    mobile = second_id()
    dev = as_user("dev")
    assert dev.get("/api/projects/1/handover?role=incoming_dev").status_code == 200
    assert dev.get(f"/api/projects/{mobile}/handover?role=incoming_dev").status_code == 404
    assert dev.get(f"/api/claims?project_id={mobile}&role=incoming_dev").status_code == 404
    assert dev.get(f"/api/projects/{mobile}").status_code == 404
    dev2 = as_user("dev2")
    assert dev2.get("/api/projects/1/handover?role=incoming_dev").status_code == 404
    # A claim id in another project is refused too.
    claim_id = as_user("admin").get("/api/claims?project_id=1&role=admin").json()[0]["id"]
    assert dev2.get(f"/api/claims/{claim_id}/context?role=incoming_dev").status_code == 404
    assert dev.get(f"/api/claims/{claim_id}/context?role=incoming_dev").status_code == 200


def test_leads_reach_only_their_team(client):
    mobile = second_id()
    lead = as_user("lead")
    assert lead.get(f"/api/projects/{mobile}/handover?role=lead").status_code == 404
    claim_id = as_user("admin").get("/api/claims?project_id=1&role=admin").json()[0]["id"]
    assert as_user("lead2").post(f"/api/claims/{claim_id}/approve", json={"role": "lead"}).status_code == 404


def test_overview_scopes(client):
    admin = as_user("admin").get("/api/org/overview").json()
    assert admin["scope"] == "admin" and len(admin["teams"]) == 2
    assert {p["username"] for p in admin["people"]} >= {"manager", "lead", "dev", "pm", "lead2", "dev2", "pm2"}

    mgr = as_user("manager").get("/api/org/overview").json()
    assert mgr["scope"] == "manager"
    assert {t["name"] for t in mgr["teams"]} == {"Platform team", "Mobile team"}

    lead = as_user("lead").get("/api/org/overview").json()
    assert lead["scope"] == "lead"
    assert [t["name"] for t in lead["teams"]] == ["Platform team"]
    names = {p["username"] for p in lead["people"]}
    assert {"dev", "pm"} <= names and "dev2" not in names

    assert as_user("dev").get("/api/org/overview").status_code == 403


def test_activity_shows_who_works_where(client):
    dev = as_user("dev")
    r = dev.post("/api/projects/1/tripwires/check", json={"role": "incoming_dev", "files": ["src/app.py"]})
    assert r.status_code == 200, r.text
    lead = as_user("lead").get("/api/org/overview").json()
    member = next(m for m in lead["teams"][0]["members"] if m["username"] == "dev")
    assert member["last_activity"]["action"] == "Checked a change against tripwires"
    assert member["last_activity"]["project_id"] == 1
    # Repeated reads within a couple of minutes are not logged twice.
    dev.get("/api/projects/1/handover?role=incoming_dev")
    dev.get("/api/projects/1/handover?role=incoming_dev")
    with Session(engine) as s:
        rows = s.exec(select(Activity).where(Activity.username == "dev", Activity.action == "Read the handover")).all()
    assert len(rows) == 1


def test_lead_assigns_members_within_team(client):
    lead = as_user("lead")
    ov = lead.get("/api/org/overview").json()
    team = ov["teams"][0]
    pm_id = next(m["id"] for m in team["members"] if m["username"] == "pm")
    assert lead.put(f"/api/org/teams/{team['id']}/assignments", json={"user_id": pm_id, "project_ids": []}).status_code == 200
    assert as_user("pm").get("/api/projects/1/handover?role=incoming_pm").status_code == 404
    assert lead.put(f"/api/org/teams/{team['id']}/assignments", json={"user_id": pm_id, "project_ids": [1]}).status_code == 200
    assert as_user("pm").get("/api/projects/1/handover?role=incoming_pm").status_code == 200
    # Not a project of this team.
    r = lead.put(f"/api/org/teams/{team['id']}/assignments", json={"user_id": pm_id, "project_ids": [second_id()]})
    assert r.status_code == 422
    # Another lead cannot touch this team.
    assert as_user("lead2").put(f"/api/org/teams/{team['id']}/assignments", json={"user_id": pm_id, "project_ids": []}).status_code == 404


def test_new_project_joins_the_leads_team(client):
    lead2 = as_user("lead2")
    r = lead2.post("/api/projects", json={"role": "lead", "name": "Payments revamp", "leaver_name": "Sam", "departure_date": "2026-12-01"})
    assert r.status_code == 201, r.text
    pid = r.json()["id"]
    assert pid in project_ids(lead2)
    assert pid in project_ids(as_user("manager"))
    assert pid not in project_ids(as_user("lead"))
    assert lead2.delete(f"/api/projects/{pid}?role=lead").status_code == 200


def test_admin_manages_teams(client):
    admin = as_user("admin")
    people = {p["username"]: p["id"] for p in admin.get("/api/org/overview").json()["people"]}
    r = admin.post("/api/admin/teams", json={"name": "Data team", "manager_id": people["manager"], "lead_id": people["lead"],
                                             "member_ids": [people["dev2"]], "project_ids": [1]})
    assert r.status_code == 201
    tid = r.json()["id"]
    # Wrong kinds of account are refused.
    assert admin.post("/api/admin/teams", json={"name": "Bad", "lead_id": people["dev"]}).status_code == 422
    assert admin.put(f"/api/admin/teams/{tid}", json={"member_ids": [people["dev2"], people["pm2"]]}).status_code == 200
    assert as_user("lead").put(f"/api/admin/teams/{tid}", json={"name": "x"}).status_code == 403
    assert admin.delete(f"/api/admin/teams/{tid}").status_code == 200


def test_manager_accounts(client):
    admin = as_user("admin")
    r = admin.post("/api/admin/users", json={"username": "mgr2", "display_name": "M2", "role": "lead", "is_manager": True, "password": "long-enough"})
    assert r.status_code == 201 and r.json()["user"]["rank"] == "manager"
    assert admin.post("/api/admin/users", json={"username": "mgr3", "display_name": "M3", "role": "incoming_dev", "is_manager": True, "password": "long-enough"}).status_code == 422
    assert admin.delete(f"/api/admin/users/{r.json()['user']['id']}").status_code == 200
