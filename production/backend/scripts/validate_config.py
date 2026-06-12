#!/usr/bin/env python3
from __future__ import annotations

import sys
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import Settings  # noqa: E402


BACKEND_DIR = Path(__file__).resolve().parents[1]


def main() -> int:
    try:
        env_file = BACKEND_DIR / ".env"
        settings = Settings(_env_file=env_file if env_file.exists() else None)
    except Exception as exc:
        print(f"Configuration could not be loaded: {exc}", file=sys.stderr)
        return 1

    print(f"Environment: {settings.environment.value}")
    print(f"Debug: {settings.debug}")
    print(f"Database: {settings.masked_database_location()}")
    print(f"API URL: {settings.api_url or '<not set>'}")
    print(f"Frontend URL: {settings.frontend_url or '<not set>'}")
    try:
        cors_origins = ", ".join(settings.get_cors_origins())
    except ValueError as exc:
        cors_origins = f"<invalid: {exc}>"
    print(f"CORS origins: {cors_origins}")
    print(f"Log level: {settings.log_level}")
    print(f"Log file: {settings.log_file_path or '<disabled>'}")
    print(f"Sentry: {'enabled' if settings.sentry_dsn else 'disabled'}")
    print(f"Sentry environment: {settings.sentry_environment}")
    print(f"Sentry release: {settings.sentry_release or '<not set>'}")
    print(f"Sentry sample rate: {settings.sentry_sample_rate}")
    print(f"Metrics: {'enabled' if settings.metrics_enabled else 'disabled'}")
    print(f"Slow request threshold ms: {settings.slow_request_threshold_ms}")
    print(f"Slow query threshold ms: {settings.slow_query_threshold_ms}")

    errors = settings.environment_errors()
    if errors:
        print("\nConfiguration errors:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print("\nConfiguration valid")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
