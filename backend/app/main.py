"""
Backstop — FastAPI main entry point.
Serves:
  - /healthz          liveness probe
  - /api/...          REST API
  - /*                React SPA (from frontend/dist)
"""
from __future__ import annotations

import os
import sys
import time
from collections import defaultdict
from datetime import date, datetime, timezone
from pathlib import Path

# Ensure backend directory is in sys.path so both 'app.xxx' and 'backend.app.xxx' work
_BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.db import create_db_and_tables

app = FastAPI(title="Backstop", version="0.1.0")

# ---------------------------------------------------------------------------
# Security Headers Middleware
# ---------------------------------------------------------------------------

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


# ---------------------------------------------------------------------------
# Rate Limiting Middleware (In-memory, for upload & extract endpoints)
# ---------------------------------------------------------------------------

_rate_limits: dict[str, list[float]] = defaultdict(list)
_RATE_RULES = {
    "/upload": (10, 60),    # max 10 uploads per 60s
    "/extract": (6, 60),    # max 6 extractions per 60s
}

@app.middleware("http")
async def rate_limit_sensitive_endpoints(request: Request, call_next):
    path = request.url.path
    for suffix, (max_calls, window_secs) in _RATE_RULES.items():
        if path.endswith(suffix) and request.method == "POST":
            client_ip = request.client.host if request.client else "127.0.0.1"
            key = f"{client_ip}:{suffix}"
            now = time.time()
            _rate_limits[key] = [t for t in _rate_limits[key] if now - t < window_secs]
            if len(_rate_limits[key]) >= max_calls:
                return JSONResponse(
                    status_code=429,
                    content={"detail": f"Rate limit exceeded. Maximum {max_calls} requests per {window_secs} seconds."},
                )
            _rate_limits[key].append(now)
            break
    return await call_next(request)


# ---------------------------------------------------------------------------
# CORS Configuration
# ---------------------------------------------------------------------------

cors_env = os.getenv("CORS_ORIGINS", "")
if cors_env:
    allow_origins = [o.strip() for o in cors_env.split(",") if o.strip()]
else:
    allow_origins = ["http://localhost:5173", "http://localhost:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Startup & Seeding
# ---------------------------------------------------------------------------

def _seed_sample_if_needed() -> None:
    """Seed sample project on startup so first screen works instantly."""
    from sqlmodel import Session, select
    from app.db import engine
    from app.models import Project, Claim
    from app.ingest import _ingest_all, _load_manifest
    from app.derived import derive_claims
    from app.verify import run_extraction_and_verification

    with Session(engine) as session:
        proj = session.get(Project, 1)
        claims = session.exec(select(Claim).where(Claim.project_id == 1)).all() if proj else []
        if proj and len(claims) > 0:
            return

        sample_dir = Path(__file__).parent.parent / "data" / "sample"
        if not sample_dir.exists():
            return

        manifest = _load_manifest(sample_dir)
        if not proj:
            proj = Project(
                id=1,
                name="Campus Event App",
                departure_date=date(2026, 3, 15),
                leaver_name="Riya",
            )
            session.add(proj)
            session.flush()

        _ingest_all(session, proj, sample_dir, manifest)
        session.commit()

        derive_claims(project_id=1, session=session)

        # Extract LLM claims from cache
        try:
            run_extraction_and_verification(project_id=1, session=session)
        except Exception:
            pass


@app.on_event("startup")
def on_startup() -> None:
    create_db_and_tables()
    _seed_sample_if_needed()


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/healthz", tags=["meta"])
def healthz():
    return {
        "status": "ok",
        "service": "backstop",
        "llm_provider": os.getenv("LLM_PROVIDER", "none"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# API routers
# ---------------------------------------------------------------------------

from app.ingest import router as ingest_router       # noqa: E402
from app.derived import router as derived_router     # noqa: E402
from app.verify import router as verify_router       # noqa: E402
from app.review import router as review_router       # noqa: E402
from app.views import router as views_router         # noqa: E402
from app.backtest import router as backtest_router   # noqa: E402

app.include_router(ingest_router, prefix="/api")
app.include_router(derived_router, prefix="/api")
app.include_router(verify_router, prefix="/api")
app.include_router(review_router, prefix="/api")
app.include_router(views_router, prefix="/api")
app.include_router(backtest_router, prefix="/api")


# ---------------------------------------------------------------------------
# Serve React SPA from frontend/dist (production build)
# ---------------------------------------------------------------------------

_DIST = Path(__file__).parent.parent.parent / "frontend" / "dist"

if _DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(_DIST / "assets")), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_spa(full_path: str):
        file = _DIST / full_path
        if file.exists() and file.is_file():
            return FileResponse(str(file))
        return FileResponse(str(_DIST / "index.html"))
