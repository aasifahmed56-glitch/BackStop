"""
Backstop — FastAPI main entry point.
Serves:
  - /healthz          liveness probe
  - /api/...          REST API
  - /*                React SPA (from frontend/dist)
"""
from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.db import create_db_and_tables

app = FastAPI(title="Backstop", version="0.1.0")

# CORS — allow Vite dev server during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    create_db_and_tables()


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/healthz", tags=["meta"])
def healthz():
    return {"status": "ok", "service": "backstop"}


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
