import pytest
from pydantic import ValidationError

from app.config import Environment, Settings


def test_settings_require_database_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)

    with pytest.raises(ValidationError) as exc_info:
        Settings(_env_file=None)

    assert "database_url" in str(exc_info.value)


def test_settings_load_database_and_pool_values() -> None:
    settings = Settings(
        database_url="postgresql://user:password@localhost:5432/wedding",
        database_echo_sql=True,
        db_pool_size=5,
        db_max_overflow=7,
        api_url="http://localhost:3001",
        frontend_url="http://localhost:3000",
        log_backup_count=3,
        log_file_path="logs/test.log",
        log_level="debug",
        log_max_bytes=2048,
        metrics_enabled=False,
        session_cookie_secure=True,
        session_max_age_seconds=3600,
        session_secret_key="test-session-secret-32-characters",
        slow_query_threshold_ms=750.0,
        slow_request_threshold_ms=250.0,
        sentry_dsn="https://public@example.invalid/123",
        sentry_environment="staging",
        sentry_release="abc123def",
        sentry_sample_rate=0.25,
        _env_file=None,
    )

    assert settings.database_url == "postgresql://user:password@localhost:5432/wedding"
    assert settings.database_echo_sql is True
    assert settings.db_pool_size == 5
    assert settings.db_max_overflow == 7
    assert settings.api_url == "http://localhost:3001"
    assert settings.frontend_url == "http://localhost:3000"
    assert settings.log_backup_count == 3
    assert settings.log_file_path == "logs/test.log"
    assert settings.log_level == "DEBUG"
    assert settings.log_max_bytes == 2048
    assert settings.metrics_enabled is False
    assert settings.session_cookie_secure is True
    assert settings.session_max_age_seconds == 3600
    assert settings.session_secret_key == "test-session-secret-32-characters"
    assert settings.slow_query_threshold_ms == 750.0
    assert settings.slow_request_threshold_ms == 250.0
    assert settings.sentry_dsn == "https://public@example.invalid/123"
    assert settings.sentry_environment == "staging"
    assert settings.sentry_release == "abc123def"
    assert settings.sentry_sample_rate == 0.25


def test_settings_validate_app_port() -> None:
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            database_url="postgresql://user:password@localhost:5432/wedding",
            app_port=70000,
            _env_file=None,
        )

    assert "app_port" in str(exc_info.value)


def test_settings_validate_log_level() -> None:
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            database_url="postgresql://user:password@localhost:5432/wedding",
            log_level="verbose",
            _env_file=None,
        )

    assert "LOG_LEVEL" in str(exc_info.value)


def test_settings_validate_sentry_sample_rate() -> None:
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            database_url="postgresql://user:password@localhost:5432/wedding",
            sentry_sample_rate=1.1,
            _env_file=None,
        )

    assert "sentry_sample_rate" in str(exc_info.value)


@pytest.mark.parametrize(
    "field_name",
    ["slow_request_threshold_ms", "slow_query_threshold_ms"],
)
def test_settings_validate_metrics_thresholds(field_name: str) -> None:
    values: dict[str, object] = {
        "database_url": "postgresql://user:password@localhost:5432/wedding",
        "_env_file": None,
    }
    values[field_name] = -1.0

    with pytest.raises(ValidationError) as exc_info:
        Settings(**values)

    assert field_name in str(exc_info.value)


def test_environment_validation_rejects_invalid_sentry_dsn() -> None:
    settings = Settings(
        database_url="postgresql://user:password@localhost:5432/wedding",
        sentry_dsn="http://not-sentry.example/123",
        _env_file=None,
    )

    assert "SENTRY_DSN must be a valid HTTPS Sentry DSN" in settings.environment_errors()


def test_settings_use_raw_cors_override() -> None:
    settings = Settings(
        database_url="postgresql://user:password@localhost:5432/wedding",
        environment=Environment.STAGING,
        cors_origins_raw="https://one.example.test, https://two.example.test",
        _env_file=None,
    )

    assert settings.get_cors_origins() == [
        "https://one.example.test",
        "https://two.example.test",
    ]


def test_production_environment_validation_rejects_unsafe_values() -> None:
    settings = Settings(
        database_url="postgresql://user:password@localhost:5432/wedding",
        environment=Environment.PRODUCTION,
        debug=True,
        api_url="http://api.example.test",
        frontend_url="https://example.test",
        cors_origins_raw="http://localhost:3000",
        jwt_secret="replace-with-production-jwt-secret",
        api_key_secret="dev-api-key-secret",
        session_secret_key="dev-session-secret",
        _env_file=None,
    )

    errors = settings.environment_errors()

    assert "DEBUG must be false outside development" in errors
    assert "Production CORS origins cannot include localhost" in errors
    assert "Production CORS origins must use HTTPS" in errors
    assert "API_URL must use HTTPS in production" in errors
    assert any("JWT_SECRET must be replaced" in error for error in errors)
    assert any("API_KEY_SECRET must be replaced" in error for error in errors)
    assert any("SESSION_SECRET_KEY must be replaced" in error for error in errors)


def test_production_environment_validation_accepts_safe_values() -> None:
    settings = Settings(
        database_url="postgresql://user:password@db.example.test:5432/wedding",
        environment=Environment.PRODUCTION,
        debug=False,
        api_url="https://api.example.test",
        frontend_url="https://example.test",
        cors_origins_raw="https://example.test",
        jwt_secret="production-jwt-secret-32-chars",
        api_key_secret="production-api-secret-32-chars",
        session_cookie_secure=True,
        session_secret_key="production-session-secret-32-chars",
        _env_file=None,
    )

    settings.validate_for_startup()


def test_masked_database_location_omits_credentials() -> None:
    settings = Settings(
        database_url="postgresql://user:supersecret@db.example.test:5432/wedding",
        _env_file=None,
    )

    assert settings.masked_database_location() == "db.example.test:5432/wedding"
    assert "supersecret" not in settings.masked_database_location()
