import pytest
from pydantic import ValidationError

from app.config import Settings


def test_settings_require_database_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)

    with pytest.raises(ValidationError) as exc_info:
        Settings(_env_file=None)

    assert "database_url" in str(exc_info.value)


def test_settings_load_database_and_pool_values() -> None:
    settings = Settings(
        database_url="postgresql://user:password@localhost:5432/wedding",
        db_pool_size=5,
        db_max_overflow=7,
        _env_file=None,
    )

    assert settings.database_url == "postgresql://user:password@localhost:5432/wedding"
    assert settings.db_pool_size == 5
    assert settings.db_max_overflow == 7


def test_settings_validate_app_port() -> None:
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            database_url="postgresql://user:password@localhost:5432/wedding",
            app_port=70000,
            _env_file=None,
        )

    assert "app_port" in str(exc_info.value)
