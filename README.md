# Backstop

**Every claim shows its source quote and a status. A human approves before handover.**

Backstop turns a departing engineer's scattered activity (git log, issues, meeting notes, tasks and chat) into a checked, role-gated handover. Every statement it makes carries proof: either a deterministic calculation over the history, or an exact quote from a source record. A lead approves, corrects or rejects each claim before the successor sees it.

**Live demo:** https://backstop-redesign.onrender.com · **Demo script:** [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md) · **Screenshots:** [every screen, from sign-in on](#4a-screenshots)

> **Demo notice.** Everyone signs in: team members at `/login`, admins at `/admin/login`. The demo deployment has a ready-made organisation: `admin` (password `admin`), plus `manager`, `lead`, `dev`, `pm`, `lead2`, `dev2` and `pm2` (password `backstop-demo`). See [Sign-in and roles](#10a-sign-in-and-roles). The sample project and everyone in it are fictional. The real-project backtest uses the public, MIT-licensed history of [mochajs/mocha](https://github.com/mochajs/mocha) with every contributor pseudonymised.

---

## Contents

1. [The problem](#1-the-problem)
2. [What is built](#2-what-is-built)
3. [Run it locally](#3-run-it-locally)
4. [A five-minute tour](#4-a-five-minute-tour)
    - [Screenshots](#4a-screenshots)
5. [Architecture](#5-architecture)
6. [Changes since Round 2](#6-changes-since-round-2)
7. [Results, stated honestly](#7-results-stated-honestly)
8. [Testing](#8-testing)
9. [Deployment](#9-deployment)
10. [Repository layout](#10-repository-layout)
    - [Sign-in and roles](#10a-sign-in-and-roles)
11. [Limitations](#11-limitations)
12. [Roadmap](#12-roadmap)
13. [Documentation index](#13-documentation-index)
14. [Team and tool disclosure](#14-team-and-tool-disclosure)

---

## 1. The problem

When a core team member leaves, the team falls off an *information cliff*. Wiki pages are stale, key knowledge was never written down, and the successor spends weeks guessing why things are the way they are. Well-meant handovers also leak: pasted chats and notes carry passwords, personal details and confidential plans to people who should not see them.

Backstop gives the successor a handover they can trust, and gives the team a way to see where knowledge is most at risk before the person has gone.

## 2. What is built

| Area | What it does | Where |
|---|---|---|
| **Ingest** | Reads git logs, issues (JSON), notes (Markdown), tasks (CSV) and chat (JSON) into line-numbered chunks. Upload hardening: 5 MB limit, extension allow-list, sanitised names, text-only parsing. | `backend/app/ingest.py` |
| **Redaction barrier** | Masks API keys, tokens, passwords, emails and phone numbers before any text leaves the server. | `backend/app/redact.py` |
| **Derived claims** | Plain code computes module ownership, sole-knowledge risk (≥ 70 % share and ≤ 1 other contributor), staleness, reverted work, missing owners and a knowledge-at-risk score. No model is involved. | `backend/app/derived.py` |
| **Interpreted claims** | A swappable language-model provider extracts decisions, reasons and blockers. Every claim must quote its source word for word. Production runs with `LLM_PROVIDER=none` from a committed cache. | `backend/app/llm.py`, `backend/data/cache/` |
| **Verification** | Fails closed. The quote must be an exact substring of the original text; a deterministic detail check requires every number, date and name in the claim to appear in the quote; a support check grades the rest. Disagreeing sources are marked *Conflicting*; gaps become *Missing evidence*. | `backend/app/verify.py`, `backend/app/detailcheck.py` |
| **Review queue** | Approve, correct (new version, audit entry) or reject with a reason. Keyboard review, search, conflict view, shareable claim links. | `backend/app/review.py`, `ReviewQueuePage.jsx` |
| **Role-gated handover** | Each claim takes the strictest access level of its evidence. Lower roles get a locked placeholder with no text or quote. Rule-based Day 1 / Week 1 / Month 1 plan, receipt acknowledgement and print. | `backend/app/views.py`, `HandoverPage.jsx` |
| **Debrief and readiness** | Turns gaps into questions for the person leaving. Answers come back as new claims awaiting review. A weighted readiness score shows what is left. | `backend/app/debrief.py` |
| **Your own projects** | Create a project, paste or upload records, import a public GitHub history, and build claims. Works offline with keyword rules. | `backend/app/workspace.py`, `backend/app/rules.py` |
| **Repository map** | Draws the project's git history as an animated file tree. Bud size is how often a file changed; colour is the leaver's share, edit count or top author; marks show tripwires and claims. *Replay history* grows the tree commit by commit. | `backend/app/repomap.py`, `RepoMap.jsx` |
| **Sign-in and accounts** | Separate team and admin sign-in pages, server-side sessions, an Accounts page for admins. The server refuses any role the account may not act as. | `backend/app/auth.py`, `LoginPage.jsx`, `AccountsPage.jsx` |
| **Backtest** | Scores the risk ranking against what happened after the departure, on the sample and on real mocha history, against two simple baselines. | `backend/app/backtest.py`, `backend/app/realbacktest.py` |
| **Trust report** | A leak harness attacks every API route with every role and tampered role values; a 40-pair labelled set measures the support check. | `backend/tests/trust/`, `docs/TRUST_REPORT.md` |
| **Tripwires** | *Check a change*: paste file paths or a diff and get evidence-linked warnings about reverted work, recorded decisions and sole-knowledge areas, within the caller's access level. | `backend/app/tripwires.py`, `CheckChangePage.jsx` |

## 3. Run it locally

**Requirements:** Python 3.11+, Node 20+, git.

```bash
git clone https://github.com/itzz-inbathamizhanS/BackStop.git
cd BackStop

# Backend
python -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                 # leave LLM_PROVIDER=none to run fully offline

# Frontend (build once; FastAPI serves frontend/dist)
npm --prefix frontend ci
npm --prefix frontend run build

# Start
uvicorn app.main:app --reload --port 8000 --app-dir backend
```

Open <http://localhost:8000>. The sample project seeds itself on first start.

**Frontend with hot reload:** run the backend as above, then `npm --prefix frontend run dev` and open <http://localhost:5173>. Vite proxies `/api` to port 8000 (see `frontend/vite.config.js`).

**Docker:**

```bash
docker build -t backstop .
docker run -p 8000:8000 backstop
```

### Configuration

| Variable | Default | Purpose |
|---|---|---|
| `LLM_PROVIDER` | `none` | `none` reads the committed cache and makes no network calls. Other values switch to a live provider (see `backend/app/llm.py`). |
| `LLM_API_KEY` | – | Key for a live provider. Not needed with `none`. |
| `LLM_MODEL` | `gemini-3.5-flash-lite` | Model name for a live provider. Read from the environment only. |
| `LLM_DAILY_CALL_LIMIT` | `50` | Cost guard for live calls. |
| `DATABASE_URL` | `sqlite:///backend/backstop.db` | Database location. |
| `CORS_ORIGINS` | `localhost:5173`, `localhost:3000` | Comma-separated list of extra allowed origins. The built app is same-origin and needs none. |

## 4. A five-minute tour

1. **Overview.** Load the sample project (*Campus Event App*, leaver *Riya*). Sources are parsed, masked and indexed, and claims are built.
2. **Check the claims.** Claims are sorted by risk. Select one to see its quote highlighted in the source, its verification status and its version history. Approve, edit or reject.
3. **Debrief.** See the questions the person leaving should answer, record an answer, and watch handover readiness change.
4. **Handover.** Switch roles. An incoming developer sees locked placeholders where an incoming project manager or lead sees text. Read the Day 1 / Week 1 / Month 1 plan, acknowledge receipt, print.
5. **Did it work?** *Backtest* (sample and mocha), *Trust report*, and *Check a change*.
6. **Projects and Records.** Start your own project, add records or a public GitHub history, build claims from them, and see the history as a file tree.

The full spoken walkthrough with timings is in [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md).

Press <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>K</kbd> anywhere to jump to a page or a claim.

## 4a. Screenshots

Every screen, in the order a first-time visitor meets it: sign in, read the records, check the claims, ask the debrief questions, hand over, then see whether it worked. All shots are from the synthetic sample project (*Campus Event App*, leaver *Riya*) running locally. The path is `docs/screenshots/tour/`.

### Sign in

<table>
<tr>
<td width="50%"><img src="docs/screenshots/tour/01-team-sign-in.jpg" alt="Team sign-in page"></td>
<td width="50%"><img src="docs/screenshots/tour/24-admin-sign-in.jpg" alt="Admin sign-in page"></td>
</tr>
<tr>
<td><b>1. Team sign-in.</b> Leads, new developers and new project managers sign in at <code>/login</code>. The demo accounts are listed under the form.</td>
<td><b>2. Admin sign-in.</b> Admins have their own page at <code>/admin/login</code>. The server, not the page, decides what each account may see.</td>
</tr>
</table>

### 3. Overview

![Overview page](docs/screenshots/tour/02-overview.jpg)

The landing page after sign-in. The card on the right is a real claim from this project with its exact source quote. The *Sheet index* shows every claim as one square (none checked yet), and *Handover readiness* starts at 0 of 100 with 23 questions waiting for Riya.

### 4. Records

![Records page](docs/screenshots/tour/03-records.jpg)

Everything Backstop read about Riya's work: the git log, issues, tasks, chat and meeting notes. Each record shows how many parts it was split into and its access level (*Public*, *Team* or *Restricted*). One admin-only record is hidden from the lead.

### Repository map

<table>
<tr>
<td width="50%"><img src="docs/screenshots/tour/04-repository-map.jpg" alt="Repository map"></td>
<td width="50%"><img src="docs/screenshots/tour/05-repository-map-replay.jpg" alt="Repository map during replay"></td>
</tr>
<tr>
<td><b>5. Repository map.</b> 126 files across 162 commits drawn as a tree. A bud's size is how often the file changed and its colour is Riya's share. Diamonds are tripwires and squares are claims. The side panel shows who edited the selected folder.</td>
<td><b>6. Replay history.</b> The same tree grows commit by commit, so you can watch where Riya's knowledge piled up over time.</td>
</tr>
</table>

### 7. Check the claims

![Review queue](docs/screenshots/tour/06-check-the-claims.jpg)

The review queue: 99 claims, highest risk first. The selected claim (#16, an unowned blocked task) shows the exact line of `tasks.csv` it came from. A lead approves, corrects or rejects it, by mouse or with the keys <kbd>A</kbd>, <kbd>E</kbd>, <kbd>R</kbd>, and moves on with <kbd>J</kbd>/<kbd>K</kbd>.

### 8. A conflicting claim

![Conflicting claim with both sources side by side](docs/screenshots/tour/07-conflicting-claim.jpg)

When two sources disagree, Backstop does not pick one. Claim #17 shows `meeting-06.md` (payments migration set for 20 Feb) next to `meeting-07.md` (postponed), and a person decides which is current.

<table>
<tr>
<td width="50%"><img src="docs/screenshots/tour/08-reject-with-reason.jpg" alt="Reject dialog"></td>
<td width="50%"><img src="docs/screenshots/tour/09-approve-all-dialog.jpg" alt="Approve all quote-matched dialog"></td>
</tr>
<tr>
<td><b>9. Reject with a reason.</b> A rejection needs a written reason. It is kept in the claim's history and the claim stays out of the handover.</td>
<td><b>10. Approve the quote-matched claims.</b> One click approves the 93 claims whose quote was found word for word. Conflicting, inferred and missing-evidence claims are skipped.</td>
</tr>
</table>

### 11. After approval

![Review queue after approval](docs/screenshots/tour/10-claims-approved.jpg)

93 of 99 claims are now decided. The 6 left, such as the conflict, the inferred claims and the missing evidence, still need a person to look at them.

### 12. Debrief questions

![Debrief questions](docs/screenshots/tour/11-debrief-questions.jpg)

What the records could not settle, turned into questions for Riya before 15 March 2026. Readiness is now 65 of 100. Each answer recorded here becomes a new claim, checked like any other. The list can be copied, downloaded or printed.

### The handover, by role

![Handover for a new developer](docs/screenshots/tour/12-handover-new-developer.jpg)

**13. Handover for a new developer.** Built only from approved claims: 79 items in a Day 1, Week 1 and Month 1 plan. Each item carries its access level.

<table>
<tr>
<td width="50%"><img src="docs/screenshots/tour/13-handover-new-pm.jpg" alt="Handover for a new project manager"></td>
<td width="50%"><img src="docs/screenshots/tour/14-handover-lead.jpg" alt="Handover for a lead"></td>
</tr>
<tr>
<td><b>14. New project manager.</b> The same claims, picked for a PM: owners, blockers, open questions and next actions (60 items).</td>
<td><b>15. Lead.</b> The lead sees restricted items in full (93 items).</td>
</tr>
</table>

### 16. Sign for receipt

![Sign for receipt dialog](docs/screenshots/tour/15-sign-for-receipt.jpg)

The new owner signs to say they received the handover. The signature is recorded and counts toward readiness.

### Check a change (tripwires)

<table>
<tr>
<td width="50%"><img src="docs/screenshots/tour/16-check-a-change.jpg" alt="Check a change result"></td>
<td width="50%"><img src="docs/screenshots/tour/17-tripwire-replay.jpg" alt="Tripwire replay on past history"></td>
</tr>
<tr>
<td><b>17. Check a change.</b> Paste file paths or a diff before editing inherited code. Here "rewrite the deploy scripts" trips a sole-knowledge warning on <code>deploy/</code>, with the quotes behind it and who to ask (Dev). Claims above the reader's access are left out.</td>
<td><b>18. Do tripwires work?</b> The tripwires are replayed on later history. On the real mocha project they catch 40 of 45 later problem commits (88.9 % recall) at 36.7 % precision, only a little better than the simple baseline. The page says so.</td>
</tr>
</table>

### 19. Backtest

![Backtest page](docs/screenshots/tour/18-backtest.jpg)

Scores the risk ranking against what really happened after the departure. On the sample, 4 of 7 modules ran into trouble and Backstop's F1 is 0.763, the same as the commit-count baseline; the limits are stated on the page. Switch to *mocha (real project)* for the real-history result.

### 20. Trust report

![Trust report](docs/screenshots/tour/19-trust-report.jpg)

A leak harness called every API route as every role, plus tampered roles: 1,563 attacks, 1,563 blocked, 0 leaked. The table lists the leaks found in older code and how each was fixed.

<table>
<tr>
<td width="50%"><img src="docs/screenshots/tour/20-projects.jpg" alt="Projects page"></td>
<td width="50%"><img src="docs/screenshots/tour/21-search-palette.jpg" alt="Search palette"></td>
</tr>
<tr>
<td><b>21. Projects.</b> One project per person leaving. <i>New project</i> starts your own: paste or upload records, or import a public GitHub history.</td>
<td><b>22. Search.</b> <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>K</kbd> jumps to any page or claim. Here "payments" finds every claim that mentions it.</td>
</tr>
</table>

### What a newcomer sees

<table>
<tr>
<td width="50%"><img src="docs/screenshots/tour/22-dev-handover.jpg" alt="Handover as the dev account"></td>
<td width="50%"><img src="docs/screenshots/tour/23-dev-locked-screen.jpg" alt="Review screen locked for a developer"></td>
</tr>
<tr>
<td><b>23. Signed in as a developer.</b> Only their own handover view is offered, and the menu drops the reviewer screens.</td>
<td><b>24. Reviewer screens are locked.</b> Opening the review queue by its address shows a short note instead. The server refuses the data too.</td>
</tr>
</table>

### 25. Accounts (admin)

![Accounts page](docs/screenshots/tour/25-admin-accounts.jpg)

Admins create accounts, change roles, set passwords, and disable or delete accounts.

### Phone width

<table>
<tr>
<td width="50%"><img src="docs/screenshots/tour/26-phone-check-the-claims.jpg" alt="Review queue on a phone"></td>
<td width="50%"><img src="docs/screenshots/tour/27-phone-handover.jpg" alt="Handover on a phone"></td>
</tr>
<tr>
<td><b>26. Review queue on a phone.</b></td>
<td><b>27. Handover on a phone.</b></td>
</tr>
</table>

Every page for every demo account, at desktop and phone width, is also in [docs/screenshots/](docs/screenshots/). To take these again, start the app with `DEMO_ACCOUNTS=1` on a fresh database and run `node frontend/scripts/tour-shots.cjs http://localhost:8000` (the tour approves the quote-matched claims, so the handover has content).

## 5. Architecture

One service: FastAPI serves the REST API under `/api` and the built React app from `frontend/dist`. SQLite (via SQLModel) holds sources, chunks, claims, versions and the audit log.

```
 Records (git log, issues, notes, tasks, chat, GitHub import)
        │
        ▼
 Ingest ── line-numbered chunks, original text kept for quote checks
        │
        ├──────────────────────────────┬───────────────────────────────┐
        ▼                              ▼                               ▼
 Derived engine (plain code)    Redaction barrier               Keyword rules (offline)
 ownership, sole knowledge,            │                               │
 staleness, reverted work,             ▼                               │
 missing owners, risk score     Extractor (cache or live)              │
        │                              │                               │
        │                              ▼                               │
        │                      Verification (fail closed):            │
        │                      exact substring → detail check →        │
        │                      support check → conflict / missing      │
        └──────────────┬───────────────┴───────────────────────────────┘
                       ▼
             Claim ledger + audit log
             access level = strictest evidence
                       │
          ┌────────────┼──────────────┬────────────────┐
          ▼            ▼              ▼                ▼
    Review queue    Debrief &     Tripwires       Backtest &
    (human sign-    readiness     (check a        trust report
     off)                          change)
          │
          ▼
    Role-gated handover (locked placeholders, Day 1 / Week 1 / Month 1, receipt)
```

More detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and the full API list in [docs/API.md](docs/API.md).

## 6. Changes since Round 2

Round 3 was delivered by a new team. Each change below is in the commit history.

**Promised improvements**

1. **Real-project backtest and GitHub import.** A pseudonymised mocha dataset (1,537 commits, 243 contributors), rules fixed before results were computed, two baselines and control cutoffs. Any public GitHub repository can be analysed from the Backtest page with time, size and concurrency limits. See [docs/BACKTEST_METHOD.md](docs/BACKTEST_METHOD.md).
2. **Trust test suite.** A leak harness that attacks every route as every role found 126 real leaks; all were fixed and are guarded by tests. A 40-pair labelled set and a new deterministic detail check measure the support check. See [docs/TRUST_REPORT.md](docs/TRUST_REPORT.md).
3. **Tripwires.** *Check a change* warns before someone edits an area with known history, with every warning linked to its evidence and limited to the caller's access level. Replayed on mocha and on the sample. See [docs/TRIPWIRES.md](docs/TRIPWIRES.md).

**Reliability and trust fixes**

- Claim verification now fails closed, and planted demo results were removed.
- Claim access is recomputed from evidence, so a claim can never be less restricted than its sources.
- Safe resets: resetting the sample cannot wipe user projects.

**New product features**

- Debrief questions, recorded answers and a handover readiness score ([docs/DEBRIEF.md](docs/DEBRIEF.md)).
- Real projects: create, add records, import GitHub history, build claims offline ([docs/WORKSPACES.md](docs/WORKSPACES.md)).
- Clearer review queue with a conflict view, keyboard review, search, shareable claim links and a command palette.
- A new visual design, documented in [docs/design/DESIGN.md](docs/design/DESIGN.md).

The full list is in [CHANGELOG.md](CHANGELOG.md).

## 7. Results, stated honestly

| Measure | Result |
|---|---|
| Leak attacks (every route × every role × tampered values) | Before fixes: 1,290 attacks, **126 leaks**. After: 1,563 attacks across 49 endpoints, **0 leaks** |
| Detail check on 40 labelled claim/quote pairs | Caught **5 of 5** invented details, **0** correct claims rejected. Cannot catch right words with the wrong meaning |
| Backtest, synthetic sample | Backstop's ranking finds the troubled modules (overall F1 0.76). The data is generated, so this is a demonstration, not evidence |
| Backtest, real mocha history | Backstop's top 5 hit **0 of 8** troubled modules; a plain commit count got **5 of 5**. Backstop over-weights small test folders the leaver owned alone |
| Candidate score v2 on mocha (share × √commits) | Top 5 hit **4 of 5** at the real departure and at all three control dates, up from 0 or 1 for today's score. The commit count still gets 5 at three of the four dates and ties at 4 on the fourth. v2 was chosen after seeing the mocha result, so this is in-sample; it is shown on the Backtest page but not used for claims yet |
| Tripwire replay on mocha | 36.7 % precision against a 31.7 % base rate, 89 % recall. Useful as a warning, too noisy to block changes |

The real-project numbers are weak, and we report them as they are. One project and one departure is a case study, not proof either way.

## 8. Testing

```bash
cd backend
python -m pytest -q          # 233 tests
cd ../frontend
npm run lint && npm run build
```

The suite covers access control, redaction, derived metrics, verification, review and views, the API pipeline, debrief, workspaces, GitHub import, both backtests, tripwires, cache stability and the trust harness. GitHub Actions runs it on every push and pull request (`.github/workflows/ci.yml`). Details and the manual test matrix: [docs/TESTING.md](docs/TESTING.md).

## 9. Deployment

Backstop runs as one web service on Render. Docker is recommended because GitHub import needs `git` in the image.

- **Docker (recommended):** point Render at the `Dockerfile`. No build or start command needed.
- **Native Python:** `render.yaml` builds the frontend, installs Python dependencies and starts `uvicorn app.main:app --app-dir backend`.

The app seeds the sample project on first start, adds security headers, rate-limits upload and extraction, and exposes `GET /healthz`. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## 10. Repository layout

```
BackStop/
├── backend/
│   ├── app/            FastAPI app: ingest, redact, derived, verify, review, views,
│   │                   debrief, workspace, tripwires, backtest, trust, GitHub import
│   ├── data/
│   │   ├── sample/     Fictional Campus Event App records + ground truth
│   │   ├── real/mocha/ Pseudonymised mocha history and saved backtest result
│   │   ├── trust/      Saved leak, support-check and tripwire replay reports
│   │   └── cache/      Committed extractor responses for offline runs
│   ├── scripts/        Dataset export, tripwire replay, support-check evaluation
│   └── tests/          pytest suite, including tests/trust/
├── frontend/           React 19 + Vite + Tailwind single-page app
├── docs/               Method, trust, tripwire, testing and design documents
├── .github/            CI workflow, pull request and issue templates
├── Dockerfile          Two-stage build: frontend, then Python service
├── render.yaml         Render blueprint (native Python)
└── requirements.txt    Python dependencies
```

## 10a. Sign-in and roles

| Who | Signs in at | Can |
|---|---|---|
| Admin | `/admin/login` | Everything: every project, every access level, accounts (`#/accounts`), and teams on the Teams page (`#/team`) |
| Manager | `/login` | Oversee several teams: every project and person in them, who works on what and their recent activity; review claims like a lead |
| Lead | `/login` | Run one team: its projects and members, tick which team projects each member works on, review claims, edit records |
| Member (developer or project manager) | `/login` | Only the projects assigned to them: read the handover and check a change; reviewer screens are closed |

**Teams and projects.** A team has a manager, a lead, members and projects. Leads and managers reach a project through their team; members reach only the projects their lead (or a manager or admin) ticks for them. A request for any other project gets `404`, as if it did not exist. A project a lead creates joins their team. The Team page (`#/team`) shows who is under whom, which projects each person works on, and what they last did and where (read the handover, approved a claim, added a record), with a recent-activity feed.

**Demo organisation** (with `DEMO_ACCOUNTS=1`):

| Username | Password | Position |
|---|---|---|
| `admin` | `admin` | Admin (sign in at `/admin/login`) |
| `manager` | `backstop-demo` | Manager of both teams |
| `lead` | `backstop-demo` | Lead, Platform team (Campus Event App) |
| `dev`, `pm` | `backstop-demo` | Members, Platform team |
| `lead2` | `backstop-demo` | Lead, Mobile team (Mobile Check-in App) |
| `dev2`, `pm2` | `backstop-demo` | Members, Mobile team |

- Each page refuses the other kind of account, so an admin cannot sign in through `/login` and a lead cannot sign in through `/admin/login`.
- Passwords are stored as scrypt hashes. A session is a random token kept on the server and sent as an HttpOnly cookie that lasts 12 hours (`SESSION_HOURS`).
- Every `/api` request needs a session. The server refuses any `role` value, in the query or the body, that the signed-in account may not act as, so choosing a role in the browser no longer grants access.
- Changing an account's role or password, or disabling it, ends its open sessions. The last active admin cannot be removed.
- Sign-in attempts are rate-limited to 10 a minute per address and recorded in the audit log.

| Setting | Effect |
|---|---|
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | Create the first admin on an empty database |
| `DEMO_ACCOUNTS=1` | Create the demo organisation above: one manager, two teams, each with a lead and two members |
| `DEMO_PASSWORD` | Password for every demo account except `admin` (default `backstop-demo`) |
| `DEMO_ADMIN_PASSWORD` | Password for the demo `admin` account (default `admin`) |
| `COOKIE_SECURE=1` | Send the session cookie over HTTPS only (set on Render) |

## 11. Limitations

- **Username and password sign-in only.** No SSO, password-reset email or two-factor yet. Admins reset passwords from the Accounts page.
- **Synthetic sample.** Results on the sample show the mechanics, not real-world accuracy.
- **Weak real-world ranking.** On mocha, the knowledge-at-risk score did worse than a plain commit count.
- **Support check not measured live.** The live support check needs a provider key; only the deterministic detail check was evaluated.
- **Single process, SQLite.** Fine for a demo and small teams; not built for many concurrent users.
- **GitHub import is public-only** and capped in size and time.

## 12. Roadmap

| Next | Why |
|---|---|
| Test score v2 on a second real departure, then adopt it for claims if it holds | v2 closes most of the gap to the commit-count baseline on mocha, but only in-sample |
| SSO (GitHub / Google) for sign-in | Let teams use the accounts they already have |
| Live GitHub / GitLab webhooks | Keep claims current instead of importing once |
| Measure the live support check on the labelled set | Close the one open trust measurement |
| Tune tripwires to cut noise | Reach a precision teams will act on |
| Postgres and background jobs | Many projects and users at once |

## 13. Documentation index

| Document | What it covers |
|---|---|
| [docs/README.md](docs/README.md) | Index of every document |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Components, data model, request flow |
| [docs/API.md](docs/API.md) | Every API endpoint |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Render, Docker and configuration |
| [docs/TESTING.md](docs/TESTING.md) | Automated suite and manual test matrix |
| [docs/BACKTEST_METHOD.md](docs/BACKTEST_METHOD.md) | Real-project backtest rules and results |
| [docs/TRUST_REPORT.md](docs/TRUST_REPORT.md) | Leak harness and support-check evaluation |
| [docs/TRIPWIRES.md](docs/TRIPWIRES.md) | Check a change, matching rules, replay |
| [docs/DEBRIEF.md](docs/DEBRIEF.md) | Debrief questions and readiness score |
| [docs/WORKSPACES.md](docs/WORKSPACES.md) | Your own projects and records |
| [docs/USER_GUIDE.md](docs/USER_GUIDE.md) | Plain-language guide, no coding needed |
| [docs/FINAL_REPORT.md](docs/FINAL_REPORT.md) | Content for the final product PDF |
| [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md) | Five-minute demo walkthrough |
| [docs/SUBMISSION_CHECKLIST.md](docs/SUBMISSION_CHECKLIST.md) | Final test plan and submission pack |
| [docs/screenshots/](docs/screenshots/) | Every page at desktop and phone width |
| [docs/PROJECT_DETAILS.md](docs/PROJECT_DETAILS.md) | Round 2 technical specification |
| [docs/design/](docs/design/) | Product brief and design system |
| [CHANGELOG.md](CHANGELOG.md) | What changed, by round |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to work on the code |
| [SECURITY.md](SECURITY.md) | Reporting a security issue |

## 14. Team and tool disclosure

**Round 3 team:** Aasif Ahmed A (lead), Inbathamizhan S, Vedhan S. Backstop was started in Rounds 1 and 2 by the original team.

**Tool disclosure (from Round 2):** This software was developed with the assistance of Google Antigravity / Gemini for rapid prototyping of boilerplate, UI layouts, and test fixtures during a hackathon sprint. All architectural safeguards, deterministic derivations, quote-check verification algorithms, and access controls were verified by the author.
