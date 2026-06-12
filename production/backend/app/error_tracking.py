from __future__ import annotations

import logging
import re
from typing import Any

import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.logging import LoggingIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration

from app.config import Settings, get_settings
from app.utils.secrets import SecretMasker


logger = logging.getLogger(__name__)

_EMAIL_PATTERN = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE)
_PHONE_PATTERN = re.compile(r"(?<!\w)(?:\+?\d[\d\s().-]{7,}\d)(?!\w)")
_SENSITIVE_KEY_PARTS = (
    "api_key",
    "apikey",
    "authorization",
    "cookie",
    "database_url",
    "dsn",
    "email",
    "first_name",
    "full_name",
    "guest_name",
    "jwt",
    "last_name",
    "password",
    "phone",
    "secret",
    "token",
)
_HEALTH_TRANSACTIONS = {"/health", "GET /health", "health"}


def is_sensitive_key(key: str | None) -> bool:
    if key is None:
        return False
    normalized = key.lower().replace("-", "_")
    if normalized in {"name", "username"}:
        return True
    return any(part in normalized for part in _SENSITIVE_KEY_PARTS)


def scrub_string(value: str) -> str:
    scrubbed = SecretMasker.mask(value)
    scrubbed = _EMAIL_PATTERN.sub(SecretMasker.REDACTION, scrubbed)
    return _PHONE_PATTERN.sub(SecretMasker.REDACTION, scrubbed)


def scrub_value(value: Any, key: str | None = None) -> Any:
    if is_sensitive_key(key):
        return SecretMasker.REDACTION
    if isinstance(value, str):
        return scrub_string(value)
    if isinstance(value, dict):
        return {
            item_key: scrub_value(item, item_key)
            for item_key, item in value.items()
        }
    if isinstance(value, list):
        return [scrub_value(item) for item in value]
    if isinstance(value, tuple):
        return tuple(scrub_value(item) for item in value)
    return value


def before_send_sentry(
    event: dict[str, Any],
    _hint: dict[str, Any],
) -> dict[str, Any] | None:
    scrubbed = scrub_value(event)
    if not isinstance(scrubbed, dict):
        return event

    user = scrubbed.get("user")
    if isinstance(user, dict):
        scrubbed["user"] = {"id": user["id"]} if user.get("id") else {}

    return scrubbed


def before_send_transaction_sentry(
    event: dict[str, Any],
    _hint: dict[str, Any],
) -> dict[str, Any] | None:
    transaction_name = str(event.get("transaction", ""))
    request = event.get("request")
    request_url = ""
    if isinstance(request, dict):
        request_url = str(request.get("url", ""))

    if transaction_name in _HEALTH_TRANSACTIONS or request_url.endswith("/health"):
        return None

    scrubbed = scrub_value(event)
    return scrubbed if isinstance(scrubbed, dict) else event


def init_error_tracking(settings: Settings | None = None) -> bool:
    settings = settings or get_settings()
    if not settings.sentry_dsn:
        logger.info("Sentry error tracking disabled: SENTRY_DSN is not set")
        return False

    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        integrations=[
            StarletteIntegration(
                transaction_style="endpoint",
                failed_request_status_codes={403, *range(500, 600)},
            ),
            FastApiIntegration(
                transaction_style="endpoint",
                failed_request_status_codes={403, *range(500, 600)},
            ),
            SqlalchemyIntegration(),
            LoggingIntegration(level=logging.INFO, event_level=logging.ERROR),
        ],
        environment=settings.sentry_environment,
        release=settings.sentry_release,
        sample_rate=settings.sentry_sample_rate,
        traces_sample_rate=0.0,
        send_default_pii=False,
        before_send=before_send_sentry,
        before_send_transaction=before_send_transaction_sentry,
        server_name="wedding-dashboard-api",
    )
    logger.info(
        "Sentry error tracking initialized for %s",
        settings.sentry_environment,
    )
    return True
