# Backstop

**A verified, permission-aware handover system for departing team members.**

> ⚠️ **Demo only.** No login system. Roles are simulated via a role switcher clearly labelled in the UI. All sample data is synthetic and fictional.

---

## What it does

Backstop turns a team's project activity (git log, issues, meeting notes, tasks, chat) into a structured **handover ledger of claims**. Each claim has:
- An exact source quote
- A status: `Verified | Inferred | Conflicting | Missing evidence`
- An access level: `public | team | restricted | confidential`
- A human review state: `pending | approved | corrected | rejected`

Handovers are built **only from approved claims**, filtered by role. A **Backtest** page scores the handover against what actually happened after the departure date.

---

## Claim kinds

| Kind | How it's made | LLM involved? |
|------|--------------|---------------|
| `DERIVED` | Calculated by plain code from git/issue/task data | ❌ Never |
| `INTERPRETED` | Extracted by LLM — always includes an exact source quote | ✅ Yes |

---

## Stack

- **Backend:** Python 3.11 + FastAPI + SQLite (via SQLModel)
- **Frontend:** React + Vite + Tailwind CSS
- FastAPI serves the built frontend from `frontend/dist/`

---

## Quickstart

```bash
# 1. Backend
cd backend
pip install -r ../requirements.txt
cp ../.env.example ../.env   # fill in LLM_API_KEY
python data/generate_sample.py          # create synthetic sample data
uvicorn app.main:app --reload

# 2. Frontend (separate terminal)
cd frontend
npm install
npm run dev      # dev mode — or: npm run build (served by FastAPI)
```

## Running tests
```bash
cd backend
pytest tests/ -v
```

---

## AI provider

Set `LLM_PROVIDER` in `.env`:

| Value | Behaviour |
|-------|-----------|
| `gemini` | Google Gemini (default) |
| `anthropic` | Anthropic Claude |
| `openai` | OpenAI |
| `none` | Reads cached results from `backend/data/cache/`; no API calls |

Always set `LLM_MODEL` — never hardcoded.

---

## Access control

```
public < team < restricted < confidential
```

A claim's access level = **strictest** among its evidence sources.
Access is enforced **before** any LLM call and again at render time.

| Role | Max access |
|------|-----------|
| `lead` | restricted |
| `incoming_dev` | team |
| `incoming_pm` | team |
| `admin` | confidential |

---

## Layout

```
backend/
  app/           main, models, db, ingest, redact, derived, llm, verify, review, views, backtest
  tests/
  data/
    sample/      synthetic project files + manifest.json (access levels)
    cache/       LLM response cache (gitignored)
    generate_sample.py
frontend/        React + Vite + Tailwind
requirements.txt
.env.example
```

