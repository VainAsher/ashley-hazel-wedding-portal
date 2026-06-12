"""FastAPI main application"""

import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import guests
from app.config import Environment, get_settings
from app.error_tracking import init_error_tracking
from app.logging import configure_logging
from app.utils.secrets import SecretMasker


settings = get_settings()
settings.validate_for_startup()
configure_logging(settings)
logger = logging.getLogger(__name__)
init_error_tracking(settings)

# Sentry must be initialized before FastAPI app creation so framework integrations attach.
app = FastAPI(title="Wedding Dashboard API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
    max_age=3600,
)

app.include_router(guests.router)


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


@app.get("/health")
async def health():
    return {"status": "healthy", "message": "Wedding Dashboard API is running!"}


@app.get("/")
async def root():
    return {"message": "Welcome to Wedding Dashboard API"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=3001)
