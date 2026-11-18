# Backstop

**Every claim shows its source quote and a status. A human approves before handover.**

Backstop turns a departing engineer's scattered activity (git log, issues, meeting notes, tasks and chat) into a checked, role-gated handover. Every statement it makes carries proof: either a deterministic calculation over the history, or an exact quote from a source record. A lead approves, corrects or rejects each claim before the successor sees it.

> **Demo notice.** Everyone signs in: team members at `/login`, admins at `/admin/login`. The demo deployment has ready-made accounts (`lead`, `dev`, `pm`, and `admin`), all with the password `backstop-demo`. The sample project and everyone in it are fictional. The real-project backtest uses the public, MIT-licensed history of [mochajs/mocha](https://github.com/mochajs/mocha) with every contributor pseudonymised.

---

## Contents

1. [The problem](#1-the-problem)
2. [What is built](#2-what-is-built)
3. [Run it locally](#3-run-it-locally)
4. [A five-minute tour](#4-a-five-minute-tour)
5. [Architecture](#5-architecture)
6. [Changes since Round 2](#6-changes-since-round-2)
7. [Results, stated honestly](#7-results-stated-honestly)
8. [Testing](#8-testing)
9. [Deployment](#9-deployment)
10. [Repository layout](#10-repository-layout)
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
| **Backtest** | Scores the risk ranking against what happened after the departure, on the sample and on real mocha history, against two simple baselines. | `backend/app/backtest.py`, `backend/app/realbacktest.py` |
| **Trust report** | A leak harness attacks every API route with every role and tampered role values; a 40-pair labelled set measures the support check. | `backend/tests/trust/`, `docs/TRUST_REPORT.md` |
| **Tripwires** | *Check a change*: paste file paths or a diff and get evidence-linked warnings about reverted work, recorded decisions and sole-knowledge areas, within the caller's access level. | `backend/app/tripwires.py`, `CheckChangePage.jsx` |

## 3. Run it locally

**Requirements:** Python 3.11+, Node 20+, git.

```bash
git clone https://github.com/aasifahmed56-glitch/BackStop.git
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
6. **Projects and Records.** Start your own project, add records or a public GitHub history, and build claims from them.

Press <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>K</kbd> anywhere to jump to a page or a claim.

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
| Leak attacks (every route × every role × tampered values) | Before fixes: 1,290 attacks, **126 leaks**. After: 1,357 attacks, **0 leaks** |
| Detail check on 40 labelled claim/quote pairs | Caught **5 of 5** invented details, **0** correct claims rejected. Cannot catch right words with the wrong meaning |
| Backtest, synthetic sample | Backstop's ranking finds the troubled modules (overall F1 0.76). The data is generated, so this is a demonstration, not evidence |
| Backtest, real mocha history | Backstop's top 5 hit **0 of 8** troubled modules; a plain commit count got **5 of 5**. Backstop over-weights small test folders the leaver owned alone |
| Tripwire replay on mocha | 36.7 % precision against a 31.7 % base rate, 89 % recall. Useful as a warning, too noisy to block changes |

The real-project numbers are weak, and we report them as they are. One project and one departure is a case study, not proof either way.

## 8. Testing

```bash
cd backend
python -m pytest -q          # 217 tests
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

## Sign-in and roles

| Who | Signs in at | Can |
|---|---|---|
| Admin | `/admin/login` | Manage accounts on the Accounts page (`#/accounts`), see every access level, act as any role |
| Lead | `/login` | Review claims, edit records and projects, see restricted notes, preview the newcomer handovers |
| New developer / New project manager | `/login` | Read their own handover and check a change; reviewer screens are closed to them |

- Each page refuses the other kind of account, so an admin cannot sign in through `/login` and a lead cannot sign in through `/admin/login`.
- Passwords are stored as scrypt hashes. A session is a random token kept on the server and sent as an HttpOnly cookie that lasts 12 hours (`SESSION_HOURS`).
- Every `/api` request needs a session. The server refuses any `role` value, in the query or the body, that the signed-in account may not act as, so choosing a role in the browser no longer grants access.
- Changing an account's role or password, or disabling it, ends its open sessions. The last active admin cannot be removed.
- Sign-in attempts are rate-limited to 10 a minute per address and recorded in the audit log.

| Setting | Effect |
|---|---|
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | Create the first admin on an empty database |
| `DEMO_ACCOUNTS=1` | Create `admin`, `lead`, `dev` and `pm` for a public demo |
| `DEMO_PASSWORD` | Password for the demo accounts (default `backstop-demo`) |
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
| Re-weight the risk score using the mocha findings, then test on more departures | Make the ranking beat the commit-count baseline before trusting it |
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
| [docs/PROJECT_DETAILS.md](docs/PROJECT_DETAILS.md) | Round 2 technical specification |
| [docs/design/](docs/design/) | Product brief and design system |
| [CHANGELOG.md](CHANGELOG.md) | What changed, by round |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to work on the code |
| [SECURITY.md](SECURITY.md) | Reporting a security issue |

## 14. Team and tool disclosure

**Round 3 team:** Aasif Ahmed A (lead), Inbathamizhan S, Vedhan S. Backstop was started in Rounds 1 and 2 by the original team.

**Tool disclosure (from Round 2):** This software was developed with the assistance of Google Antigravity / Gemini for rapid prototyping of boilerplate, UI layouts, and test fixtures during a hackathon sprint. All architectural safeguards, deterministic derivations, quote-check verification algorithms, and access controls were verified by the author.
