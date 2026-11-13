"""
generate_sample.py — Deterministic synthetic data generator for Backstop.

Generates the "Campus Event App" fictional project into backend/data/sample/.
Everything here is FICTIONAL and GENERATED. Fixed random seed — fully offline.

Run:  python backend/data/generate_sample.py

Planted items (see spec):
  P1  JWT decision — only in chat (Nov 2025), not in notes.
  P2  Conflict — meeting-06 says "migration 20 Feb"; issue #31 says "postponed".
  P3  Sole knowledge — deploy/ has 14 commits, 13 by Riya, 1 by Dev.
  P4  Missing owner — task "Set up push notification keys" owner=empty, status=blocked.
  P5  Fake secret — sk_test_FAKE_0000000000EXAMPLE in meeting-04 and one commit message.
  P6  Personal data — riya.example@example.org and +91 00000 00000 in notes.
  P7  Restricted note — notes/advisor-private.md (restricted).
  P8  Confidential note — notes/budget-confidential.md (confidential).
  P9  Reverted work — "Use websockets for notifications" then "Revert: switch to polling".
  P10 Stale module — notifications/ last commit > 45 days before 15 Mar 2026.
  P11 Contact — Sara reviewed most of Riya's auth/ PRs.
"""

import csv
import json
import os
import random
import sys
from datetime import date, datetime, timedelta
from pathlib import Path
from textwrap import dedent

SEED = 42
random.seed(SEED)

OUT = Path(__file__).parent / "sample"
OUT.mkdir(parents=True, exist_ok=True)
(OUT / "notes").mkdir(exist_ok=True)

# Project timeline
START = date(2025, 10, 1)
DEPARTURE = date(2026, 3, 15)
END = date(2026, 6, 30)

MEMBERS = ["Riya", "Dev", "Sara", "Kabir", "Meena"]
ADVISOR = "Prof. Nair"

MODULES = ["auth", "payments", "notifications", "events-api", "deploy", "web-ui", "docs"]

# Riya's primary modules (before cutoff)
RIYA_MODULES = ["auth", "payments", "deploy"]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def rand_date(start: date, end: date) -> date:
    delta = (end - start).days
    return start + timedelta(days=random.randint(0, delta))


def dt_str(d: date, hour: int = 10, minute: int = 0) -> str:
    return datetime(d.year, d.month, d.day, hour, minute).isoformat()


def rand_hash() -> str:
    return "".join(random.choices("0123456789abcdef", k=40))


# ---------------------------------------------------------------------------
# 1. git_log.txt  (~220 commits)
# ---------------------------------------------------------------------------

def gen_git_log() -> str:
    lines: list[str] = []
    commits = []

    def add_commit(author: str, d: date, message: str, files: list[str]):
        commits.append({"author": author, "date": d, "message": message, "files": files})

    # --- Auth module: mostly Riya, Sara reviews ---
    auth_dates = sorted(rand_date(START, DEPARTURE) for _ in range(35))
    auth_messages = [
        "Add JWT authentication middleware",
        "Implement token refresh endpoint",
        "Fix token expiry edge case",
        "Add user registration flow",
        "Harden auth input validation",
        "Add rate limiting to login endpoint",
        "Refactor auth service layer",
        "Add password reset email trigger",
        "Unit tests for JWT decode",
        "Fix auth redirect on session timeout",
        "Improve error messages for invalid tokens",
        "Add OAuth2 scaffold for future use",
        "Cache token blacklist in memory",
        "Docs: auth module overview",
        "Bump JWT library version",
        "Add multi-role support to auth",
        "Fix race condition in token store",
        "Auth: integrate with events-api",
        "Add audit log for auth failures",
        "Cleanup unused auth helpers",
        "Auth: add test fixtures",
        "Auth middleware: handle edge case for expired refresh tokens",
        "Auth: pin dependency versions",
        "Auth: add e2e test scaffold",
        "Lint fixes in auth/",
        "Auth: fix typo in error message",
        "Auth: logging improvements",
        "Auth: extend token lifetime for mobile",
        "Auth: document header format",
        "Auth: add CORS preflight handling",
        "Auth: cleanup legacy session code",
        "Auth: performance profiling notes",
        "Auth: add metrics endpoint",
        "Auth: cleanup after PR review",
        "Auth: final pre-cutoff cleanup",
    ]
    for i, d in enumerate(auth_dates):
        msg = auth_messages[i % len(auth_messages)]
        add_commit("Riya", d, msg, [f"auth/{msg.lower().replace(' ', '_')[:30]}.py"])

    # Sara does a few auth reviews / minor fixes
    for _ in range(6):
        d = rand_date(START, DEPARTURE)
        add_commit("Sara", d, "Review fix: auth PR cleanup", ["auth/tests/test_auth.py"])

    # --- Payments module: Riya ---
    pay_dates = sorted(rand_date(START, date(2026, 2, 19)) for _ in range(28))
    pay_messages = [
        "Scaffold payments module",
        "Integrate Stripe gateway",
        "Add webhook handler for payment events",
        "Payments: idempotency keys",
        "Payments: retry logic",
        "Payments: add refund endpoint",
        "Payments: currency conversion helper",
        "Payments: logging and audit trail",
        "Payments: unit tests for gateway",
        "Payments: mock gateway for tests",
        "Payments: handle declined cards",
        "Payments: add receipt email trigger",
        "Payments: document API contracts",
        "Payments: add payment history endpoint",
        "Payments: performance test scaffold",
        "Payments: pin gateway SDK version",
        "Payments: code review fixes",
        "Payments: add PCI compliance notes",
        "Payments: cleanup unused imports",
        "Payments: bump SDK",
        "Payments: add pagination to history",
        "Payments: validation improvements",
        "Payments: add admin override endpoint",
        "Payments: integrate with events-api",
        "Payments: idempotency test cases",
        "Payments: pre-migration branch setup",
        "Payments: document rollback procedure",
        "Payments: pre-cutoff cleanup",
    ]
    for i, d in enumerate(pay_dates):
        msg = pay_messages[i % len(pay_messages)]
        add_commit("Riya", d, msg, [f"payments/{msg.lower().replace(' ','_')[:30]}.py"])

    # Kabir contributes a little to payments
    for _ in range(4):
        add_commit("Kabir", rand_date(START, DEPARTURE), "Payments: minor UI integration", ["payments/ui_helpers.py"])

    # --- Deploy module: 14 commits, 13 Riya, 1 Dev (typo fix) — P3 ---
    deploy_dates = sorted(rand_date(START, DEPARTURE) for _ in range(13))
    deploy_messages = [
        "Add Dockerfile for backend",
        "Add docker-compose for local dev",
        "CI: add GitHub Actions workflow",
        "Deploy: nginx config for production",
        "Deploy: add env var injection script",
        "Deploy: add health check endpoint wiring",
        "Deploy: add SSL termination config",
        "Deploy: add rollback script",
        "Deploy: add staging environment config",
        "Deploy: secrets management via vault stub",
        "Deploy: add monitoring hooks",
        "Deploy: document deploy steps (internal)",
        "Deploy: pre-cutoff production config",
    ]
    for i, d in enumerate(deploy_dates):
        msg = deploy_messages[i]
        add_commit("Riya", d, msg, [f"deploy/{msg.lower().replace(' ','_')[:30]}.sh"])

    # 1 commit by Dev (typo fix)
    add_commit("Dev", rand_date(START, DEPARTURE), "Deploy: fix typo in nginx config comment", ["deploy/nginx.conf"])

    # --- Notifications: stale — last commit > 45 days before DEPARTURE (15 Mar 2026) ---
    # Cutoff for stale: 15 Mar - 45 days = 29 Jan 2026. Last notif commit <= 28 Jan 2026.
    notif_cutoff = date(2026, 1, 28)
    notif_dates = sorted(rand_date(START, notif_cutoff) for _ in range(12))
    notif_messages = [
        "Scaffold notifications module",
        "Add email notification service",
        "Notifications: add push stub",
        "Use websockets for notifications",   # P9 — to be reverted
        "Notifications: improve delivery retry",
        "Notifications: add template engine",
        "Notifications: unit tests",
        "Revert: switch to polling for notifications",  # P9 — revert
        "Notifications: polling implementation",
        "Notifications: add notification history",
        "Notifications: cleanup after revert",
        "Notifications: pre-stale-period cleanup",
    ]
    notif_authors = ["Meena", "Riya", "Meena", "Riya", "Meena", "Meena", "Meena",
                     "Riya", "Meena", "Meena", "Meena", "Meena"]
    for i, d in enumerate(notif_dates):
        add_commit(notif_authors[i], d, notif_messages[i],
                   [f"notifications/{notif_messages[i].lower().replace(' ','_')[:35]}.py"])

    # --- Events API: Dev and Sara ---
    for _ in range(22):
        d = rand_date(START, DEPARTURE)
        author = random.choice(["Dev", "Sara"])
        add_commit(author, d, f"events-api: {'add' if random.random() > 0.4 else 'fix'} endpoint {random.randint(1,20)}",
                   [f"events-api/endpoint_{random.randint(1,20)}.py"])

    # --- Web UI: Sara and Meena ---
    for _ in range(24):
        d = rand_date(START, DEPARTURE)
        author = random.choice(["Sara", "Meena"])
        add_commit(author, d, f"web-ui: {'add' if random.random() > 0.3 else 'update'} component {random.randint(1,15)}",
                   [f"web-ui/components/comp_{random.randint(1,15)}.tsx"])

    # --- Docs: Dev and Kabir ---
    for _ in range(16):
        d = rand_date(START, DEPARTURE)
        author = random.choice(["Dev", "Kabir"])
        add_commit(author, d, f"docs: {'update' if random.random() > 0.4 else 'add'} section {random.randint(1,10)}",
                   [f"docs/section_{random.randint(1,10)}.md"])

    # P5: Fake secret in one commit message
    secret_date = date(2025, 11, 20)
    add_commit("Riya", secret_date,
               "payments: test Stripe key sk_test_FAKE_0000000000EXAMPLE (remove before prod)",
               ["payments/config_test.py"])

    # Sort all commits by date
    commits.sort(key=lambda c: c["date"])

    # Format as git log
    for c in commits:
        h = rand_hash()
        dow = c["date"].strftime("%a")
        mon = c["date"].strftime("%b")
        day = c["date"].strftime("%d")
        yr = c["date"].year
        lines.append(f"commit {h}")
        lines.append(f"Author: {c['author']} <{c['author'].lower()}@campuseventapp.example>")
        lines.append(f"Date:   {dow} {mon} {day} 10:00:00 {yr} +0530")
        lines.append("")
        lines.append(f"    {c['message']}")
        lines.append("")
        lines.append("    Files changed:")
        for f in c["files"]:
            lines.append(f"      M {f}")
        lines.append("")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# 2. issues.json (~40 issues)
# ---------------------------------------------------------------------------

def gen_issues() -> list[dict]:
    issues = []

    def issue(id_, title, body, author, created, status="open", comments=None, labels=None):
        return {
            "id": id_,
            "title": title,
            "body": body,
            "author": author,
            "created_at": dt_str(created),
            "status": status,
            "labels": labels or [],
            "comments": comments or [],
        }

    def comment(author, body, d):
        return {"author": author, "body": body, "date": dt_str(d)}

    issues.append(issue(1, "Set up project repository and CI",
        "Create the GitHub repo, add CI pipeline, branch protection.",
        "Dev", date(2025, 10, 2), "closed"))

    issues.append(issue(2, "Design auth module architecture",
        "Decide on auth approach: JWT vs sessions. Riya to lead.",
        "Riya", date(2025, 10, 5), "closed",
        comments=[comment("Riya", "Going with JWT — sessions had issues in demo.", date(2025, 10, 7))]))

    issues.append(issue(3, "Implement event listing endpoint",
        "GET /events should return paginated event list.",
        "Dev", date(2025, 10, 10), "closed"))

    issues.append(issue(4, "Add user registration flow",
        "POST /auth/register with email verification.",
        "Riya", date(2025, 10, 12), "closed"))

    issues.append(issue(5, "Design payments module",
        "Research payment gateways. Riya to evaluate Stripe vs Razorpay.",
        "Kabir", date(2025, 10, 18), "closed",
        comments=[comment("Riya", "Going with Stripe for now — better docs.", date(2025, 10, 20))]))

    issues.append(issue(6, "Add event creation form (web-ui)",
        "Build the React form for creating events.",
        "Sara", date(2025, 10, 22), "closed"))

    issues.append(issue(7, "Notifications: scaffold email sender",
        "Set up SendGrid integration for transactional emails.",
        "Meena", date(2025, 11, 1), "closed"))

    issues.append(issue(8, "Deploy: Dockerfile for backend",
        "Containerise the FastAPI backend.",
        "Riya", date(2025, 11, 5), "closed"))

    issues.append(issue(9, "Events API: add search endpoint",
        "Full-text search over event titles and descriptions.",
        "Dev", date(2025, 11, 10), "closed"))

    issues.append(issue(10, "Auth: add token refresh",
        "Implement sliding-window token refresh.",
        "Riya", date(2025, 11, 14), "closed"))

    issues.append(issue(11, "Web-UI: event detail page",
        "Show event details, ticket count, and registration button.",
        "Sara", date(2025, 11, 20), "closed"))

    issues.append(issue(12, "Notifications: websocket experiment",
        "Try websocket-based real-time notifications.",
        "Meena", date(2025, 11, 25), "closed",
        comments=[
            comment("Riya", "Websockets broke on campus wifi in testing — reverting to polling.", date(2025, 12, 2)),
            comment("Meena", "Confirmed. Polling is more reliable here.", date(2025, 12, 3)),
        ]))

    issues.append(issue(13, "Payments: add refund endpoint",
        "POST /payments/refund — only event organisers can trigger.",
        "Kabir", date(2025, 12, 1), "closed"))

    issues.append(issue(14, "Docs: API reference",
        "Write OpenAPI descriptions for all endpoints.",
        "Kabir", date(2025, 12, 5), "closed"))

    issues.append(issue(15, "Auth: multi-role support",
        "Support student, organiser, admin roles.",
        "Riya", date(2025, 12, 10), "closed"))

    issues.append(issue(16, "Events API: RSVP endpoint",
        "POST /events/{id}/rsvp — idempotent.",
        "Dev", date(2025, 12, 15), "closed"))

    issues.append(issue(17, "Web-UI: ticket purchase flow",
        "Integrate payments into the event page.",
        "Sara", date(2025, 12, 20), "closed"))

    issues.append(issue(18, "Deploy: staging environment",
        "Set up a staging server on the university VM.",
        "Riya", date(2026, 1, 5), "closed"))

    issues.append(issue(19, "Notifications: push notification setup",
        "Integrate FCM for mobile push.",
        "Meena", date(2026, 1, 8), "open"))

    issues.append(issue(20, "Payments: webhook reliability",
        "Handle Stripe webhook retries gracefully.",
        "Kabir", date(2026, 1, 12), "closed"))

    issues.append(issue(21, "Auth: password reset flow",
        "Email-based password reset with time-limited tokens.",
        "Riya", date(2026, 1, 15), "closed"))

    issues.append(issue(22, "Docs: deployment guide",
        "Document how to deploy to production.",
        "Dev", date(2026, 1, 18), "open",
        comments=[comment("Dev", "Riya — can you write up the deploy steps? Only you know the full flow.", date(2026, 1, 20))]))

    issues.append(issue(23, "Events API: cancellation endpoint",
        "POST /events/{id}/cancel with refund trigger.",
        "Dev", date(2026, 1, 22), "closed"))

    issues.append(issue(24, "Web-UI: organiser dashboard",
        "Show registration counts, revenue, attendee list.",
        "Sara", date(2026, 1, 28), "closed"))

    issues.append(issue(25, "Auth: audit log viewer",
        "Admin UI to review auth failure logs.",
        "Meena", date(2026, 2, 1), "open"))

    issues.append(issue(26, "Payments: currency support",
        "Add INR and USD support.",
        "Kabir", date(2026, 2, 3), "closed"))

    issues.append(issue(27, "Deploy: SSL certificates",
        "Set up Let's Encrypt for campuseventapp.example.",
        "Riya", date(2026, 2, 5), "closed"))

    issues.append(issue(28, "Notifications: delivery report",
        "Track email open rates via SendGrid webhooks.",
        "Meena", date(2026, 2, 8), "open"))

    issues.append(issue(29, "Events API: recurring events",
        "Support weekly/monthly recurring events.",
        "Dev", date(2026, 2, 10), "open"))

    issues.append(issue(30, "Web-UI: mobile responsiveness",
        "Ensure all pages work on 375px viewport.",
        "Sara", date(2026, 2, 12), "closed"))

    # P2: Conflict — meeting-06 says "migration on 20 Feb"; this says "postponed"
    issues.append(issue(31, "Payments: gateway migration",
        "Migrate from Stripe v2 to new Stripe v3 SDK.",
        "Kabir", date(2026, 2, 14), "open",
        comments=[
            comment("Kabir", "Per meeting-06, migration planned for 20 Feb.", date(2026, 2, 15)),
            comment("Riya", "Migration postponed to next sprint — not enough time to test.", date(2026, 2, 21)),
        ]))

    issues.append(issue(32, "Auth: GDPR data deletion",
        "Implement /auth/delete endpoint for user data removal.",
        "Riya", date(2026, 2, 18), "open"))

    issues.append(issue(33, "Deploy: secrets management",
        "Move hardcoded configs to environment variables.",
        "Riya", date(2026, 2, 20), "closed"))

    issues.append(issue(34, "Events API: search optimisation",
        "Add full-text index for event search.",
        "Dev", date(2026, 2, 22), "open"))

    issues.append(issue(35, "Notifications: set up push notification keys",
        "FCM server key needs to be configured. Blocked on key provisioning.",
        "Meena", date(2026, 2, 25), "open",
        comments=[comment("Meena", "No one has access to the FCM console. This is blocked.", date(2026, 2, 26))]))

    issues.append(issue(36, "Web-UI: accessibility audit",
        "Run axe-core and fix critical a11y issues.",
        "Sara", date(2026, 3, 1), "open"))

    issues.append(issue(37, "Payments: add payment history export",
        "CSV export for event organisers.",
        "Kabir", date(2026, 3, 3), "open"))

    issues.append(issue(38, "Auth: session cleanup job",
        "Cron job to purge expired tokens from DB.",
        "Riya", date(2026, 3, 5), "open"))

    issues.append(issue(39, "Deploy: production go-live checklist",
        "Final checklist before go-live on 1 Apr.",
        "Riya", date(2026, 3, 10), "open",
        comments=[comment("Dev", "Riya — please hand off the deploy runbook before you leave.", date(2026, 3, 12))]))

    issues.append(issue(40, "Docs: onboarding guide for new devs",
        "Write a getting-started guide.",
        "Dev", date(2026, 3, 13), "open"))

    return issues


# ---------------------------------------------------------------------------
# 3. tasks.csv (~60 rows)
# ---------------------------------------------------------------------------

TASK_FIELDS = ["id", "title", "module", "owner", "status", "priority", "created_at", "updated_at", "notes"]

def gen_tasks() -> list[dict]:
    tasks = []
    td = date(2025, 10, 1)

    def task(id_, title, module, owner, status, priority, notes=""):
        d = rand_date(td, DEPARTURE)
        return {
            "id": id_,
            "title": title,
            "module": module,
            "owner": owner,
            "status": status,
            "priority": priority,
            "created_at": dt_str(rand_date(td, d)),
            "updated_at": dt_str(d),
            "notes": notes,
        }

    tasks.extend([
        task(1,  "Set up GitHub repository",             "docs",          "Dev",   "done",    "high"),
        task(2,  "Configure CI/CD pipeline",             "deploy",        "Riya",  "done",    "high"),
        task(3,  "Design database schema",               "events-api",    "Dev",   "done",    "high"),
        task(4,  "Implement JWT auth",                   "auth",          "Riya",  "done",    "high"),
        task(5,  "Build event listing API",              "events-api",    "Dev",   "done",    "medium"),
        task(6,  "Build event creation form",            "web-ui",        "Sara",  "done",    "medium"),
        task(7,  "Integrate Stripe payments",            "payments",      "Riya",  "done",    "high"),
        task(8,  "Set up SendGrid email",                "notifications", "Meena", "done",    "medium"),
        task(9,  "Add token refresh endpoint",           "auth",          "Riya",  "done",    "high"),
        task(10, "Build RSVP endpoint",                  "events-api",    "Dev",   "done",    "high"),
        task(11, "Create ticket purchase flow",          "web-ui",        "Sara",  "done",    "high"),
        task(12, "Add payment webhooks",                 "payments",      "Kabir", "done",    "medium"),
        task(13, "Build organiser dashboard",            "web-ui",        "Sara",  "done",    "medium"),
        task(14, "Deploy staging environment",           "deploy",        "Riya",  "done",    "high"),
        task(15, "Write API reference docs",             "docs",          "Kabir", "done",    "low"),
        task(16, "Add multi-role support",               "auth",          "Riya",  "done",    "high"),
        task(17, "Build recurring events feature",       "events-api",    "Dev",   "in-progress", "medium"),
        task(18, "Add payment history endpoint",         "payments",      "Kabir", "done",    "medium"),
        task(19, "Build admin audit log viewer",         "auth",          "Meena", "in-progress", "low"),
        task(20, "Mobile responsiveness fixes",          "web-ui",        "Sara",  "done",    "medium"),
        task(21, "Password reset flow",                  "auth",          "Riya",  "done",    "high"),
        task(22, "Add notifications delivery report",    "notifications", "Meena", "in-progress", "low"),
        task(23, "Add event search optimisation",        "events-api",    "Dev",   "in-progress", "medium"),
        task(24, "GDPR data deletion endpoint",          "auth",          "Riya",  "in-progress", "high"),
        task(25, "Currency support (INR + USD)",         "payments",      "Kabir", "done",    "medium"),
        task(26, "SSL certificate setup",                "deploy",        "Riya",  "done",    "high"),
        task(27, "Secrets management (env vars)",        "deploy",        "Riya",  "done",    "high"),
        task(28, "Accessibility audit",                  "web-ui",        "Sara",  "in-progress", "medium"),
        task(29, "Payment history CSV export",           "payments",      "Kabir", "in-progress", "low"),
        task(30, "Session cleanup cron job",             "auth",          "Riya",  "in-progress", "medium"),
        # P4: missing owner, blocked
        task(31, "Set up push notification keys",        "notifications", "",      "blocked", "high",
             "No owner assigned. FCM console access unclear. BLOCKED."),
        task(32, "Production go-live checklist",         "deploy",        "Riya",  "in-progress", "high"),
        task(33, "New dev onboarding guide",             "docs",          "Dev",   "in-progress", "low"),
        task(34, "Event cancellation endpoint",          "events-api",    "Dev",   "done",    "medium"),
        task(35, "Refund endpoint",                      "payments",      "Kabir", "done",    "medium"),
        task(36, "Build notifications history",          "notifications", "Meena", "done",    "low"),
        task(37, "Auth rate limiting",                   "auth",          "Riya",  "done",    "high"),
        task(38, "Events API: venue capacity check",     "events-api",    "Dev",   "in-progress", "medium"),
        task(39, "Web-UI: dark mode",                    "web-ui",        "Sara",  "backlog", "low"),
        task(40, "Docs: deploy runbook",                 "docs",          "Riya",  "in-progress", "high",
             "Riya to document the full deploy process before departure."),
        task(41, "Payments: gateway migration (v3 SDK)", "payments",      "Riya",  "blocked", "high",
             "Postponed. See issue #31."),
        task(42, "Notifications: FCM integration",       "notifications", "Meena", "in-progress", "high"),
        task(43, "Events API: waitlist feature",         "events-api",    "Dev",   "backlog", "low"),
        task(44, "Auth: SAML SSO scaffold",              "auth",          "Riya",  "backlog", "low"),
        task(45, "Web-UI: print ticket feature",         "web-ui",        "Sara",  "backlog", "low"),
        task(46, "Deploy: auto-scaling config",          "deploy",        "Riya",  "in-progress", "medium"),
        task(47, "Payments: recurring billing",          "payments",      "Kabir", "backlog", "low"),
        task(48, "Notifications: SMS fallback",          "notifications", "Meena", "backlog", "low"),
        task(49, "Events API: featured events flag",     "events-api",    "Dev",   "in-progress", "low"),
        task(50, "Docs: architecture diagram",           "docs",          "Kabir", "in-progress", "medium"),
        task(51, "Auth: device fingerprinting",          "auth",          "Riya",  "backlog", "low"),
        task(52, "Web-UI: event image upload",           "web-ui",        "Sara",  "in-progress", "medium"),
        task(53, "Payments: dispute handling",           "payments",      "Kabir", "backlog", "low"),
        task(54, "Events API: bulk import",              "events-api",    "Dev",   "backlog", "low"),
        task(55, "Deploy: log aggregation setup",        "deploy",        "Riya",  "in-progress", "medium"),
        task(56, "Notifications: unsubscribe flow",      "notifications", "Meena", "in-progress", "medium"),
        task(57, "Auth: 2FA scaffold",                   "auth",          "Riya",  "backlog", "low"),
        task(58, "Web-UI: organiser onboarding wizard",  "web-ui",        "Sara",  "backlog", "low"),
        task(59, "Payments: tax calculation",            "payments",      "Kabir", "backlog", "low"),
        task(60, "Docs: API changelog",                  "docs",          "Dev",   "backlog", "low"),
    ])
    return tasks


# ---------------------------------------------------------------------------
# 4. chat.json (~120 messages)
# ---------------------------------------------------------------------------

def gen_chat() -> list[dict]:
    messages = []
    mid = 1

    def msg(author, text, d, hour=10, minute=0):
        nonlocal mid
        m = {
            "id": mid,
            "author": author,
            "text": text,
            "timestamp": dt_str(d, hour, minute),
            "channel": "general",
        }
        mid += 1
        return m

    # October 2025 — project kickoff chatter
    messages += [
        msg("Dev",   "Repo is up! Everyone please clone and set up local env.", date(2025, 10, 2)),
        msg("Riya",  "On it. I'll start on auth today.", date(2025, 10, 2), 11),
        msg("Sara",  "I'll take the event creation form.", date(2025, 10, 2), 11, 30),
        msg("Kabir", "I'll help Riya with payments once auth is scaffolded.", date(2025, 10, 3)),
        msg("Meena", "I'll handle notifications. Setting up SendGrid.", date(2025, 10, 3), 10, 30),
        msg("Dev",   "Great. Stand-up at 10am every Monday.", date(2025, 10, 3), 11),
        msg("Riya",  "Auth scaffold is up. JWT middleware added.", date(2025, 10, 8)),
        msg("Dev",   "Looks good in the PR. Sara can you review?", date(2025, 10, 8), 11),
        msg("Sara",  "On it, reviewing auth PR now.", date(2025, 10, 8), 11, 30),
        msg("Sara",  "LGTM! Approved.", date(2025, 10, 8), 14),
        msg("Kabir", "Payment gateway research done. Stripe wins.", date(2025, 10, 10)),
        msg("Riya",  "Agree. I'll integrate Stripe this week.", date(2025, 10, 10), 10, 30),
        msg("Meena", "SendGrid is working. First test email sent!", date(2025, 10, 15)),
        msg("Dev",   "Nice. Event listing API is live on staging.", date(2025, 10, 18)),
        msg("Sara",  "Event creation form PR ready for review.", date(2025, 10, 22)),
        msg("Riya",  "Reviewing Sara's PR.", date(2025, 10, 22), 11),
    ]

    # November 2025 — P1: JWT decision only in chat
    messages += [
        msg("Dev",   "Quick question — why JWT and not server sessions?", date(2025, 11, 3)),
        msg("Riya",  "Sessions failed under load in the demo — the server couldn't keep up with concurrent requests. JWT is stateless so it scales horizontally.", date(2025, 11, 3), 10, 30),
        msg("Dev",   "Makes sense. Good call.", date(2025, 11, 3), 10, 45),
        msg("Sara",  "Agreed. Also easier for the mobile client.", date(2025, 11, 3), 11),
        msg("Kabir", "Auth PR looks good Sara. Nice review comments.", date(2025, 11, 5)),
        msg("Sara",  "Thanks! Riya's code is very clean.", date(2025, 11, 5), 11),
        msg("Meena", "Working on websocket notifications experiment.", date(2025, 11, 10)),
        msg("Dev",   "Cool, let us know how it goes.", date(2025, 11, 10), 10, 30),
        msg("Riya",  "Stripe integration done. Webhooks are tricky.", date(2025, 11, 15)),
        msg("Kabir", "I can help with webhook testing.", date(2025, 11, 15), 11),
        msg("Sara",  "Event detail page merged. Looks great.", date(2025, 11, 20)),
        msg("Dev",   "Good progress everyone. Sprint review on Friday.", date(2025, 11, 20), 11),
        msg("Meena", "Websockets broke on campus wifi during testing. Reverting to polling.", date(2025, 11, 28)),
        msg("Riya",  "Yeah, websockets need persistent connections — campus wifi drops them. Polling is safer.", date(2025, 11, 28), 10, 30),
        msg("Dev",   "Understood. Polling it is.", date(2025, 11, 28), 11),
    ]

    # December 2025
    messages += [
        msg("Kabir", "Refund endpoint is live.", date(2025, 12, 1)),
        msg("Riya",  "Reviewing auth multi-role PR. Almost ready.", date(2025, 12, 10)),
        msg("Sara",  "LGTM on the auth multi-role changes.", date(2025, 12, 12)),
        msg("Dev",   "RSVP endpoint merged. Nice work.", date(2025, 12, 15)),
        msg("Sara",  "Ticket purchase flow ready for review.", date(2025, 12, 20)),
        msg("Meena", "Reviewing Sara's ticket flow.", date(2025, 12, 20), 11),
        msg("Kabir", "Payment history endpoint done.", date(2025, 12, 28)),
        msg("Dev",   "Great. Everyone take a break over New Year!", date(2025, 12, 30)),
    ]

    # January 2026
    messages += [
        msg("Dev",   "Back! Staging environment is looking stable.", date(2026, 1, 5)),
        msg("Riya",  "Password reset flow merged.", date(2026, 1, 15)),
        msg("Sara",  "Organiser dashboard shipped!", date(2026, 1, 28)),
        msg("Kabir", "Currency support (INR + USD) is live.", date(2026, 1, 30)),
        msg("Meena", "Notifications delivery report in progress.", date(2026, 1, 30), 11),
    ]

    # February 2026
    messages += [
        msg("Dev",   "Need to plan the payments gateway migration.", date(2026, 2, 1)),
        msg("Riya",  "Let's target 20 Feb as per the sprint plan.", date(2026, 2, 1), 11),
        msg("Kabir", "I'll handle the testing harness.", date(2026, 2, 1), 11, 30),
        msg("Sara",  "Mobile responsiveness PR is up — please review.", date(2026, 2, 12)),
        msg("Meena", "Reviewing Sara's mobile PR.", date(2026, 2, 12), 11),
        msg("Kabir", "Migration postponed — not enough testing time. Per issue #31.", date(2026, 2, 21)),
        msg("Riya",  "Agreed. Pushing to next sprint.", date(2026, 2, 21), 11),
        msg("Dev",   "Riya can you write up the deploy runbook? Only you have the full picture.", date(2026, 2, 25)),
        msg("Riya",  "Will do. Adding it to my tasks.", date(2026, 2, 25), 11),
        msg("Sara",  "Accessibility audit started. Some issues to fix.", date(2026, 2, 28)),
    ]

    # March 2026 (up to departure)
    messages += [
        msg("Dev",   "Production go-live checklist started.", date(2026, 3, 1)),
        msg("Riya",  "SSL certs are set up. Secrets moved to env vars.", date(2026, 3, 5)),
        msg("Kabir", "Payment history CSV export almost ready.", date(2026, 3, 5), 11),
        msg("Meena", "FCM push key still blocked — no one has console access.", date(2026, 3, 8)),
        msg("Dev",   "That's a risk. Flagging for the handover.", date(2026, 3, 8), 11),
        msg("Riya",  "My last day is 15 Mar. I'll try to document as much as possible.", date(2026, 3, 10)),
        msg("Sara",  "We'll miss you Riya! Thanks for all the auth and deploy work.", date(2026, 3, 10), 11),
        msg("Dev",   "Who's taking over deploy after Riya leaves?", date(2026, 3, 12)),
        msg("Kabir", "I can try but I don't have the full context.", date(2026, 3, 12), 11),
        msg("Dev",   "Let's make sure the runbook is complete before 15 Mar.", date(2026, 3, 12), 11, 30),
        msg("Riya",  "Adding final deploy notes to the docs task.", date(2026, 3, 13)),
        msg("Dev",   "Riya's last day today. Thanks for everything!", date(2026, 3, 15)),
        msg("Sara",  "Best of luck Riya!", date(2026, 3, 15), 11),
        msg("Kabir", "👋 Thanks Riya!", date(2026, 3, 15), 11, 30),
        msg("Meena", "💙 Take care Riya!", date(2026, 3, 15), 12),
    ]

    # Filler messages to reach ~120
    filler = [
        ("Dev",   "Reminder: stand-up in 10 mins.",              date(2025, 10, 20)),
        ("Sara",  "PR reviewed and approved.",                   date(2025, 10, 25)),
        ("Kabir", "Sprint velocity looking good this week.",     date(2025, 11, 7)),
        ("Meena", "Any blockers for today?",                     date(2025, 11, 17)),
        ("Dev",   "No blockers. All green.",                     date(2025, 11, 17), 10, 30),
        ("Riya",  "Quick sync after stand-up?",                  date(2025, 12, 5)),
        ("Sara",  "Sure, in 5 mins.",                            date(2025, 12, 5), 10, 5),
        ("Kabir", "Issue #20 resolved.",                         date(2026, 1, 12)),
        ("Meena", "Will the notifications PR be ready today?",   date(2026, 1, 20)),
        ("Dev",   "Probably tomorrow.",                          date(2026, 1, 20), 11),
        ("Riya",  "LGTM on the payments retry logic.",          date(2026, 2, 3)),
        ("Sara",  "Pushing the accessibility fixes now.",        date(2026, 3, 2)),
        ("Kabir", "Database backup is running.",                 date(2026, 3, 7)),
        ("Meena", "Test suite passed on staging.",               date(2026, 3, 9)),
        ("Dev",   "All good. Ready for the final sprint.",       date(2026, 3, 11)),
    ]
    for f in filler:
        messages.append(msg(*f))

    messages.sort(key=lambda m: m["timestamp"])
    # Re-number
    for i, m in enumerate(messages, 1):
        m["id"] = i
    return messages


# ---------------------------------------------------------------------------
# 5. Meeting notes (10 files)
# ---------------------------------------------------------------------------

MEETING_NOTES = [
    # meeting-01
    ("2025-10-06", "Meeting 01 — Project Kickoff", dedent("""
    **Date:** 6 Oct 2025
    **Attendees:** Riya, Dev, Sara, Kabir, Meena, Prof. Nair

    ## Agenda
    - Project overview and goals
    - Module ownership assignments
    - Timeline discussion

    ## Notes
    - Project: Campus Event App — allow students to discover, register for, and pay for campus events.
    - Timeline: 1 Oct 2025 to 30 Jun 2026.
    - **Module ownership:**
      - Auth: Riya (backend lead)
      - Payments: Riya + Kabir
      - Notifications: Meena
      - Events API: Dev
      - Web UI: Sara + Meena
      - Deploy: Riya
      - Docs: Dev + Kabir
    - Prof. Nair: "Focus on a stable MVP by February."

    ## Action Items
    - [Riya] Set up auth scaffold by 10 Oct.
    - [Dev] Create GitHub repo and CI pipeline.
    - [Sara] Wireframes for event pages by 15 Oct.
    """).strip()),

    # meeting-02
    ("2025-10-27", "Meeting 02 — Sprint 1 Review", dedent("""
    **Date:** 27 Oct 2025
    **Attendees:** Riya, Dev, Sara, Kabir, Meena

    ## Sprint 1 Summary
    - Auth: JWT middleware live. Sara reviewed all PRs.
    - Payments: Stripe chosen, integration started.
    - Notifications: SendGrid scaffolded.
    - Events API: listing endpoint live.
    - Web UI: event creation form in progress.

    ## Decisions
    - Use PostgreSQL for production, SQLite for dev/test.
    - Follow trunk-based development (short-lived branches).

    ## Action Items
    - [Riya] Complete Stripe integration by 10 Nov.
    - [Dev] RSVP endpoint by 15 Nov.
    - [Sara] Event creation form by 1 Nov.
    """).strip()),

    # meeting-03
    ("2025-11-24", "Meeting 03 — Sprint 2 Review", dedent("""
    **Date:** 24 Nov 2025
    **Attendees:** Riya, Dev, Sara, Kabir, Meena

    ## Sprint 2 Summary
    - Auth: token refresh and multi-role support complete.
    - Payments: Stripe integration done. Webhooks tested.
    - Notifications: websocket experiment started.
    - Events API: RSVP endpoint live.
    - Deploy: Dockerfile and CI pipeline in place.

    ## Notes
    - Riya: "Deploy pipeline is non-trivial — I'll document it once things stabilise."
    - Sara has reviewed all of Riya's auth PRs. Great coverage.

    ## Action Items
    - [Meena] Websocket experiment — report by 1 Dec.
    - [Riya] Start password reset flow.
    """).strip()),

    # meeting-04 — P5: planted secret
    ("2025-12-15", "Meeting 04 — Payments Integration Review", dedent("""
    **Date:** 15 Dec 2025
    **Attendees:** Riya, Kabir, Dev

    ## Notes
    - Reviewed Stripe webhook integration.
    - **Action:** Remove test keys from config before go-live.
      - Current test key in config: sk_test_FAKE_0000000000EXAMPLE (THIS MUST BE REPLACED)
    - Kabir to implement refund endpoint by 20 Dec.
    - Riya: "idempotency keys are essential for payment retries."

    ## Risks
    - If test key leaks to production there will be issues. Remove immediately.

    ## Action Items
    - [Riya] Rotate Stripe keys before staging deploy.
    - [Kabir] Refund endpoint by 20 Dec.
    """).strip()),

    # meeting-05
    ("2026-01-12", "Meeting 05 — Mid-Project Review", dedent("""
    **Date:** 12 Jan 2026
    **Attendees:** Riya, Dev, Sara, Kabir, Meena, Prof. Nair

    ## Progress Report
    - Auth: complete (JWT, multi-role, password reset).
    - Payments: core features done. Migration to v3 SDK planned.
    - Notifications: polling implementation stable. Push notification setup pending.
    - Events API: 80% complete.
    - Web UI: organiser dashboard in progress.
    - Deploy: staging live. Production deploy planned for 1 Apr.

    ## Advisor Notes
    - Prof. Nair: "Good progress. Document everything — I want handover-ready docs by March."

    ## Risks
    - Deploy process is only fully known to Riya.
    - Push notification keys: no one has FCM console access.

    ## Action Items
    - [Riya] Write deploy runbook.
    - [Meena] Resolve FCM key access.
    """).strip()),

    # meeting-06 — P2: conflict planted here
    ("2026-02-09", "Meeting 06 — Payments Migration Planning", dedent("""
    **Date:** 9 Feb 2026
    **Attendees:** Riya, Kabir, Dev

    ## Agenda
    - Plan the Stripe v2 → v3 SDK migration

    ## Decision
    - **Payments migration to the new gateway is on 20 Feb 2026.**
    - Kabir leads testing. Riya to review the PR before merging.
    - Rollback: revert to v2 SDK branch if issues arise.

    ## Notes
    - Riya: "The v3 SDK has breaking changes in the webhook handler. Plan extra time."
    - Dev: "I'll set up the staging environment for migration testing."

    ## Action Items
    - [Kabir] Migration PR by 18 Feb.
    - [Riya] Review and merge by 20 Feb.
    - [Dev] Staging test environment ready by 15 Feb.
    """).strip()),

    # meeting-07 — P6: personal data planted here
    ("2026-02-23", "Meeting 07 — Sprint 4 Review", dedent("""
    **Date:** 23 Feb 2026
    **Attendees:** Riya, Dev, Sara, Kabir, Meena

    ## Notes
    - Payments migration postponed (see issue #31).
    - Auth: GDPR deletion endpoint in progress. Riya handling.
    - Web UI: mobile responsiveness done.
    - Notifications: push notification keys still blocked.

    ## Contact Information (for handover)
    - Riya's personal email: riya.example@example.org
    - Riya's phone: +91 00000 00000
    - Contact for auth and deploy questions post-departure.

    ## Action Items
    - [Riya] Complete deploy runbook before 15 Mar.
    - [Dev] Identify who takes over deploy after Riya.
    """).strip()),

    # meeting-08
    ("2026-03-02", "Meeting 08 — Pre-Departure Planning", dedent("""
    **Date:** 2 Mar 2026
    **Attendees:** Riya, Dev, Sara, Kabir, Meena

    ## Agenda
    - Plan for Riya's departure on 15 Mar 2026.

    ## Notes
    - Riya will leave on 15 Mar.
    - Open items:
      - Deploy runbook (in progress).
      - Auth GDPR endpoint (in progress, hand off to Meena).
      - Payments migration (postponed, hand off to Kabir).
      - FCM push key (blocked, no owner).
    - Sara to continue as main auth reviewer post-Riya.

    ## Handover Plan
    - Dev: takes over deploy/ (needs Riya's runbook).
    - Kabir: takes over payments/.
    - Meena: takes over auth/ (with Sara's support).
    - Notifications stale since late Jan — needs attention.

    ## Action Items
    - [Riya] Finalise runbook by 12 Mar.
    - [Dev] Review deploy/ codebase with Riya this week.
    - [All] Review handover tasks by 14 Mar.
    """).strip()),

    # meeting-09
    ("2026-03-09", "Meeting 09 — Final Handover Checklist", dedent("""
    **Date:** 9 Mar 2026
    **Attendees:** Riya, Dev, Kabir

    ## Handover Status
    - Deploy runbook: 70% done. Riya pushing final version by 12 Mar.
    - Payments: Kabir has context. Migration blocked on testing.
    - Auth: Meena is ramping up. Sara as backup reviewer.
    - Deploy: Dev will own after 15 Mar. ONE known gap — secrets vault config.

    ## Open Risks
    1. deploy/ has no documentation except Riya's internal notes.
    2. Push notification keys: still no owner.
    3. Payments migration: needs re-scoping.

    ## Action Items
    - [Riya] Push runbook to docs/ by 12 Mar.
    - [Dev] Confirm access to production servers.
    - [Kabir] Own payments migration in April sprint.
    """).strip()),

    # meeting-10
    ("2026-03-14", "Meeting 10 — Riya's Last Day Handover", dedent("""
    **Date:** 14 Mar 2026
    **Attendees:** Riya, Dev, Sara, Kabir, Meena

    ## Final Handover Notes from Riya

    ### Auth
    - JWT is the auth mechanism. Sessions were rejected due to load failures in the Oct demo.
    - Sara knows the codebase well — she reviewed all PRs.
    - Remaining: GDPR deletion endpoint (hand to Meena).

    ### Payments
    - Stripe v2 SDK in use. Migration to v3 is planned but postponed.
    - Kabir has context on the gateway. See issue #31 for migration status.

    ### Deploy
    - Deploy process is in deploy/. Runbook is partial — some steps are undocumented.
    - Dev: please read the nginx and docker-compose configs carefully.
    - Vault config is NOT documented. Ask me via email if urgent.

    ### Notifications
    - Polling implementation is stable. No changes since late January.
    - FCM push key is unresolved — nobody has console access.

    ### General
    - Prof. Nair is the advisor. Contact via university portal.
    - Run all tests before any production deploy.

    ## Risks Riya Flagged
    - deploy/ is effectively sole knowledge.
    - Payments migration has a conflict in the docs — refer to issue #31.
    - Push notification setup is fully blocked.
    """).strip()),
]


def write_notes():
    for i, (dt, title, content) in enumerate(MEETING_NOTES, 1):
        fname = f"meeting-{i:02d}.md"
        (OUT / "notes" / fname).write_text(
            f"# {title}\n\n{content}\n", encoding="utf-8"
        )


# P7: restricted advisor note
ADVISOR_NOTE = dedent("""
# Advisor Private Note — RESTRICTED

**Date:** 10 Feb 2026
**From:** Prof. Nair (Advisor)
**To:** Project Lead (Dev)

This note is restricted and not for general circulation.

## Performance Concern

There is a concern about the engagement level of one team member in recent sprints.
The member's contributions to web-ui have slowed and meeting attendance has dropped.
Please monitor the situation and consider a one-on-one check-in.

This is a preliminary observation and should be treated sensitively.

*— Prof. Nair*
""").strip()

# P8: confidential budget note
BUDGET_NOTE = dedent("""
# Budget — CONFIDENTIAL

**Date:** 15 Jan 2026
**Classification:** Confidential

## Vendor Contract Details

| Vendor | Service | Annual Cost |
|--------|---------|-------------|
| FictionalCloud Inc. | Hosting (VM + storage) | ₹1,20,000 |
| FictionalSend Corp. | Email delivery (SendGrid tier) | ₹18,000 |
| FictionalPay Ltd. | Payment gateway fees (est.) | ₹24,000 |

**Total estimated annual cost: ₹1,62,000**

This information is confidential and must not be shared with team members outside
the project lead and advisor. Contract renewal due: 30 Sep 2026.

*— Finance Committee*
""").strip()


# ---------------------------------------------------------------------------
# 6. manifest.json
# ---------------------------------------------------------------------------

MANIFEST = {
    "git_log.txt":                   "public",
    "issues.json":                   "public",
    "tasks.csv":                     "team",
    "chat.json":                     "team",
    "notes/meeting-01.md":           "public",
    "notes/meeting-02.md":           "public",
    "notes/meeting-03.md":           "public",
    "notes/meeting-04.md":           "team",
    "notes/meeting-05.md":           "team",
    "notes/meeting-06.md":           "team",
    "notes/meeting-07.md":           "team",
    "notes/meeting-08.md":           "team",
    "notes/meeting-09.md":           "team",
    "notes/meeting-10.md":           "team",
    "notes/advisor-private.md":      "restricted",
    "notes/budget-confidential.md":  "confidential",
}


# ---------------------------------------------------------------------------
# 7. ground_truth.json — NEVER shown to AI
# ---------------------------------------------------------------------------

GROUND_TRUTH = {
    "_warning": "NEVER pass this file to any LLM. Used only for backtest scoring.",
    "sole_knowledge_modules": [
        "deploy sole knowledge risk Riya 13 of 14 commits",
    ],
    "key_decisions": [
        "JWT chosen over sessions because sessions failed under load in demo",
        "websockets reverted to polling because websockets broke on campus wifi",
        "payments migration postponed to next sprint",
    ],
    "critical_contacts": [
        "Sara reviewed most of Riya auth PRs main reviewer",
        "Kabir taking over payments after Riya departure",
        "Dev taking over deploy after Riya departure",
        "Meena taking over auth after Riya departure",
    ],
    "open_risks": [
        "deploy module sole knowledge risk undocumented steps",
        "push notification keys missing owner blocked",
        "payments migration conflict meeting-06 vs issue-31 postponed",
        "notifications stale module no commits 45 days before cutoff",
    ],
    "post_cutoff_events": [
        "Dev takes over deploy April 2026 hits two failures two reverts",
        "Kabir takes over payments migration decision reopened April issue",
        "Meena takes over auth April bug explained by JWT decision",
        "notifications reverted and reworked May 2026",
    ],
    "modules_should_not_flag": [
        "web-ui well covered Sara Meena",
        "docs well covered Dev Kabir",
    ],
    "planted_items": {
        "P1_jwt_decision_chat_only": "Nov 2025 chat — sessions failed under load in the demo",
        "P2_conflict_migration": "meeting-06 says 20 Feb; issue #31 says postponed",
        "P3_sole_knowledge_deploy": "14 commits: 13 Riya, 1 Dev typo fix",
        "P4_missing_owner_task": "Set up push notification keys — empty owner, status blocked",
        "P5_fake_secret": "sk_test_FAKE_0000000000EXAMPLE in meeting-04 and one commit",
        "P6_personal_data": "riya.example@example.org and +91 00000 00000 in meeting-07",
        "P7_restricted_note": "notes/advisor-private.md — performance concern",
        "P8_confidential_note": "notes/budget-confidential.md — vendor contract amounts",
        "P9_reverted_work": "Use websockets → Revert: switch to polling",
        "P10_stale_module": "notifications/ last commit 28 Jan 2026, cutoff 29 Jan 2026",
        "P11_contact": "Sara reviewed most of Riya's auth PRs",
    },
}


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print(f"Generating synthetic sample data into {OUT} ...")

    # git log
    git_log = gen_git_log()
    (OUT / "git_log.txt").write_text(git_log, encoding="utf-8")
    commit_count = git_log.count("\ncommit ")
    print(f"  git_log.txt          — {commit_count + 1} commits")

    # issues
    issues = gen_issues()
    (OUT / "issues.json").write_text(json.dumps(issues, indent=2), encoding="utf-8")
    print(f"  issues.json          — {len(issues)} issues")

    # tasks
    tasks = gen_tasks()
    with open(OUT / "tasks.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=TASK_FIELDS)
        writer.writeheader()
        writer.writerows(tasks)
    print(f"  tasks.csv            — {len(tasks)} tasks")

    # chat
    chat = gen_chat()
    (OUT / "chat.json").write_text(json.dumps(chat, indent=2), encoding="utf-8")
    print(f"  chat.json            — {len(chat)} messages")

    # notes
    write_notes()
    (OUT / "notes" / "advisor-private.md").write_text(ADVISOR_NOTE, encoding="utf-8")
    (OUT / "notes" / "budget-confidential.md").write_text(BUDGET_NOTE, encoding="utf-8")
    note_count = len(list((OUT / "notes").glob("*.md")))
    print(f"  notes/               — {note_count} files (meeting-01..10 + advisor-private + budget-confidential)")

    # manifest
    (OUT / "manifest.json").write_text(json.dumps(MANIFEST, indent=2), encoding="utf-8")
    print(f"  manifest.json        — {len(MANIFEST)} entries")

    # ground truth
    (OUT / "ground_truth.json").write_text(json.dumps(GROUND_TRUTH, indent=2), encoding="utf-8")
    print(f"  ground_truth.json    — {len(GROUND_TRUTH['planted_items'])} planted items recorded")

    # README
    (OUT / "README.md").write_text(dedent("""
    # Sample Data — Campus Event App

    > ⚠️ **Everything in this folder is FICTIONAL and GENERATED.**
    > No real people, organisations, keys, or data are represented.
    > Generated deterministically by `backend/data/generate_sample.py` (seed=42).

    ## Project
    **Campus Event App** — a fictional student project to manage campus events.

    ## Fictional Team
    | Name | Role |
    |------|------|
    | Riya | Backend lead (leaver — departs 15 Mar 2026) |
    | Dev | Full-stack developer |
    | Sara | Frontend developer |
    | Kabir | Backend developer |
    | Meena | Notifications developer |
    | Prof. Nair | Academic advisor |

    ## Files
    | File | Kind | Access |
    |------|------|--------|
    | git_log.txt | git log | public |
    | issues.json | issue tracker | public |
    | tasks.csv | task board | team |
    | chat.json | team chat | team |
    | notes/meeting-01..10.md | meeting notes | public/team |
    | notes/advisor-private.md | advisor note | restricted |
    | notes/budget-confidential.md | finance note | confidential |
    | manifest.json | access levels | — |
    | ground_truth.json | backtest oracle | NEVER shown to AI |

    ## Planted Items
    See `ground_truth.json` for the full list. Highlights:
    - **P1** JWT decision: in chat only (Nov 2025)
    - **P2** Conflict: migration date in meeting-06 vs issue #31
    - **P3** Sole knowledge: deploy/ — 13/14 commits by Riya
    - **P4** Missing owner: "Set up push notification keys"
    - **P5** Fake secret: `sk_test_FAKE_0000000000EXAMPLE`
    - **P6** Personal data: fake email + phone in meeting-07
    - **P7** Restricted note: advisor-private.md
    - **P8** Confidential note: budget-confidential.md
    - **P9** Reverted work: websockets → polling
    - **P10** Stale module: notifications/ (no commits since 28 Jan)
    - **P11** Contact: Sara reviewed most of Riya's auth PRs
    """).strip(), encoding="utf-8")
    print(f"  README.md            — written")
    print(f"\nDone. All files are fictional. Seed={SEED}.")


if __name__ == "__main__":
    main()

