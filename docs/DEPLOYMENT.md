# Deployment

Backstop deploys as a single web service. FastAPI serves both the API and the built frontend, so there is one URL and no separate static host.

## Render with Docker (recommended)

1. New → Web Service → connect the repository.
2. Runtime: **Docker**. Render finds the `Dockerfile` at the root.
3. Environment: `LLM_PROVIDER=none` (the default). Nothing else is required.
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

## What happens on start

- Tables are created and the sample project is seeded if the database is empty, so the first visit never shows an empty app.
- Security headers are added to every response: `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`.
- Upload and extraction are rate-limited in memory.

## Data persistence

SQLite lives in the container's file system. On Render's free tier it resets when the service restarts or redeploys; the sample is re-seeded automatically, but projects created by visitors are lost. Attach a persistent disk if they must survive.

## After deploying, check

1. `GET /healthz` returns OK.
2. The Overview loads the sample project.
3. Review → approve a claim → it appears on the Handover page.
4. Backtest, Trust report and Check a change open without errors.
5. On Docker, Analyse a GitHub repository works for a small public repository.
