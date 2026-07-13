from enum import Enum
from functools import lru_cache
from urllib.parse import urlparse

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Environment(str, Enum):
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    environment: Environment = Environment.DEVELOPMENT
    debug: bool = False

    database_url: str = Field(min_length=1)
    database_echo_sql: bool = False
    db_pool_size: int = Field(default=10, ge=1)
    db_max_overflow: int = Field(default=20, ge=0)

    app_host: str = "0.0.0.0"
    app_port: int = Field(default=3001, ge=1, le=65535)
    api_url: str | None = None
    frontend_url: str | None = None

    cors_origins_raw: str | None = None
    cors_origins_development: str = (
        "http://localhost:3000,"
        "http://127.0.0.1:3000,"
        "http://localhost:3100,"
        "http://127.0.0.1:3100,"
        "http://localhost:5173,"
        "http://127.0.0.1:5173,"
        "http://192.168.0.32:3000"
    )
    cors_origins_staging: str = "https://staging.ashley-hazel-wedding.example"
    cors_origins_production: str = "https://ashley-hazel-wedding.example"
    jwt_secret: str = ""
    api_key_secret: str = ""
    log_level: str = "INFO"
    log_file_path: str | None = "logs/app.log"
    log_max_bytes: int = Field(default=10_485_760, ge=1)
    log_backup_count: int = Field(default=5, ge=0)
    sentry_dsn: str | None = None
    sentry_environment: str = "development"
    sentry_release: str | None = None
    sentry_sample_rate: float = Field(default=0.0, ge=0.0, le=1.0)
    metrics_enabled: bool = True
    slow_request_threshold_ms: float = Field(default=500.0, ge=0.0)
    slow_query_threshold_ms: float = Field(default=500.0, ge=0.0)
    session_secret_key: str = "dev-session-secret-change-in-production"
    session_cookie_secure: bool = False
    session_max_age_seconds: int = Field(default=2_592_000, ge=60)

    # Resend email delivery for Communications (channel="email"). Optional:
    # most weddings' comms are in-app/announcement only, so absence of an
    # API key must not fail app startup — email sending simply logs a
    # warning and is skipped until the couple supplies real credentials.
    resend_api_key: str | None = Field(default=None)
    email_from_address: str = Field(
        default="Ashley & Hazel <hello@ashley-and.hazel-of-halifax.com>"
    )

    @field_validator("log_level")
    @classmethod
    def normalize_log_level(cls, value: str) -> str:
        level = value.upper()
        allowed = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
        if level not in allowed:
            raise ValueError(f"LOG_LEVEL must be one of: {', '.join(sorted(allowed))}")
        return level

    def get_cors_origins(self) -> list[str]:
        if self.cors_origins_raw:
            origin_source = self.cors_origins_raw
        else:
            origins_by_environment = {
                Environment.DEVELOPMENT: self.cors_origins_development,
                Environment.STAGING: self.cors_origins_staging,
                Environment.PRODUCTION: self.cors_origins_production,
            }
            origin_source = origins_by_environment[self.environment]

        origins = [
            origin.strip()
            for origin in origin_source.split(",")
            if origin.strip()
        ]

        if not origins:
            raise ValueError("At least one CORS origin must be configured")

        if "*" in origins:
            raise ValueError("Wildcard CORS origins are not allowed")

        return origins

    @property
    def is_development(self) -> bool:
        return self.environment == Environment.DEVELOPMENT

    @property
    def is_staging(self) -> bool:
        return self.environment == Environment.STAGING

    @property
    def is_production(self) -> bool:
        return self.environment == Environment.PRODUCTION

    def environment_errors(self) -> list[str]:
        errors: list[str] = []

        try:
            cors_origins = self.get_cors_origins()
        except ValueError as exc:
            errors.append(str(exc))
            cors_origins = []

        if self.is_production or self.is_staging:
            if self.debug:
                errors.append("DEBUG must be false outside development")
            if not self.api_url:
                errors.append("API_URL is required outside development")
            if not self.frontend_url:
                errors.append("FRONTEND_URL is required outside development")

            for name, value in {
                "JWT_SECRET": self.jwt_secret,
                "API_KEY_SECRET": self.api_key_secret,
                "SESSION_SECRET_KEY": self.session_secret_key,
            }.items():
                if len(value) < 16:
                    errors.append(f"{name} must be at least 16 characters")
                lowered = value.lower()
                if (
                    "replace-with" in lowered
                    or "dev-" in lowered
                    or "change-in-production" in lowered
                ):
                    errors.append(f"{name} must be replaced for {self.environment.value}")

        if self.sentry_dsn:
            parsed_sentry_dsn = urlparse(self.sentry_dsn)
            if (
                parsed_sentry_dsn.scheme != "https"
                or not parsed_sentry_dsn.netloc
                or not parsed_sentry_dsn.path.strip("/")
            ):
                errors.append("SENTRY_DSN must be a valid HTTPS Sentry DSN")

        if self.is_production:
            for origin in cors_origins:
                if "localhost" in origin or "127.0.0.1" in origin:
                    errors.append("Production CORS origins cannot include localhost")
                if urlparse(origin).scheme != "https":
                    errors.append("Production CORS origins must use HTTPS")

            for name, value in {
                "API_URL": self.api_url,
                "FRONTEND_URL": self.frontend_url,
            }.items():
                if value and urlparse(value).scheme != "https":
                    errors.append(f"{name} must use HTTPS in production")

        return errors

    def validate_for_startup(self) -> None:
        errors = self.environment_errors()
        if errors:
            raise ValueError("Invalid environment configuration: " + "; ".join(errors))

    def masked_database_location(self) -> str:
        parsed = urlparse(self.database_url)
        if not parsed.hostname:
            return "<unparseable>"
        if parsed.port:
            return f"{parsed.hostname}:{parsed.port}/{parsed.path.lstrip('/')}"
        return f"{parsed.hostname}/{parsed.path.lstrip('/')}"


@lru_cache
def get_settings() -> Settings:
    return Settings()
