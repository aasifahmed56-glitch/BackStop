"""
Sign-in for Backstop: accounts, sessions and the role guard.

- Two sign-in doors: POST /api/auth/login for team members and
  POST /api/auth/admin/login for administrators. Each door refuses the
  other kind of account, so an admin cannot sign in through the user page
  and a user cannot sign in through the admin page.
- Passwords are stored as scrypt hashes with a per-account salt.
- A session is a random token kept server side and sent as an HttpOnly cookie.
- The role guard runs on every /api request. It refuses requests with no
  session, and refuses any `role` value (query string or JSON body) that the
  signed-in account is not allowed to act as. The rest of the API keeps its
  existing role checks, so the server no longer trusts a role it is sent.
- Admins manage accounts under /api/admin/users.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import secrets
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlmodel import Field, Session, SQLModel, select

from app.db import engine, get_session
from app.models import AuditLog, Role

COOKIE_NAME = "backstop_session"
SESSION_HOURS = int(os.getenv("SESSION_HOURS", "12"))

# Which roles each kind of account may act as. A lead can preview the
# handover as a newcomer would see it; newcomers see only their own view.
ACTING_ROLES: dict[Role, set[Role]] = {
    Role.admin: set(Role),
    Role.lead: {Role.lead, Role.incoming_dev, Role.incoming_pm},
    Role.incoming_dev: {Role.incoming_dev},
    Role.incoming_pm: {Role.incoming_pm},
}

# Endpoints that change shared data without a role field: lead or admin accounts only.
_EDITOR_PATHS = [
    re.compile(r"^/api/sample/"),
    re.compile(r"^/api/projects/\d+/(derive|extract|upload)$"),
    re.compile(r"^/api/import/github$"),
    re.compile(r"^/api/claims/recompute-access$"),
]
_PUBLIC_PATHS = {
    "/api/auth/login",
    "/api/auth/admin/login",
    "/api/auth/logout",
    "/api/auth/config",
}

_USERNAME_RE = re.compile(r"^[a-zA-Z0-9_.-]{3,40}$")
MIN_PASSWORD = 8


# ---------------------------------------------------------------------------
# Tables
# ---------------------------------------------------------------------------

class UserAccount(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(index=True, unique=True)
    display_name: str
    role: Role
    password_hash: str
    active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_login_at: Optional[datetime] = None


class LoginSession(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    token_hash: str = Field(index=True, unique=True)
    user_id: int = Field(foreign_key="useraccount.id", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: datetime


# ---------------------------------------------------------------------------
# Passwords and tokens
# ---------------------------------------------------------------------------

_SCRYPT = {"n": 2**14, "r": 8, "p": 1, "dklen": 32}


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, **_SCRYPT)
    return f"scrypt${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, salt_hex, digest_hex = stored.split("$")
    except ValueError:
        return False
    if scheme != "scrypt":
        return False
    digest = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt_hex), **_SCRYPT)
    return hmac.compare_digest(digest.hex(), digest_hex)


# Used so an unknown username costs the same time as a wrong password.
_DUMMY_HASH = hash_password(secrets.token_hex(8))


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def auth_disabled() -> bool:
    """Only the legacy test-suite turns sign-in off. Production never sets this."""
    return os.getenv("AUTH_DISABLED", "") == "1"


def demo_mode() -> bool:
    return os.getenv("DEMO_ACCOUNTS", "") == "1"


# ---------------------------------------------------------------------------
# Seeding
# ---------------------------------------------------------------------------

DEMO_USERS = [
    ("admin", "Admin", Role.admin),
    ("lead", "Team lead", Role.lead),
    ("dev", "New developer", Role.incoming_dev),
    ("pm", "New project manager", Role.incoming_pm),
]


def seed_accounts() -> None:
    """Create the first accounts on an empty database.

    - ADMIN_USERNAME / ADMIN_PASSWORD create the first admin.
    - DEMO_ACCOUNTS=1 creates admin, lead, dev and pm with DEMO_PASSWORD
      (default "backstop-demo"), so a public demo can be tried at once.
    Accounts that already exist are left alone.
    """
    with Session(engine) as session:
        existing = {u.username for u in session.exec(select(UserAccount)).all()}
        admin_user = os.getenv("ADMIN_USERNAME", "").strip()
        admin_pw = os.getenv("ADMIN_PASSWORD", "")
        if admin_user and admin_pw and admin_user not in existing:
            session.add(UserAccount(username=admin_user, display_name="Admin", role=Role.admin,
                                    password_hash=hash_password(admin_pw)))
            existing.add(admin_user)
        if demo_mode():
            pw = os.getenv("DEMO_PASSWORD", "backstop-demo")
            for username, name, role in DEMO_USERS:
                if username not in existing:
                    session.add(UserAccount(username=username, display_name=name, role=role,
                                            password_hash=hash_password(pw)))
        session.commit()


# ---------------------------------------------------------------------------
# Session lookup
# ---------------------------------------------------------------------------

def user_from_request(request: Request, session: Session) -> Optional[UserAccount]:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        return None
    row = session.exec(select(LoginSession).where(LoginSession.token_hash == _token_hash(token))).first()
    if not row or row.expires_at < datetime.utcnow():
        return None
    user = session.get(UserAccount, row.user_id)
    if not user or not user.active:
        return None
    return user


def _public_user(u: UserAccount) -> dict:
    return {
        "id": u.id,
        "username": u.username,
        "display_name": u.display_name,
        "role": u.role.value,
        "acting_roles": sorted(r.value for r in ACTING_ROLES[u.role]),
        "is_admin": u.role == Role.admin,
        "active": u.active,
        "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
    }


def _audit(session: Session, action: str, user: Optional[UserAccount], detail: str) -> None:
    session.add(AuditLog(action=action, actor_role=user.role.value if user else "anonymous", detail=detail))


# ---------------------------------------------------------------------------
# Middleware: the role guard
# ---------------------------------------------------------------------------

def _deny(status: int, detail: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"detail": detail})


async def role_guard(request: Request, call_next):
    path = request.url.path
    if not path.startswith("/api/") or path in _PUBLIC_PATHS or auth_disabled() or request.method == "OPTIONS":
        return await call_next(request)

    with Session(engine) as session:
        user = user_from_request(request, session)
        if not user:
            return _deny(401, "Sign in required.")
        role = user.role
        username = user.username

    if path.startswith("/api/admin/") and role != Role.admin:
        return _deny(403, "Admins only.")
    if any(p.match(path) for p in _EDITOR_PATHS) and role not in (Role.lead, Role.admin):
        return _deny(403, "Only lead or admin accounts may change project data.")

    requested: list[str] = request.query_params.getlist("role")
    if request.method in ("POST", "PUT", "PATCH", "DELETE") and "json" in request.headers.get("content-type", ""):
        raw = await request.body()
        if raw:
            try:
                body = json.loads(raw)
            except ValueError:
                body = None
            if isinstance(body, dict) and isinstance(body.get("role"), str):
                requested.append(body["role"])

    allowed = {r.value for r in ACTING_ROLES[role]}
    for r in requested:
        if r not in allowed:
            return _deny(403, f"Your account ({username}) cannot act as '{r}'.")

    request.state.user_role = role
    return await call_next(request)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

router = APIRouter(tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


def _secure_cookie(request: Request) -> bool:
    flag = os.getenv("COOKIE_SECURE", "").lower()
    if flag in ("1", "true"):
        return True
    if flag in ("0", "false"):
        return False
    return request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https"


def _login(req: LoginRequest, request: Request, response: Response, session: Session, admin_door: bool) -> dict:
    user = session.exec(select(UserAccount).where(UserAccount.username == req.username.strip())).first()
    ok = verify_password(req.password, user.password_hash if user else _DUMMY_HASH)
    if not user or not ok or not user.active:
        _audit(session, "login_failed", None, f"{'admin' if admin_door else 'user'} door, username '{req.username[:40]}'")
        session.commit()
        raise HTTPException(401, "Wrong username or password.")
    is_admin = user.role == Role.admin
    if admin_door and not is_admin:
        raise HTTPException(403, "This is the admin sign-in. Team members sign in at /login.")
    if not admin_door and is_admin:
        raise HTTPException(403, "Admin accounts sign in at /admin/login.")

    token = secrets.token_urlsafe(32)
    expires = datetime.utcnow() + timedelta(hours=SESSION_HOURS)
    session.add(LoginSession(token_hash=_token_hash(token), user_id=user.id, expires_at=expires))
    user.last_login_at = datetime.utcnow()
    session.add(user)
    _audit(session, "login", user, f"{user.username} signed in")
    session.commit()
    session.refresh(user)
    response.set_cookie(
        COOKIE_NAME, token, max_age=SESSION_HOURS * 3600, httponly=True,
        samesite="lax", secure=_secure_cookie(request), path="/",
    )
    return {"user": _public_user(user)}


@router.post("/auth/login", summary="Team member sign-in")
def login(req: LoginRequest, request: Request, response: Response, session: Session = Depends(get_session)):
    return _login(req, request, response, session, admin_door=False)


@router.post("/auth/admin/login", summary="Administrator sign-in")
def admin_login(req: LoginRequest, request: Request, response: Response, session: Session = Depends(get_session)):
    return _login(req, request, response, session, admin_door=True)


@router.post("/auth/logout", summary="Sign out")
def logout(request: Request, response: Response, session: Session = Depends(get_session)):
    token = request.cookies.get(COOKIE_NAME)
    if token:
        row = session.exec(select(LoginSession).where(LoginSession.token_hash == _token_hash(token))).first()
        if row:
            session.delete(row)
            session.commit()
    response.delete_cookie(COOKIE_NAME, path="/")
    return {"ok": True}


@router.get("/auth/me", summary="The signed-in account")
def me(request: Request, session: Session = Depends(get_session)):
    if auth_disabled():
        return {"user": {"id": 0, "username": "local", "display_name": "Local", "role": "admin",
                         "acting_roles": sorted(r.value for r in Role), "is_admin": True, "active": True,
                         "last_login_at": None}}
    user = user_from_request(request, session)
    if not user:
        raise HTTPException(401, "Sign in required.")
    return {"user": _public_user(user)}


@router.get("/auth/config", summary="What the sign-in pages should show")
def config():
    return {
        "demo_accounts": demo_mode(),
        "demo_users": [u for u, _, r in DEMO_USERS if r != Role.admin] if demo_mode() else [],
        "demo_admin": "admin" if demo_mode() else None,
        "demo_password_hint": demo_mode() and not os.getenv("DEMO_PASSWORD"),
    }


# ---- Admin: manage accounts ------------------------------------------------

class NewUser(BaseModel):
    username: str
    display_name: str
    role: Role
    password: str


class UpdateUser(BaseModel):
    display_name: Optional[str] = None
    role: Optional[Role] = None
    active: Optional[bool] = None
    password: Optional[str] = None


def _current_admin(request: Request, session: Session) -> UserAccount:
    user = user_from_request(request, session)
    if not user or user.role != Role.admin:
        raise HTTPException(403, "Admins only.")
    return user


def _check_password(pw: str) -> None:
    if len(pw) < MIN_PASSWORD:
        raise HTTPException(422, f"Password must be at least {MIN_PASSWORD} characters.")


def _active_admins(session: Session) -> int:
    return len(session.exec(select(UserAccount).where(UserAccount.role == Role.admin, UserAccount.active == True)).all())  # noqa: E712


@router.get("/admin/users", summary="List accounts (admin)")
def list_users(request: Request, session: Session = Depends(get_session)):
    _current_admin(request, session)
    users = session.exec(select(UserAccount).order_by(UserAccount.id)).all()
    return {"users": [_public_user(u) for u in users]}


@router.post("/admin/users", summary="Create an account (admin)", status_code=201)
def create_user(body: NewUser, request: Request, session: Session = Depends(get_session)):
    admin = _current_admin(request, session)
    username = body.username.strip()
    if not _USERNAME_RE.match(username):
        raise HTTPException(422, "Username must be 3 to 40 letters, digits, dots, dashes or underscores.")
    if not body.display_name.strip():
        raise HTTPException(422, "Display name is required.")
    _check_password(body.password)
    if session.exec(select(UserAccount).where(UserAccount.username == username)).first():
        raise HTTPException(409, "That username is taken.")
    user = UserAccount(username=username, display_name=body.display_name.strip()[:80], role=body.role,
                       password_hash=hash_password(body.password))
    session.add(user)
    _audit(session, "user_created", admin, f"{admin.username} created {username} as {body.role.value}")
    session.commit()
    session.refresh(user)
    return {"user": _public_user(user)}


@router.put("/admin/users/{user_id}", summary="Change an account (admin)")
def update_user(user_id: int, body: UpdateUser, request: Request, session: Session = Depends(get_session)):
    admin = _current_admin(request, session)
    user = session.get(UserAccount, user_id)
    if not user:
        raise HTTPException(404, "Account not found.")
    losing_admin = user.role == Role.admin and user.active and (
        (body.role is not None and body.role != Role.admin) or body.active is False
    )
    if losing_admin and _active_admins(session) <= 1:
        raise HTTPException(409, "Keep at least one active admin.")
    if user.id == admin.id and body.active is False:
        raise HTTPException(409, "You cannot disable your own account.")
    changes = []
    if body.display_name is not None and body.display_name.strip():
        user.display_name = body.display_name.strip()[:80]
        changes.append("name")
    if body.role is not None and body.role != user.role:
        user.role = body.role
        changes.append(f"role={body.role.value}")
    if body.active is not None and body.active != user.active:
        user.active = body.active
        changes.append("enabled" if body.active else "disabled")
    if body.password:
        _check_password(body.password)
        user.password_hash = hash_password(body.password)
        changes.append("password reset")
    # Role, status or password changes end the account's open sessions.
    if any(c.startswith(("role", "disabled", "password")) for c in changes):
        for s in session.exec(select(LoginSession).where(LoginSession.user_id == user.id)).all():
            session.delete(s)
    session.add(user)
    _audit(session, "user_updated", admin, f"{admin.username} changed {user.username}: {', '.join(changes) or 'nothing'}")
    session.commit()
    session.refresh(user)
    return {"user": _public_user(user)}


@router.delete("/admin/users/{user_id}", summary="Delete an account (admin)")
def delete_user(user_id: int, request: Request, session: Session = Depends(get_session)):
    admin = _current_admin(request, session)
    user = session.get(UserAccount, user_id)
    if not user:
        raise HTTPException(404, "Account not found.")
    if user.id == admin.id:
        raise HTTPException(409, "You cannot delete your own account.")
    if user.role == Role.admin and user.active and _active_admins(session) <= 1:
        raise HTTPException(409, "Keep at least one active admin.")
    for s in session.exec(select(LoginSession).where(LoginSession.user_id == user.id)).all():
        session.delete(s)
    session.delete(user)
    _audit(session, "user_deleted", admin, f"{admin.username} deleted {user.username}")
    session.commit()
    return {"ok": True}
