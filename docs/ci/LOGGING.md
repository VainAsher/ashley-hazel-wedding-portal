# Backend Logging

The backend uses Python logging with two configured handlers:

- Console logs in a readable text format.
- Rotating file logs as one JSON object per line.

`app.logging.configure_logging()` is called during application startup.
Log records pass through secret masking before they reach handlers.

## Configuration

Set these environment variables in `production/backend/.env`:

```bash
LOG_LEVEL=INFO
LOG_FILE_PATH=logs/app.log
LOG_MAX_BYTES=10485760
LOG_BACKUP_COUNT=5
```

Set `LOG_FILE_PATH=` to disable file logging. Relative paths are resolved from
the backend process working directory.

## Event Naming

Use short event names as messages, such as:

- `guest_create_started`
- `guest_created`
- `guest_update_rejected`
- `guest_deleted`

Add structured metadata through `extra`, but keep it operational:

```python
logger.info("guest_created", extra={"guest_id": guest.id, "wedding_id": guest.wedding_id})
```

## PII And Secrets

Do not log guest email addresses, phone numbers, free-form notes, database URLs,
tokens, API keys, JWTs, or request bodies.

The logging filter redacts common secret patterns and sensitive `extra` keys
such as `password`, `secret`, `token`, `api_key`, `jwt`, and `database_url`.
This is a safety net, not permission to log sensitive values.

## Validation

Run:

```bash
cd production/backend
python scripts/validate_config.py
python -m pytest tests/test_logging.py -q
```

The config validator prints the active log level and log file path without
printing credentials.
