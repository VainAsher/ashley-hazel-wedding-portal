from __future__ import annotations

import logging

from app.utils.secrets import SecretMasker


_ORIGINAL_RECORD_FACTORY = logging.getLogRecordFactory()
_LOGGING_CONFIGURED = False


class SecretMaskingFilter(logging.Filter):
    """Redact secret-looking values from log records."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.msg = SecretMasker.mask(record.getMessage())
        record.args = ()
        if record.exc_text:
            record.exc_text = SecretMasker.mask(record.exc_text)
        return True


def configure_logging() -> None:
    global _LOGGING_CONFIGURED
    if _LOGGING_CONFIGURED:
        return

    def secret_masking_record_factory(*args, **kwargs):
        record = _ORIGINAL_RECORD_FACTORY(*args, **kwargs)
        record.msg = SecretMasker.mask(record.getMessage())
        record.args = ()
        return record

    logging.setLogRecordFactory(secret_masking_record_factory)
    _LOGGING_CONFIGURED = True
