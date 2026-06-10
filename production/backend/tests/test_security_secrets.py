import logging

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.logging import SecretMaskingFilter, configure_logging
from app.main import unhandled_exception_handler
from app.utils.secrets import SecretMasker


def test_mask_database_url() -> None:
    text = "postgresql://user:mypassword123@localhost:5432/wedding"

    masked = SecretMasker.mask(text)

    assert "mypassword123" not in masked
    assert "postgresql://user:***REDACTED***@localhost:5432/wedding" == masked


def test_mask_api_key_and_jwt() -> None:
    text = "api_key=sk-1234567890abcdef token=eyJabc.def123.ghi456"

    masked = SecretMasker.mask(text)

    assert "sk-1234567890abcdef" not in masked
    assert "eyJabc.def123.ghi456" not in masked
    assert masked.count("***REDACTED***") == 2


def test_logging_filter_masks_secret_values(caplog) -> None:
    logger = logging.getLogger("tests.secret-mask")
    logger.addFilter(SecretMaskingFilter())

    with caplog.at_level(logging.ERROR, logger="tests.secret-mask"):
        logger.error("database_url=postgresql://user:supersecret@localhost:5432/wedding")

    assert "supersecret" not in caplog.text
    assert "***REDACTED***" in caplog.text


def test_configured_logging_masks_child_logger_records(caplog) -> None:
    configure_logging()
    logger = logging.getLogger("app.tests.secret-mask")

    with caplog.at_level(logging.ERROR, logger="app.tests.secret-mask"):
        logger.error("password=supersecret")

    assert "supersecret" not in caplog.text
    assert "password=***REDACTED***" in caplog.text


def test_unhandled_exception_response_does_not_expose_secret() -> None:
    app = FastAPI()
    app.add_exception_handler(Exception, unhandled_exception_handler)

    @app.get("/explode")
    async def explode():
        raise RuntimeError("postgresql://user:supersecret@localhost:5432/wedding")

    client = TestClient(app, raise_server_exceptions=False)

    response = client.get("/explode")

    assert response.status_code == 500
    assert response.json() == {"detail": "Internal server error"}
    assert "supersecret" not in response.text
