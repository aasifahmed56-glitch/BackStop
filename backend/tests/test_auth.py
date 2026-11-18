"""Sign-in, the two login doors, the role guard and admin account management."""
import pytest
from fastapi.testclient import TestClient

from app import main as main_mod
from app.auth import hash_password, seed_accounts, verify_password
from app.main import app

PW = "backstop-demo"


@pytest.fixture
def client(monkeypatch):
    monkeypatch.delenv("AUTH_DISABLED", raising=False)
    monkeypatch.setenv("DEMO_ACCOUNTS", "1")
    monkeypatch.delenv("DEMO_PASSWORD", raising=False)
    main_mod._rate_limits.clear()
    with TestClient(app) as c:
        seed_accounts()
        yield c
    main_mod._rate_limits.clear()


def login(c, username, admin=False, password=None):
    if password is None:
        password = "admin" if username == "admin" else PW
    path = "/api/auth/admin/login" if admin else "/api/auth/login"
    return c.post(path, json={"username": username, "password": password})


def test_password_hash_roundtrip():
    h = hash_password("correct horse")
    assert h.startswith("scrypt$") and "correct horse" not in h
    assert verify_password("correct horse", h)
    assert not verify_password("wrong", h)


def test_api_requires_sign_in(client):
    assert client.get("/api/projects").status_code == 401
    assert client.get("/api/claims?project_id=1&role=lead").status_code == 401
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/healthz").status_code == 200
    assert client.get("/api/auth/config").json()["demo_accounts"] is True


def test_wrong_password_refused(client):
    assert login(client, "lead", password="nope-nope").status_code == 401
    assert login(client, "ghost").status_code == 401


def test_doors_are_separate(client):
    r = login(client, "admin")
    assert r.status_code == 403 and "/admin/login" in r.json()["detail"]
    r = login(client, "lead", admin=True)
    assert r.status_code == 403
    assert login(client, "admin", admin=True).status_code == 200
    assert client.get("/api/auth/me").json()["user"]["is_admin"] is True


def test_session_cookie_is_httponly(client):
    r = login(client, "lead")
    assert r.status_code == 200
    cookie = r.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=lax" in cookie


def test_dev_cannot_claim_lead_role(client):
    assert login(client, "dev").status_code == 200
    # Query-string role
    assert client.get("/api/claims?project_id=1&role=lead").status_code == 403
    assert client.get("/api/claims?project_id=1&role=incoming_dev").status_code == 200
    # Body role
    r = client.post("/api/claims/1/approve", json={"role": "lead", "note": "x"})
    assert r.status_code == 403
    r = client.post("/api/claims/1/approve", json={"role": "admin"})
    assert r.status_code == 403
    # Data-changing endpoints with no role field
    assert client.post("/api/sample/reset").status_code == 403
    assert client.post("/api/projects/1/derive").status_code == 403
    assert client.get("/api/admin/users").status_code == 403


def test_lead_can_preview_newcomer_views_but_not_admin(client):
    assert login(client, "lead").status_code == 200
    assert client.get("/api/projects/1/handover?role=incoming_pm").status_code == 200
    assert client.get("/api/claims?project_id=1&role=lead").status_code == 200
    assert client.get("/api/claims?project_id=1&role=admin").status_code == 403
    assert client.get("/api/admin/users").status_code == 403


def test_logout_ends_session(client):
    login(client, "pm")
    assert client.get("/api/auth/me").status_code == 200
    client.post("/api/auth/logout")
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/projects").status_code == 401


def test_admin_manages_accounts(client):
    assert login(client, "admin", admin=True).status_code == 200
    r = client.post("/api/admin/users", json={"username": "asha", "display_name": "Asha", "role": "incoming_dev", "password": "short"})
    assert r.status_code == 422
    r = client.post("/api/admin/users", json={"username": "asha", "display_name": "Asha", "role": "incoming_dev", "password": "long-enough-pw"})
    assert r.status_code == 201
    uid = r.json()["user"]["id"]
    assert client.post("/api/admin/users", json={"username": "asha", "display_name": "A", "role": "lead", "password": "long-enough-pw"}).status_code == 409
    names = [u["username"] for u in client.get("/api/admin/users").json()["users"]]
    assert "asha" in names

    # The new account can sign in at the user door, then loses access once disabled.
    other = TestClient(app)
    assert login(other, "asha", password="long-enough-pw").status_code == 200
    assert other.get("/api/auth/me").json()["user"]["role"] == "incoming_dev"
    assert client.put(f"/api/admin/users/{uid}", json={"active": False}).status_code == 200
    assert other.get("/api/auth/me").status_code == 401
    assert login(other, "asha", password="long-enough-pw").status_code == 401

    assert client.delete(f"/api/admin/users/{uid}").status_code == 200


def test_last_admin_is_protected(client):
    login(client, "admin", admin=True)
    me = client.get("/api/auth/me").json()["user"]
    assert client.delete(f"/api/admin/users/{me['id']}").status_code == 409
    assert client.put(f"/api/admin/users/{me['id']}", json={"active": False}).status_code == 409
    assert client.put(f"/api/admin/users/{me['id']}", json={"role": "lead"}).status_code == 409
