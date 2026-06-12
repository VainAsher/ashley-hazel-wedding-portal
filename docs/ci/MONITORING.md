# Error Tracking And Monitoring

Week 2 Task 014 adds optional Sentry error tracking for the backend API.
The code is safe to deploy without a Sentry account because tracking is disabled
until `SENTRY_DSN` is set.

## Trial Account Setup

1. Create or sign in to a Sentry account at `https://sentry.io/signup/`.
2. Create a new organization for the wedding portal trial if one does not exist.
3. Create a Python/FastAPI project.
4. Copy the project DSN from the Sentry project setup page.
5. Paste the DSN into the deployment environment as `SENTRY_DSN`.

Do not commit a real DSN to this repository. Store it in the deployment
environment or secret manager only.

## Backend Configuration

Set these variables in `production/backend/.env`:

```bash
SENTRY_DSN=
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=657747c1cae6d6fe7d92dd1fe7e0d72c3a69496b
SENTRY_SAMPLE_RATE=0.1
```

`SENTRY_DSN` is blank by default, which disables Sentry.
`SENTRY_ENVIRONMENT` should match `development`, `staging`, or `production`.
`SENTRY_RELEASE` should be the deployed git commit SHA.
`SENTRY_SAMPLE_RATE` controls error-event sampling from `0.0` to `1.0`.

Recommended sample rates:

- Development: `0.0`
- Staging: `0.5`
- Production: `0.1`

Task 014 intentionally leaves Sentry performance tracing disabled with
`traces_sample_rate=0.0`. Endpoint and database performance monitoring belongs
to Task 015.

## PII Redaction

The backend initializes Sentry with `send_default_pii=False` and scrubs events
before they leave the process.

Redaction covers:

- Authorization and cookie headers.
- Cookies.
- Email addresses.
- Phone-like values.
- Guest name fields.
- API keys, JWTs, tokens, passwords, secrets, DSNs, and database URLs.
- Breadcrumb messages and breadcrumb data.
- User context, preserving only a non-PII `id` when present.

This is a safety net. Application code should still avoid adding guest emails,
phone numbers, notes, request bodies, or secrets to logs and Sentry context.

## Verification

Before enabling a real DSN:

```bash
cd production/backend
python scripts/validate_config.py
python -m pytest tests/test_error_tracking.py -q
```

After setting a trial DSN in staging:

1. Restart the backend.
2. Confirm `python scripts/validate_config.py` reports `Sentry: enabled`.
3. Trigger a controlled server error in staging.
4. Confirm the error appears in the Sentry project.
5. Inspect the event payload and confirm PII is redacted.

## Incident Response

When Sentry reports a new backend error:

1. Check the Sentry environment and release fields.
2. Confirm the backend commit deployed on the VM.
3. Review the sanitized exception, request path, and breadcrumbs.
4. Reproduce locally or in staging using the same release.
5. Fix through the normal branch, PR, CI, merge, VM pull, and restart workflow.
