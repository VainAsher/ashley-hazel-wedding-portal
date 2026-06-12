from __future__ import annotations

import json
import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Any

from app.config import Settings, get_settings
from app.utils.secrets import SecretMasker


_ORIGINAL_RECORD_FACTORY = logging.getLogRecordFactory()
_LOGGING_CONFIGURED = False
_RECORD_FACTORY_CONFIGURED = False
_HANDLER_MARKER = "_wedding_dashboard_handler"
_RESERVED_RECORD_KEYS = {
    "args",
    "asctime",
    "created",
    "exc_info",
    "exc_text",
    "filename",
    "funcName",
    "levelname",
    "levelno",
    "lineno",
    "module",
    "msecs",
    "message",
    "msg",
    "name",
    "pathname",
    "process",
    "processName",
    "relativeCreated",
    "stack_info",
    "thread",
    "threadName",
}
_SENSITIVE_KEY_PARTS = ("api_key", "apikey", "database_url", "jwt", "password", "secret", "token")


def is_sensitive_key(key: str | None) -> bool:
    if key is None:
        return False
    normalized = key.lower().replace("-", "_")
    return any(part in normalized for part in _SENSITIVE_KEY_PARTS)


def mask_value(value: Any, key: str | None = None) -> Any:
    if is_sensitive_key(key):
        return SecretMasker.REDACTION
    if isinstance(value, str):
        return SecretMasker.mask(value)
    if isinstance(value, dict):
        return {item_key: mask_value(item, item_key) for item_key, item in value.items()}
    if isinstance(value, list):
        return [mask_value(item) for item in value]
    if isinstance(value, tuple):
        return tuple(mask_value(item) for item in value)
    return value


class SecretMaskingFilter(logging.Filter):
    """Redact secret-looking values from log records."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.msg = SecretMasker.mask(record.getMessage())
        record.args = ()
        if record.exc_text:
            record.exc_text = SecretMasker.mask(record.exc_text)

        for key, value in list(record.__dict__.items()):
            if key in _RESERVED_RECORD_KEYS or key.startswith("_"):
                continue
            record.__dict__[key] = mask_value(value, key)

        return True


class JsonLogFormatter(logging.Formatter):
    """Format log records as one JSON object per line."""

    converter = staticmethod(logging.Formatter.converter)

    def format(self, record: logging.LogRecord) -> str:
        record.message = record.getMessage()
        payload: dict[str, Any] = {
            "timestamp": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "message": SecretMasker.mask(record.message),
        }

        for key, value in record.__dict__.items():
            if key in _RESERVED_RECORD_KEYS or key.startswith("_"):
                continue
            payload[key] = mask_value(value, key)

        if record.exc_info:
            payload["exception"] = SecretMasker.mask(self.formatException(record.exc_info))

        return json.dumps(payload, default=str, sort_keys=True)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)


def configure_logging(settings: Settings | None = None, *, force: bool = False) -> None:
    global _LOGGING_CONFIGURED, _RECORD_FACTORY_CONFIGURED

    if _LOGGING_CONFIGURED and not force:
        return

    settings = settings or get_settings()
    level = getattr(logging, settings.log_level)

    if not _RECORD_FACTORY_CONFIGURED:
        def secret_masking_record_factory(*args: Any, **kwargs: Any) -> logging.LogRecord:
            record = _ORIGINAL_RECORD_FACTORY(*args, **kwargs)
            record.msg = SecretMasker.mask(record.getMessage())
            record.args = ()
            return record

        logging.setLogRecordFactory(secret_masking_record_factory)
        _RECORD_FACTORY_CONFIGURED = True

    root_logger = logging.getLogger()
    root_logger.setLevel(level)

    for handler in list(root_logger.handlers):
        if getattr(handler, _HANDLER_MARKER, False):
            root_logger.removeHandler(handler)
            handler.close()

    mask_filter = SecretMaskingFilter()
    console_handler = logging.StreamHandler()
    console_handler.setLevel(level)
    console_handler.setFormatter(
        logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s")
    )
    console_handler.addFilter(mask_filter)
    setattr(console_handler, _HANDLER_MARKER, True)
    root_logger.addHandler(console_handler)

    if settings.log_file_path:
        log_path = Path(settings.log_file_path)
        log_path.parent.mkdir(parents=True, exist_ok=True)
        file_handler = RotatingFileHandler(
            log_path,
            backupCount=settings.log_backup_count,
            encoding="utf-8",
            maxBytes=settings.log_max_bytes,
        )
        file_handler.setLevel(level)
        file_handler.setFormatter(JsonLogFormatter())
        file_handler.addFilter(mask_filter)
        setattr(file_handler, _HANDLER_MARKER, True)
        root_logger.addHandler(file_handler)

    _LOGGING_CONFIGURED = True
