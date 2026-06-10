"""Compatibility entrypoint for running the backend from this directory."""

from app.main import app
from app.config import get_settings


if __name__ == "__main__":
    import uvicorn

    settings = get_settings()
    uvicorn.run(app, host=settings.app_host, port=settings.app_port)
