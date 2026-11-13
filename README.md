# Backstop

**Every claim shows its source quote and a status. A human approves before handover.**

> ⚠️ **Demo Disclaimer:** No authentication / login system is present. Roles are simulated via an in-UI role switcher. All sample data (people, commits, issues, notes) is 100% synthetic and fictional.

---

## 1. What Backstop Does

When a core team member departs, teams typically face an information cliff: stale wiki pages, unwritten tribal knowledge, hidden service dependencies, and guess-filled onboarding meetings.

**Backstop transforms unstructured project activity (git logs, issue comments, meeting notes, task spreadsheets, team chat) into an auditable ledger of claims.**
- **Two claim kinds**:
  - `DERIVED`: Mathematically computed by plain Python code from git logs and tasks (**never an LLM**).
  - `INTERPRETED`: Extracted by an LLM, strictly backed by an **exact substring quote** from the original source chunk.
- **Strict Verification**: Claims are double-checked (substring verification against unredacted text + independent support validation). If evidence is missing, it is marked as `Missing evidence` and phrased as a debrief question.
- **Privacy Barrier**: Secrets (API keys, tokens, passwords) and PII (emails, phone numbers) are masked before any LLM processing.
- **Permission-Aware Output**: Claims take the strictest access level of their underlying citations. Lower roles (`incoming_dev`, `incoming_pm`) receive locked placeholders (`Requires <level> access — Request access from lead`) with no text or quote disclosed.
- **Empirical Backtesting**: Scores the derived knowledge risk rankings against air-gapped post-departure ground truth (`precision@k` and `recall@k` for $k=1..5$).

---

## 2. 5-Step Demo Flow

1. **Step 1: Load Sample Project**  
   Click the prominent **"Load the Sample Project"** button on the Home tab. The system resets the SQLite database, parses 5 raw synthetic sources (220 commits, 40 issues, 10 meeting notes, 60 tasks, 120 chats), masks secrets/PII, and indexes line-numbered chunks.
2. **Step 2: Inspect Plain-Code Derivations**  
   Plain Python algorithms compute module ownership, sole-knowledge risks (leaver $\ge 70\%$ share and $\le 1$ other contributor), 30-day staleness, and `knowledge_at_risk_score`.
3. **Step 3: Review Queue Verification**  
   Switch to the **Review Queue** tab. Inspect claims sorted by risk score. Select any claim to see the exact quote highlighted in the raw chunk text, quote substring verification status, LLM support corroboration, and complete version audit history.
4. **Step 4: Human Review & Corrections**  
   As Lead/Admin, click **Approve** to promote a claim to the handover, **Edit** to correct text (which bumps the version number and records an audit log), or **Reject** with an explicit reason.
5. **Step 5: Handover Dossier & Backtest**  
   - Open **Handover Dossier**: Switch between `incoming_dev` and `incoming_pm` to see role emphasis and locked withheld placeholders. Review the rule-based **Day 1 / Week 1 / Month 1** ramp-up plan. Click **Acknowledge Receipt** to sign the handover. Click **Print Dossier** for a clean PDF report.
   - Open **Backtest Benchmark**: Compare Backstop's risk score ranking against raw commit-count baseline with precision@k/recall@k tables, visual bar charts, hits, and misses.

---

## 3. Architecture & Data Flow

### Text Architecture Diagram

```
+-----------------------------------------------------------------------------------------+
|                                    BACKSTOP SYSTEM                                      |
+-----------------------------------------------------------------------------------------+
|                                                                                         |
|  [Raw Team Activity]                                                                    |
|  - git_log.txt (~220 commits)                                                           |
|  - issues.json (~40 issues & comments)                                                  |
|  - notes/*.md  (~10 meeting notes)                                                      |
|  - tasks.csv   (~60 rows)                                                               |
|  - chat.json   (~120 messages)                                                          |
|         │                                                                               |
|         ▼                                                                               |
|  [INGEST & INDEX] (ingest.py)                                                           |
|  - Chunks with author, timestamps, line start/end                                       |
|  - Stored in SQLite (SQLModel)                                                          |
|         │                                                                               |
|         ├──────────────────────────────────────────┐                                    |
|         │ (Plain Code Path - NO LLM)               │ (LLM Extraction Path)              |
|         ▼                                          ▼                                    |
|  [DERIVED ENGINE] (derived.py)              [REDACTION BARRIER] (redact.py)             |
|  - Sole Knowledge (>=70% share, <=1 other)  - Masks API keys, passwords, emails, phones|
|  - Staleness factor (>30 days inactive)            │                                    |
|  - Knowledge-at-Risk Score                         ▼                                    |
|         │                                   [LLM EXTRACTION] (llm.py)                   |
|         │                                   - Swappable: Gemini | Claude | OpenAI | none|
|         │                                   - Deterministic disk cache (84 items)       |
|         │                                          │                                    |
|         │                                          ▼                                    |
|         │                                   [VERIFICATION ENGINE] (verify.py)           |
|         │                                   - 1. Substring quote check in raw text      |
|         │                                   - 2. Support check LLM validation           |
|         │                                   - 3. Conflict & Missing rationale detection |
|         │                                          │                                    |
|         └───────────────────┬──────────────────────┘                                    |
|                             ▼                                                           |
|                   [CLAIMS LEDGER & AUDIT]                                               |
|                   - Access levels: public < team < restricted < confidential            |
|                   - Review states: pending | approved | corrected | rejected            |
|                             │                                                           |
|                             ▼                                                           |
|                   [HUMAN REVIEW QUEUE] (review.py)                                      |
|                   - Approve / Correct / Reject actions                                  |
|                   - Immutable version history                                           |
|                             │                                                           |
|                             ▼                                                           |
|                   [ROLE-GATED VIEWS] (views.py)                                         |
|                   - incoming_dev vs incoming_pm                                         |
|                   - Locked withheld placeholders for unauthorized levels                |
|                   - Rule-based Day 1 / Week 1 / Month 1 roadmap                         |
|                             │                                                           |
|                             ▼                                                           |
|                   [REACT + TAILWIND FRONTEND]                                           |
|                   - Served directly by FastAPI from frontend/dist                       |
|                                                                                         |
+-----------------------------------------------------------------------------------------+
```

### Data Flow Summary
1. **Raw Files** $\rightarrow$ `Source` and `Chunk` records with unredacted text preserved for quote matching.
2. **Plain Code Path** $\rightarrow$ `compute_ownership()`, `compute_sole_knowledge()`, `compute_stale_modules()`, `compute_knowledge_at_risk_score()`.
3. **LLM Path** $\rightarrow$ `redact()` strips credentials $\rightarrow$ `complete_json()` extracts claims $\rightarrow$ `verify_quote_substring()` checks raw text $\rightarrow$ support validation.
4. **Human Review** $\rightarrow$ Only `approved` claims enter the handover.
5. **Role Filter** $\rightarrow$ If `not role_can_see(role, claim.access_level)`, text and quotes are wiped and replaced with locked placeholders.

---

## 4. How Verification Works

1. **Exact Substring Check (Deterministic Code)**:
   - Quotes extracted by the LLM are normalized for whitespace and smart quote punctuation.
   - The normalized quote is tested as a direct substring of the chunk's **original unredacted raw text**.
   - If the quote does not appear character-for-character in the original source, it is rejected immediately.
2. **Support Validation Check (LLM Corroboration)**:
   - The candidate claim and verified quote are sent in isolation to the LLM: *"Does this quote support this claim? yes | partly | no"*.
   - `no` $\rightarrow$ Rejected.
   - `partly` $\rightarrow$ Marked as `inferred`.
   - `yes` $\rightarrow$ Marked as `verified`.
3. **Conflict Detection**:
   - If claims disagree on an architectural decision or timeline (e.g. database migration date), status is marked `conflicting` with both quotes retained.
4. **Missing Evidence Question Generation**:
   - Candidates with missing reasons or missing task owners are automatically converted to `missing` claims framed as actionable questions for the leaver.

---

## 5. Built vs. Planned

| Feature | Status | Notes |
|---------|--------|-------|
| Synthetic data generator (220 commits, issues, notes, tasks, chat) | Built | Fixed seed, offline deterministic generation |
| Chunk parser for Git, Issues, Notes, Tasks, Chat | Built | Line-numbered chunk citations with timestamps |
| Pre-LLM secret and PII redaction | Built | Regex masking of keys, tokens, emails, phones |
| Plain-code derived metrics & knowledge-at-risk scoring | Built | Zero LLM involvement for ownership & risk |
| Multi-provider LLM abstraction (Gemini, Claude, OpenAI, None) | Built | Offline disk cache with 84 pre-computed responses |
| Two-tier claim verification (Substring + Support) | Built | Substring match against original raw text |
| Human review queue with version history | Built | Approve, Edit (version bump), Reject (reason required) |
| Role-based handover view with locked placeholders | Built | Strict redaction for unauthorized tiers |
| Deterministic Day 1 / Week 1 / Month 1 roadmap | Built | Rule-based assignment from approved claims |
| Formal handover acknowledgment receipt | Built | Saved permanently to audit log |
| Backtest benchmark (Precision@k, Recall@k vs baseline) | Built | Side-by-side comparison & visual bar chart |
| Production single-service deployment for Render | Built | Serves React build from FastAPI, startup auto-seeding |
| Real enterprise OAuth / SSO integration | Planned | Currently simulated via role switcher |
| Live GitHub / GitLab webhook ingestion | Planned | Currently ingests exports & file uploads |

---

## 6. Limitations

- **Simulated Roles**: Authentication is simulated via a client/server role switcher (`incoming_dev`, `incoming_pm`, `lead`, `admin`). There is no user password or login database.
- **Synthetic Data**: All team members, projects, commits, issues, and dates are fictitious.
- **Rule-Based Phased Roadmap**: The Day 1 / Week 1 / Month 1 transition plan is computed strictly by priority rules from approved claims, not by an generative LLM agent.

---

## 7. Deploy as One Render Service

Backstop is designed as a single containerized web service. FastAPI serves both the REST API and the built production React SPA.

### Render Configuration
- **Environment**: Python 3.11+ / Node 20+
- **Build Command**:
  ```bash
  pip install -r backend/requirements.txt && cd frontend && npm ci && npm run build
  ```
- **Start Command**:
  ```bash
  uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT
  ```
- **Environment Variables**:
  - `LLM_PROVIDER`: `none` (default for production; reads from committed disk cache)
  - `LLM_MODEL`: `gemini-3.5-flash-lite`
  - `LLM_DAILY_CALL_LIMIT`: `50`
  - `CORS_ORIGINS`: `https://your-app.onrender.com` (or comma-separated allowed origins)

### Production Protections
- **Instant Cold Start**: The app automatically seeds the sample project into SQLite on startup if the database is uninitialized.
- **Security Headers**: Injects `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`, and `Referrer-Policy: strict-origin-when-cross-origin`.
- **Upload Hardening**: File size limit (5 MB), strict extension allow-list (`.txt`, `.json`, `.md`, `.csv`), filename sanitization (no path traversal), and text-only parsing (zero script execution).
- **Rate Limiting**: In-memory rate limiting protects sensitive endpoints (`/upload` max 10/min, `/extract` max 6/min).
- **Health Check**: Available at `GET /healthz`.

---

## 8. AI Tool Disclosure

This software was developed with the assistance of Google Antigravity / Gemini for rapid prototyping of boilerplate, UI layouts, and test fixtures during a hackathon sprint. All architectural safeguards, deterministic derivations, quote-check verification algorithms, and access controls were verified by the author.
