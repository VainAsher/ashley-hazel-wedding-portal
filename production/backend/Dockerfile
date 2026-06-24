# ---------- Stage 1: builder ----------
FROM python:3.12-slim AS builder

WORKDIR /app

# gcc kept defensively for any sdist fallback (psycopg2-binary/pydantic-core ship wheels).
RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc \
    && rm -rf /var/lib/apt/lists/*

# Install deps into an isolated prefix so they copy cleanly into a non-root runtime.
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ---------- Stage 2: runtime ----------
FROM python:3.12-slim AS runtime

# Unbuffered stdout/stderr (logs flush immediately); no .pyc clutter.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Non-root runtime user.
RUN useradd --create-home --uid 10001 appuser

# Bring installed packages + console scripts (uvicorn) onto the default path.
COPY --from=builder /install /usr/local

WORKDIR /app

# App source only (see .dockerignore). Owned by the non-root user.
COPY --chown=appuser:appuser . .

# Log and uploads dirs are volume mount points; must exist and be writable by
# appuser. Pre-creating uploads with appuser ownership means the named volume
# (uploads_data) inherits that ownership on first mount, and the StaticFiles
# mount / upload writes succeed whether or not a volume is attached.
RUN mkdir -p logs uploads && chown -R appuser:appuser logs uploads

USER appuser

EXPOSE 3001

# Working health check using stdlib only (no extra deps). Hits the DB-free /health.
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:3001/health').status==200 else 1)"

# Explicit uvicorn entrypoint; host/port fixed to match EXPOSE and the health check.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "3001"]
