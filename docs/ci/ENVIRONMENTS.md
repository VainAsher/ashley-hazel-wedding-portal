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

## Required Runtime Values

All environments require:

- `ENVIRONMENT`
- `DATABASE_URL`
- `APP_HOST`
- `APP_PORT`
- CORS origins through `CORS_ORIGINS_RAW` or the environment-specific CORS key.
- Logging settings through `LOG_LEVEL`, `LOG_FILE_PATH`, `LOG_MAX_BYTES`, and
  `LOG_BACKUP_COUNT`.

Staging and production also require:

- `API_URL`
- `FRONTEND_URL`
- `JWT_SECRET`
- `API_KEY_SECRET`

Production requires HTTPS API, frontend, and CORS URLs. Production and staging
reject `DEBUG=true`, placeholder secrets, and development-style secrets.

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
credentials.

## Deployment

`production/scripts/deploy.sh` loads `production/backend/.env` before applying
migrations and starting the backend. Run the validator on the deployment server
before enabling automated deployment:

```bash
cd ~/wedding-dashboard/production/backend
set -a && . ./.env && set +a
venv/bin/python scripts/validate_config.py
```
