# Environment Configuration

Week 2 Task 009 defines the configuration contract for development, staging,
and production.

## Files

| File | Purpose |
| --- | --- |
| `production/backend/.env.example` | Development template. Copy to `.env` for local work. |
| `production/backend/.env.staging` | Staging template. Replace placeholders before use. |
| `production/backend/.env.production` | Production template. Replace placeholders before use. |
| `production/backend/scripts/validate_config.py` | Runtime configuration validator. |

Real `.env` files remain ignored and must not be committed.

The Docker stack also reads `POSTGRES_USER` (default `wedding`) and
`POSTGRES_DB` (default `wedding_dev`) when composing `DATABASE_URL`;
`POSTGRES_PASSWORD` is mandatory (compose fails fast if unset).

## Required Runtime Values

All environments require:

- `ENVIRONMENT`
- `DATABASE_URL`
- `APP_HOST`
- `APP_PORT`
- CORS origins through `CORS_ORIGINS_RAW` or the environment-specific CORS key.
- Logging settings through `LOG_LEVEL`, `LOG_FILE_PATH`, `LOG_MAX_BYTES`, and
  `LOG_BACKUP_COUNT`.
- Optional Sentry settings through `SENTRY_DSN`, `SENTRY_ENVIRONMENT`,
  `SENTRY_RELEASE`, and `SENTRY_SAMPLE_RATE`.
- Optional Prometheus-compatible metrics through `METRICS_ENABLED` (default
  `true`), `SLOW_REQUEST_THRESHOLD_MS`, and `SLOW_QUERY_THRESHOLD_MS` (both
  default `500`).
- `DATABASE_ECHO_SQL` (default `false`) to log SQL — leave off outside debugging.

Staging and production also require:

- `API_URL`
- `FRONTEND_URL`
- `JWT_SECRET`
- `API_KEY_SECRET`
- `SESSION_SECRET_KEY` — the invite-code session signing key. Required outside
  development and must be at least 16 characters; the validator also rejects
  obvious dev/placeholder values.

`SESSION_COOKIE_SECURE` (default `false`) is forced to `true` in production via
`docker-compose.prod.yml`, since secure cookies require the HTTPS termination
Traefik provides.

Production requires HTTPS API, frontend, and CORS URLs. Production and staging
reject `DEBUG=true`, placeholder secrets, and development-style secrets (the
`JWT_SECRET` / `API_KEY_SECRET` / `SESSION_SECRET_KEY` rules above apply to all
three).

## Validate An Environment

Development:

```bash
cd production/backend
cp .env.example .env
python scripts/validate_config.py
```

Staging or production:

```bash
cd production/backend
cp .env.staging .env
# Replace DATABASE_URL, JWT_SECRET, and API_KEY_SECRET.
python scripts/validate_config.py
```

The validator prints a masked database location and never prints raw
credentials. It prints whether Sentry is enabled, but never prints the DSN.

## Deployment

`production/scripts/deploy.sh` loads `production/backend/.env` before applying
migrations and starting the backend, and re-validates that the required secrets
(`POSTGRES_PASSWORD`, `JWT_SECRET`, `API_KEY_SECRET`, `SESSION_SECRET_KEY`) are
present at deploy time, aborting if any are missing. Run the validator on the
deployment server before enabling automated deployment:

```bash
cd ~/wedding-dashboard/production/backend
set -a && . ./.env && set +a
venv/bin/python scripts/validate_config.py
```
