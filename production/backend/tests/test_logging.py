from __future__ import annotations

import json
import logging
from collections.abc import Callable
from pathlib import Path

from fastapi.testclient import TestClient
from uvicorn.logging import AccessFormatter

from app.config import Settings
from app.logging import configure_logging, get_logger


def test_configure_logging_writes_json_file_and_masks_secrets(tmp_path: Path) -> None:
    log_file = tmp_path / "app.log"
    settings = Settings(
        database_url="postgresql://localhost/wedding",
        log_backup_count=1,
        log_file_path=str(log_file),
        log_level="INFO",
        log_max_bytes=4096,
        _env_file=None,
    )
    configure_logging(settings, force=True)

    logger = get_logger("app.tests.logging")
    logger.info(
        "connecting to postgresql://user:supersecret@localhost:5432/wedding",
        extra={
            "password": "sensitive-value-123",
            "payload": {"api_key": "sk-1234567890abcdef"},
            "safe_id": 42,
        },
    )
    for handler in logging.getLogger().handlers:
        handler.flush()

    payload = json.loads(log_file.read_text(encoding="utf-8").splitlines()[-1])

    assert payload["level"] == "INFO"
    assert payload["logger"] == "app.tests.logging"
    assert payload["safe_id"] == 42
    assert payload["password"] == "***REDACTED***"
    assert payload["payload"]["api_key"] == "***REDACTED***"
    assert "supersecret" not in json.dumps(payload)
    assert "sensitive-value-123" not in json.dumps(payload)
    assert "sk-1234567890abcdef" not in json.dumps(payload)


def test_log_level_filters_debug_records(tmp_path: Path) -> None:
    log_file = tmp_path / "app.log"
    settings = Settings(
        database_url="postgresql://localhost/wedding",
        log_file_path=str(log_file),
        log_level="INFO",
        _env_file=None,
    )
    configure_logging(settings, force=True)

    logger = get_logger("app.tests.levels")
    logger.debug("debug message should not be written")
    logger.info("info message should be written")
    for handler in logging.getLogger().handlers:
        handler.flush()

    contents = log_file.read_text(encoding="utf-8")

    assert "info message should be written" in contents
    assert "debug message should not be written" not in contents


def test_configure_logging_preserves_uvicorn_access_args(tmp_path: Path) -> None:
    settings = Settings(
        database_url="postgresql://localhost/wedding",
        log_file_path=str(tmp_path / "app.log"),
        _env_file=None,
    )
    configure_logging(settings, force=True)

    record = logging.getLogger("uvicorn.access").makeRecord(
        "uvicorn.access",
        logging.INFO,
        __file__,
        1,
        '%s - "%s %s HTTP/%s" %d',
        ("127.0.0.1:54321", "GET", "/api/guests", "1.1", 200),
        None,
    )

    formatted = AccessFormatter(
        '%(client_addr)s - "%(request_line)s" %(status_code)s'
    ).format(record)

    assert "127.0.0.1:54321" in formatted
    assert "GET /api/guests HTTP/1.1" in formatted
    assert "200" in formatted


def test_guest_creation_logs_business_events(
    caplog,
    clean_test_guests: None,
    client: TestClient,
    guest_payload_factory: Callable[..., dict[str, object]],
) -> None:
    payload = guest_payload_factory(name="Logged Guest")

    with caplog.at_level(logging.INFO, logger="app.api.guests"):
        response = client.post("/api/guests", json=payload)

    assert response.status_code == 201
    messages = [record.getMessage() for record in caplog.records]
    assert "guest_create_started" in messages
    assert "guest_created" in messages
    assert str(payload["email"]) not in caplog.text


def test_guest_duplicate_logs_rejection_without_email(
    caplog,
    clean_test_guests: None,
    client: TestClient,
    guest_payload_factory: Callable[..., dict[str, object]],
) -> None:
    payload = guest_payload_factory(name="Duplicate Logged Guest")
    assert client.post("/api/guests", json=payload).status_code == 201

    with caplog.at_level(logging.WARNING, logger="app.api.guests"):
        response = client.post("/api/guests", json=payload)

    assert response.status_code == 400
    messages = [record.getMessage() for record in caplog.records]
    assert "guest_create_rejected" in messages
    assert str(payload["email"]) not in caplog.text


def test_missing_guest_logs_warning(caplog, client: TestClient) -> None:
    with caplog.at_level(logging.WARNING, logger="app.api.guests"):
        response = client.get("/api/guests/999999")

    assert response.status_code == 404
    assert "guest_not_found" in [record.getMessage() for record in caplog.records]
