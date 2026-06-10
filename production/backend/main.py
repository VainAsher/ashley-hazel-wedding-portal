"""Compatibility entrypoint for running the backend from this directory."""

from app.main import app


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=3001)
