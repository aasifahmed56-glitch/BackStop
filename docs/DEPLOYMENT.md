# Deployment

Backstop deploys as a single web service. FastAPI serves both the API and the built frontend, so there is one URL and no separate static host.

## Render with Docker (recommended)

1. New → Web Service → connect the repository.
2. Runtime: **Docker**. Render finds the `Dockerfile` at the root.
3. Environment: `LLM_PROVIDER=none` (the default), `ADMIN_USERNAME`, `ADMIN_PASSWORD` and `COOKIE_SECURE=1`. See [Sign-in and demo accounts](#sign-in-and-demo-accounts). Nothing else is required.
4. Health check path: `/healthz`.

The image installs `git`, which **Analyse a GitHub repository** and GitHub import need. Without Docker that feature returns an error.

## Render with native Python

`render.yaml` is a blueprint for a native Python service:

- Build: `npm --prefix frontend install && npm --prefix frontend run build && pip install -r requirements.txt`
- Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT --app-dir backend`
- Versions: Python 3.11.9, Node 20.11.0

## Docker anywhere

```bash
docker build -t backstop .
docker run -p 8000:8000 -e LLM_PROVIDER=none backstop
```

## Live demo

The live service is https://backstop-redesign.onrender.com. It is a Docker web service on Render's free plan in Singapore, and it deploys from the `redesign-herbarium` branch, which is kept level with `main`.

## Environment variables

| Variable | Default | Notes |
|---|---|---|
| `LLM_PROVIDER` | `none` | `none` uses the committed cache and never calls out. Keep it for production. |
| `LLM_API_KEY` | – | Only for a live provider. Set it as a secret, never in the repository. |
| `LLM_MODEL` | `gemini-3.5-flash-lite` | Only for a live provider. |
| `LLM_DAILY_CALL_LIMIT` | `50` | Cost guard for live calls. |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:3000` | Only needed when the frontend is served from another origin. |
| `DATABASE_URL` | `sqlite:///backend/backstop.db` | SQLAlchemy URL. Point it at a persistent disk to keep data across restarts. |
| `PORT` | `8000` | Set by Render automatically. |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | – | Create the first admin on an empty database. Set both as secrets. |
| `DEMO_ACCOUNTS` | `0` | Set to `1` to create the demo organisation: `admin`, a `manager` over two teams, leads `lead` and `lead2`, and members `dev`, `pm`, `dev2`, `pm2`. |
| `DEMO_PASSWORD` | `backstop-demo` | Password for every demo account except `admin`. |
| `DEMO_ADMIN_PASSWORD` | `admin` | Password for the demo `admin` account. |
| `COOKIE_SECURE` | – | Set to `1` to send the session cookie over HTTPS only. Set it on Render. |
| `SESSION_HOURS` | `12` | How long a sign-in lasts. |
| `AUTH_DISABLED` | – | For the test suite only. It turns sign-in off. Never set it in production. |

`render.yaml` sets `DEMO_ACCOUNTS=1` and `COOKIE_SECURE=1`, and leaves `ADMIN_USERNAME` and `ADMIN_PASSWORD` to be set as secrets.

## Sign-in and demo accounts

Accounts are created on start from the settings above, if they do not already exist. Existing accounts are left alone. On an empty database, nobody can sign in until `ADMIN_USERNAME` and `ADMIN_PASSWORD` or `DEMO_ACCOUNTS=1` create an account.

- Team members sign in at `/login`. Administrators sign in at `/admin/login`.
- With `DEMO_ACCOUNTS=1`, the demo accounts are `manager`, `lead`, `dev`, `pm`, `lead2`, `dev2` and `pm2` (password `DEMO_PASSWORD`), and `admin` (password `DEMO_ADMIN_PASSWORD`). Use the admin sign-in page for `admin`.
- Sessions last `SESSION_HOURS` and are stored on the server.

## What happens on start

- Tables are created and the sample project is seeded if the database is empty, so the first visit never shows an empty app.
- Security headers are added to every response: `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`.
- Upload, extraction and sign-in attempts are rate-limited in memory.

## Data persistence

SQLite lives in the container's file system. On Render's free tier it resets when the service restarts or redeploys; the sample is re-seeded automatically, but projects created by visitors are lost. Accounts an admin creates are lost in the same way; the demo accounts are created again on start when `DEMO_ACCOUNTS=1`. Attach a persistent disk if they must survive.

## After deploying, check

1. `GET /healthz` returns OK.
2. The Overview loads the sample project.
3. Review → approve a claim → it appears on the Handover page.
4. Backtest, Trust report and Check a change open without errors.
5. On Docker, Analyse a GitHub repository works for a small public repository.
6. Sign in with each demo account: `manager`, `lead`, `dev`, `pm`, `lead2`, `dev2` and `pm2` at `/login`, and `admin` at `/admin/login`. Check that `dev2` sees only the Mobile Check-in App and that `manager` lands on the Team page with both teams.
