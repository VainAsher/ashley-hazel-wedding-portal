import os

from fastapi.testclient import TestClient

os.environ.setdefault("DATABASE_URL", "postgresql://user:password@localhost:5432/wedding")

from app.config import Environment, Settings
from app.main import app


client = TestClient(app)


def test_cors_allows_localhost_development_origin() -> None:
    response = client.options(
        "/api/guests",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 200
    assert response.headers.get("Access-Control-Allow-Origin") == "http://localhost:3000"


def test_cors_blocks_unconfigured_origin() -> None:
    response = client.options(
        "/api/guests",
        headers={
            "Origin": "http://attacker.com",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert "Access-Control-Allow-Origin" not in response.headers


def test_cors_preflight_lists_allowed_methods_and_headers() -> None:
    response = client.options(
        "/api/guests",
        headers={
            "Origin": "http://127.0.0.1:3100",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type",
        },
    )

    assert response.status_code == 200
    assert response.headers.get("Access-Control-Allow-Origin") == "http://127.0.0.1:3100"
    assert "POST" in response.headers.get("Access-Control-Allow-Methods", "")
    assert "Content-Type" in response.headers.get("Access-Control-Allow-Headers", "")


def test_security_headers_present() -> None:
    response = client.get("/health")

    assert response.headers.get("X-Content-Type-Options") == "nosniff"
    assert response.headers.get("X-Frame-Options") == "DENY"
    assert response.headers.get("X-XSS-Protection") == "1; mode=block"
    assert response.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"


def test_settings_use_environment_specific_origins() -> None:
    staging = Settings(
        database_url="postgresql://user:password@localhost:5432/wedding",
        environment=Environment.STAGING,
        cors_origins_staging="https://staging.example.test",
        _env_file=None,
    )
    production = Settings(
        database_url="postgresql://user:password@localhost:5432/wedding",
        environment=Environment.PRODUCTION,
        cors_origins_production="https://example.test",
        _env_file=None,
    )

    assert staging.get_cors_origins() == ["https://staging.example.test"]
    assert production.get_cors_origins() == ["https://example.test"]


def test_settings_reject_wildcard_origins() -> None:
    settings = Settings(
        database_url="postgresql://user:password@localhost:5432/wedding",
        cors_origins_development="*",
        _env_file=None,
    )

    try:
        settings.get_cors_origins()
    except ValueError as exc:
        assert "Wildcard" in str(exc)
    else:
        raise AssertionError("Wildcard CORS origins should be rejected")
