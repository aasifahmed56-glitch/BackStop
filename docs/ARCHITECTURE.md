# Architecture

Backstop is one web service. FastAPI serves the REST API under `/api` and the built React app from `frontend/dist`. SQLite, through SQLModel, stores everything. Nothing needs a network connection when `LLM_PROVIDER=none`.

## Components

| Module (`backend/app/`) | Responsibility |
|---|---|
| `main.py` | App setup, security headers, CORS, rate limits, routers, static files, `GET /healthz`, seeding the sample on first start |
| `db.py`, `models.py` | Engine, session and tables |
| `ingest.py` | Parses git logs, issues, notes, tasks and chat into line-numbered chunks; upload hardening; loads the sample |
| `redact.py` | Masks secrets and personal data before text leaves the server or reaches a lower role |
| `derived.py` | Plain-code claims: ownership, sole knowledge, staleness, reverted work, missing owners, knowledge-at-risk score |
| `llm.py` | Provider switch (`none` reads `backend/data/cache/`), stable cache keys, daily call limit |
| `verify.py`, `detailcheck.py` | Exact-substring quote check, deterministic detail check, support check, conflicts and missing evidence; fails closed |
| `rules.py` | Offline keyword rules used for user projects when no provider is set |
| `review.py` | Review queue, approve / correct / reject, versions, quote context |
| `views.py` | Role-gated handover, locked placeholders, Day 1 / Week 1 / Month 1 plan, acknowledgement, sample reset |
| `debrief.py` | Debrief questions, recorded answers and readiness score |
| `workspace.py` | User projects: create, delete, add or remove records, build claims |
| `githubimport.py` | Public GitHub import: blob-less download of only the needed window of history, falling back to the last year when slow; 10,000 commits; one at a time, 3 per hour per client |
| `realdata.py` | Pseudonymises and cleans real commit histories |
| `backtest.py`, `realbacktest.py` | Sample and real-project backtests against baselines |
| `tripwires.py`, `tripwires_replay.py` | Check a change; saved replay results |
| `trust.py` | Serves the saved trust report |
| `repomap.py` | Repository map: git history as a file tree, module risk, flags and a commit timeline, filtered by role |
| `auth.py` | Sign-in for team members and administrators, sessions, the role guard on every `/api` request, and admin account routes |

## Data model

| Table | Key fields |
|---|---|
| `Project` | name, leaver name, departure date |
| `Source` | project, kind (`git`, `issue`, `note`, `task`, `chat`), name, access level, original text |
| `Chunk` | source, text, author, timestamp, line start and end |
| `Claim` | project, kind (`derived`, `interpreted`, `debrief`, `rule`), type (owner, decision, blocker, risk, dependency, open question, next action, contact), text, evidence, status, confidence, access level, review state, current version |
| `ClaimVersion` | every version of a claim, who changed it, when and why |
| `AuditLog` | review actions, access denials, acknowledgements |
| `LLMCallRecord` | live provider calls per day, for the cost guard |
| `UserAccount`, `LoginSession` | accounts (username, display name, role, scrypt password hash, active flag, last sign-in) and sign-in sessions (hashed token, account, expiry) |

**Access levels:** `public < team < restricted < confidential`. A claim's level is the strictest level of the sources it cites, recomputed from evidence.

**Statuses:** `verified`, `inferred`, `conflicting`, `missing`. **Review states:** `pending`, `approved`, `corrected`, `rejected`.

**Roles:** `incoming_dev`, `incoming_pm`, `lead`, `admin`. Each account has one role and may act as a set of roles (`ACTING_ROLES` in `auth.py`): an admin as any role, a lead as itself or a newcomer, a newcomer only as itself. Every route that returns claim or source text takes a role and enforces its ceiling on the server.

## Request flow: building claims

1. Records arrive by sample load, upload, paste or GitHub import, and are chunked with line numbers. The original text is kept for quote checks.
2. `derived.py` computes claims from git and task data with plain code.
3. The extractor reads redacted chunks (from the cache, a live provider, or keyword rules) and proposes claims with quotes.
4. `verify.py` keeps a claim only if its quote is an exact substring of the original chunk and its details appear in the quote. Otherwise the claim is dropped or marked *Missing evidence*.
5. Claims enter the review queue as *pending*. Only approved or corrected claims reach the handover.

## Request flow: reading the handover

1. Every `/api` request is checked for a session first. `auth.py` refuses a `role` the signed-in account may not act as, so the role the client sends is only ever one it is allowed to use.
2. `views.py` loads approved claims and compares each claim's access level with the role.
3. Claims above the role's level come back as locked placeholders with no text and no quote.
4. Rules place the visible claims into Day 1, Week 1 and Month 1.

## Frontend

React 19, Vite and Tailwind CSS 4. Routing lives in the URL hash, so refresh, back and shared links land on the same screen. Main pages are in `frontend/src/components/`: Home, Review queue, Debrief, Handover, Check a change, Backtest, Trust report, Projects and Records (which draws the repository map), plus a command palette (Ctrl/⌘ + K). Sign-in pages are at `/login` (team members) and `/admin/login` (administrators); the Accounts page for admins is `#/accounts`. Navigation is a slim top bar. `src/api.js` is the only place that calls the API.
