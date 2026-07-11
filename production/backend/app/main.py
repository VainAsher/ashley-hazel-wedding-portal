"""FastAPI main application"""

import logging
import os
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware

from app.api import (
    auth,
    blessings,
    budget,
    communications,
    events,
    feedback,
    gallery,
    guests,
    invites,
    menu,
    music,
    notifications,
    portal,
    settings as settings_api,
    tasks,
    vendors,
)
from app.config import Environment, get_settings
from app.db.database import SessionLocal
from app.db.models import Invite
from app.error_tracking import init_error_tracking
from app.logging import configure_logging
from app.metrics import metrics_middleware, metrics_response
from app.utils.secrets import SecretMasker


settings = get_settings()
settings.validate_for_startup()
configure_logging(settings)
logger = logging.getLogger(__name__)
init_error_tracking(settings)

# Sentry must be initialized before FastAPI app creation so framework integrations attach.
app = FastAPI(title="Wedding Dashboard API", version="1.1.0")
app.middleware("http")(metrics_middleware(settings))

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
    max_age=3600,
)

app.add_middleware(
    SessionMiddleware,
    secret_key=settings.session_secret_key,
    max_age=settings.session_max_age_seconds,
    same_site="strict" if settings.is_production else "lax",
    https_only=settings.is_production,
)

app.include_router(auth.router)
app.include_router(guests.router)
app.include_router(invites.router)
app.include_router(tasks.router)
app.include_router(budget.router)
app.include_router(vendors.router)
app.include_router(events.router)
app.include_router(communications.router)
app.include_router(gallery.router)
app.include_router(settings_api.router)
app.include_router(blessings.router)
app.include_router(music.router)
app.include_router(feedback.router)
app.include_router(notifications.router)
app.include_router(menu.router)
app.include_router(menu.portal_router)
app.include_router(portal.router)

# Serve uploaded gallery media. The directory lives on a Docker volume
# (uploads_data -> /app/uploads) so files survive deploys; nginx proxies
# /uploads/* here. Created at import time so the mount always has a target.
UPLOADS_DIR = os.environ.get("UPLOADS_DIR", "uploads")
Path(UPLOADS_DIR).mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")


@app.middleware("http")
async def add_security_headers(_request: Request, call_next):
    response = await call_next(_request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if settings.environment == Environment.PRODUCTION:
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains"
        )
    return response


@app.exception_handler(Exception)
async def unhandled_exception_handler(_request: Request, exc: Exception):
    logger.error("Unhandled application error: %s", SecretMasker.mask(exc))
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


@app.get("/metrics", include_in_schema=False)
async def metrics():
    return metrics_response(settings)


@app.get("/health")
async def health():
    """Liveness probe: the process is up and serving. Does NOT touch the DB."""
    return {"status": "healthy", "message": "Wedding Dashboard API is running!"}


@app.get("/health/ready")
async def health_ready():
    """Readiness probe: confirms the backend can actually serve real traffic by
    running the same kind of query the auth flow depends on. Unlike /health, this
    fails (503) when the database is unreachable or the core schema is missing or
    drifted, so a DB-blind backend cannot pass as a healthy/green deployment.
    """
    db = SessionLocal()
    try:
        db.query(Invite).first()
    except Exception as exc:  # noqa: BLE001 - report any DB failure as not-ready
        masked = SecretMasker.mask(exc)
        logger.error("Readiness check failed: %s", masked)
        content: dict[str, str] = {"status": "not_ready", "detail": "database not ready"}
        if not settings.is_production:
            # Outside production, surface the underlying error (secrets masked)
            # so the failure can be diagnosed without shell access to the host.
            content["error"] = f"{type(exc).__name__}: {masked}"
        return JSONResponse(status_code=503, content=content)
    finally:
        db.close()
    return {"status": "ready"}


@app.get("/")
async def root():
    return {"message": "Welcome to Wedding Dashboard API"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=3001)

