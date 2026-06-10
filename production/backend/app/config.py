from enum import Enum
from functools import lru_cache

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

    def get_cors_origins(self) -> list[str]:
        origins_by_environment = {
            Environment.DEVELOPMENT: self.cors_origins_development,
            Environment.STAGING: self.cors_origins_staging,
            Environment.PRODUCTION: self.cors_origins_production,
        }
        origins = [
            origin.strip()
            for origin in origins_by_environment[self.environment].split(",")
            if origin.strip()
        ]

        if not origins:
            raise ValueError("At least one CORS origin must be configured")

        if "*" in origins:
            raise ValueError("Wildcard CORS origins are not allowed")

        return origins


@lru_cache
def get_settings() -> Settings:
    return Settings()
