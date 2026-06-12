from __future__ import annotations

from typing import Any

from app.config import Settings
from app.error_tracking import (
    before_send_sentry,
    before_send_transaction_sentry,
    init_error_tracking,
)


def make_settings(**overrides: Any) -> Settings:
    values: dict[str, Any] = {
        "database_url": "postgresql://user:password@localhost:5432/wedding",
        "_env_file": None,
    }
    values.update(overrides)
    return Settings(**values)


def test_init_error_tracking_skips_when_dsn_missing(monkeypatch) -> None:
    init_calls: list[dict[str, Any]] = []

    monkeypatch.setattr(
        "app.error_tracking.sentry_sdk.init",
        lambda **kwargs: init_calls.append(kwargs),
    )

    assert init_error_tracking(make_settings(sentry_dsn=None)) is False
    assert init_calls == []


def test_init_error_tracking_configures_sentry(monkeypatch) -> None:
    init_calls: list[dict[str, Any]] = []

    monkeypatch.setattr(
        "app.error_tracking.sentry_sdk.init",
        lambda **kwargs: init_calls.append(kwargs),
    )

    initialized = init_error_tracking(
        make_settings(
            environment="production",
            sentry_dsn="https://public@example.invalid/123",
            sentry_environment="production",
            sentry_release="abc123def",
            sentry_sample_rate=0.1,
        )
    )

    assert initialized is True
    assert len(init_calls) == 1
    config = init_calls[0]
    assert config["dsn"] == "https://public@example.invalid/123"
    assert config["environment"] == "production"
    assert config["release"] == "abc123def"
    assert config["sample_rate"] == 0.1
    assert config["traces_sample_rate"] == 0.0
    assert config["send_default_pii"] is False
    assert config["before_send"] is before_send_sentry
    assert config["before_send_transaction"] is before_send_transaction_sentry
    assert config["server_name"] == "wedding-dashboard-api"
    assert config["integrations"]


def test_before_send_redacts_pii_from_error_event() -> None:
    event = {
        "request": {
            "headers": {
                "Authorization": "Bearer token-value",
                "Cookie": "session=abc",
                "X-Safe": "safe",
            },
            "cookies": {"session": "abc"},
            "data": {
                "email": "guest@example.com",
                "phone": "+1 555 123 4567",
                "notes": "safe note",
            },
            "query_string": "email=guest@example.com&table=7",
            "url": "https://api.example.test/api/guests?phone=5551234567",
        },
        "exception": {
            "values": [
                {
                    "value": (
                        "failed for guest@example.com using "
                        "postgresql://user:secret@localhost:5432/wedding"
                    )
                }
            ]
        },
        "extra": {
            "api_key": "sk-1234567890abcdef",
            "safe_count": 3,
            "server_name": "wedding-dashboard-api",
        },
        "breadcrumbs": {
            "values": [
                {
                    "message": "guest@example.com called endpoint",
                    "data": {"token": "secret-token", "safe": "ok"},
                }
            ]
        },
        "user": {
            "id": "user-123",
            "email": "guest@example.com",
            "username": "guest@example.com",
        },
    }

    scrubbed = before_send_sentry(event, {})
    assert scrubbed is not None
    rendered = str(scrubbed)

    assert "guest@example.com" not in rendered
    assert "5551234567" not in rendered
    assert "secret" not in rendered
    assert "sk-1234567890abcdef" not in rendered
    assert scrubbed["request"]["headers"]["Authorization"] == "***REDACTED***"
    assert scrubbed["request"]["headers"]["Cookie"] == "***REDACTED***"
    assert scrubbed["request"]["data"]["email"] == "***REDACTED***"
    assert scrubbed["extra"]["api_key"] == "***REDACTED***"
    assert scrubbed["extra"]["server_name"] == "wedding-dashboard-api"
    assert scrubbed["user"] == {"id": "user-123"}


def test_before_send_transaction_drops_health_checks_and_scrubs_url() -> None:
    health_event = {
        "transaction": "GET /health",
        "request": {"url": "https://api.example.test/health"},
    }
    assert before_send_transaction_sentry(health_event, {}) is None

    event = {
        "transaction": "GET /api/guests",
        "request": {
            "url": "https://api.example.test/api/guests?email=guest@example.com",
        },
    }

    scrubbed = before_send_transaction_sentry(event, {})
    assert scrubbed is not None
    assert "guest@example.com" not in str(scrubbed)
