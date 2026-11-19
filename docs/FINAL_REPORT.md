# Backstop: final product report

*Round 3 submission. Team: Aasif Ahmed A (lead), Inbathamizhan S, Vedhan S.*

| | |
|---|---|
| **Live app** | https://backstop-atsu.onrender.com (team accounts `lead`, `dev`, `pm` / `backstop-demo` at `/login`; `admin` / `admin` at `/admin/login`) |
| **Repository** | https://github.com/itzz-inbathamizhanS/BackStop |
| **One line** | Every claim shows its source quote and a status. A human approves before handover. |

> This file is the source text for the final PDF.

---

## 1. Problem

When a core engineer leaves, the team falls off an *information cliff*. Documentation is stale, decisions and their reasons live in one person's head, and the successor spends weeks guessing. Handovers that forward old chats and notes also leak passwords, personal details and confidential plans to people who should not see them.

## 2. Solution

Backstop reads the trail a team already leaves (git history, issues, meeting notes, task lists and chat) and turns it into a ledger of **claims**. Each claim carries proof and passes a human before the successor sees it.

Five rules make it trustworthy:

1. **Numbers come from plain code.** Ownership, sole-knowledge risk, staleness and the risk score are computed, never generated.
2. **Every interpreted claim quotes its source word for word**, and the quote is checked against the original text. If it is not there, the claim is not shown as verified.
3. **Secrets and personal data are masked** before any text leaves the server.
4. **People see only what their role allows.** Claims inherit the strictest access level of their evidence; lower roles see a locked placeholder.
5. **A human approves before handover**, and every change is versioned and audited.

## 3. What a user can do

1. Sign in. Leads and admins review; newcomers see only the handover and checks their role allows.
2. Load the sample project, or create a project and add records (paste, upload, or import a public GitHub history), and see the history as a file tree.
3. See which modules are most at risk now that the person is leaving.
4. Review each claim with its quote highlighted in the source; approve, correct or reject.
5. Send debrief questions to the person leaving, record the answers, and watch handover readiness rise.
6. Open the role-gated handover with a Day 1 / Week 1 / Month 1 plan; acknowledge receipt; print.
7. Before changing code, **Check a change** for tripwires: reverted work, recorded decisions, sole-knowledge areas.
8. See how well Backstop itself works: **Backtest** and **Trust report**.

## 4. Architecture

One FastAPI service serves the API and the React app; SQLite stores sources, chunks, claims, versions and the audit log. The derived engine is plain Python. The extractor runs from a committed cache in production (`LLM_PROVIDER=none`), so the live app needs no key and makes no outside calls. Verification fails closed: exact substring, then a deterministic detail check, then a support check. Every `/api` request needs a signed-in session, the server refuses any role the account may not act as, and every route that returns text enforces that role.

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

More detail: [ARCHITECTURE.md](ARCHITECTURE.md) and [API.md](API.md).

## 5. The three Round 3 improvements

### 5.1 Real-project backtest and GitHub import

- **What:** A pseudonymised dataset of mocha's public history (1,537 commits, 243 contributors, MIT licence). The original author's last commit was 16 May 2014. Backstop ranks modules using only history up to that day; ground truth is which modules needed new people *and* fixes in the next 180 days. Rules were written before results were computed and not tuned afterwards. Any public GitHub repository can also be analysed from a link, with time, size and rate limits.
- **Result:** Backstop's top 5 hit **0 of 8** troubled modules. A plain count of the leaver's commits hit **5 of 5**. Backstop favoured small test folders the leaver owned alone, which nobody needed to touch later.
- **Candidate score v2:** leaver share × √(leaver commits). On mocha its top 5 hits **4 of 5** at the real departure and at all three control dates, up from 0 or 1 for today's score; the commit count still gets 5 at three of the four dates. v2 was chosen after seeing mocha, so this is in-sample. It is shown on the Backtest page and not yet used for claims.
- **What we learned:** Sole ownership alone is a poor predictor; weighting it by how much the leaver actually worked on a module closes most of the gap. The next step is to test v2 on a second real departure.

### 5.2 Trust test suite

- **What:** A leak harness attacks every API route as every role, including guessed ids and tampered role values. A set of 40 hand-labelled claim/quote pairs, some deliberately wrong, measures the proof check.
- **Result:** The first run found **126 real leaks** in 1,290 attacks. All were fixed and each is guarded by a test. The latest run: **1,568 attacks across 54 endpoints, 0 leaks**. A new deterministic detail check caught **5 of 5** invented details and rejected **0** correct claims. It cannot catch right words with the wrong meaning, and the live support check was not measured because it needs a provider key.

### 5.3 Tripwires

- **What:** Paste the files you plan to change (or a diff). Backstop warns about reverted work, recorded decisions, sole-knowledge and stale areas, with the evidence and who to ask, and never above your access level. "No tripwires matched" is stated as *not* meaning safe.
- **Result:** Replayed on mocha, tripwires warned on 89 % of changes that later needed a fix, at 36.7 % precision against a 31.7 % base rate. Useful as a warning, too noisy to block changes, and the app says so.

## 6. Other Round 3 work

- Verification now fails closed; planted demo results were removed.
- Claim access is recomputed from evidence.
- Debrief questions, recorded answers and a readiness score.
- Real projects with records and GitHub import, working offline with keyword rules.
- Review queue with conflict view, keyboard review, search, shareable claim links and a command palette.
- Sign-in with separate team and admin pages, an Accounts page, and server-side role checks on every request.
- Teams with managers and leads: each account sees only the projects of its teams or assignments, and an activity log shows who works where.
- A repository map on the Records page: the git history as an animated file tree with risk, tripwires and claims on each folder and file.
- A new visual design with a slim top navigation bar and a documented design system, followed by a full design and accessibility review of every page.

## 7. Reliability

- **251 automated tests** pass, covering access control, redaction, derived metrics, verification, review, handover, debrief, workspaces, GitHub import, both backtests, tripwires and the trust harness. CI runs them on every push.
- Every feature works with `LLM_PROVIDER=none` and no key.
- Upload limits, rate limits, security headers, a health check, and automatic seeding on a cold start.

## 8. Limitations

- Username and password sign-in only: no SSO, password-reset email or two-factor yet.
- Sample data is synthetic; its results demonstrate mechanics, not accuracy.
- On real data the risk score lost to a simple baseline.
- One real project and one departure is a case study.
- The live support check is not yet measured.
- SQLite and a single process; free hosting resets visitor projects on restart.

## 9. Roadmap

| Next | Why |
|---|---|
| Test score v2 on a second real departure, then adopt it if it holds | v2 nearly matches the commit-count baseline on mocha, but only in-sample |
| SSO (GitHub / Google) | Let teams use the accounts they already have |
| Live GitHub / GitLab webhooks | Keep claims current |
| Measure the live support check | Close the open trust measurement |
| Reduce tripwire noise | Reach a precision teams act on |
| Postgres and background jobs | Many users and projects |

## 10. Team and contributions

Backstop was started in Rounds 1 and 2 by the original team. Round 3 was built by the team below, with each improvement owned by one member.

| Member | Round 3 area | Contribution |
|---|---|---|
| Aasif Ahmed A | Team lead, tripwires, integration and submission | Led the team, planned Round 3 and split the work into the three improvements. Owned tripwires: listed the tripwire sources already in the data (reverted work, recorded decisions, conflicts, sole-knowledge and stale modules) and shaped the Check a change screen. Reviewed work before it was merged, kept the Round 2 repository and live site, and made the team's submission. |
| Inbathamizhan S | Real-project backtest, GitHub import, product build and docs | Shortlisted real projects and built the pseudonymised mocha dataset, the ground-truth rules, the real backtest with baselines and control dates, and candidate risk score v2. Added analysis of any public GitHub repository, real projects with records, the repository map, sign-in with team and admin accounts, teams and the activity log, the new visual design, and the README, report and testing docs. Integrated the three improvements on one branch and kept the live app deployed. |
| Vedhan S | Trust test suite | Planned the leak attacks (every role on every endpoint, guessed ids and tampered role values) and wrote the 40 hand-labelled claim/quote pairs, including deliberately wrong ones, used to measure the proof check. Reviewed the Trust report results and its stated limitations. |

## 11. Tool disclosure

| Area | Tools and services |
|---|---|
| Languages | Python 3.11, JavaScript (JSX), HTML and CSS, SQL (SQLite) |
| Backend | FastAPI, Uvicorn, SQLModel on SQLite, python-dotenv, python-multipart |
| Frontend | React 19, Vite, Tailwind CSS v4, Lucide icons, Hanken Grotesk and Courier Prime fonts via Fontsource |
| Claim extraction | Extractor results from Rounds 1 and 2 (Google Gemini API) are committed as a cache; production runs with `LLM_PROVIDER=none` and makes no outside model calls. Round 3 features use plain code and keyword rules. |
| Testing and quality | pytest and httpx (251 tests), Oxlint, Playwright for the page check and screenshots, our own leak harness and support-check evaluation |
| Source control and CI | Git, GitHub (repository, pull requests, issue and PR templates), GitHub Actions running tests, lint and build on every push |
| Hosting | Render (free web service, built from `render.yaml`), Docker (multi-stage Dockerfile for local or other hosts) |
| Data | Synthetic sample project made for the demo; public history of mocha (MIT licence), pseudonymised with emails removed; any public GitHub repository through the import, cloned with git |
| Design and docs | Markdown docs in the repository, a documented design system in `docs/design/DESIGN.md`, browser screenshots for the screen tour |
