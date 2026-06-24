# Ashley & Hazel Wedding Portal

[![Tests](https://github.com/VainAsher/ashley-hazel-wedding-portal/actions/workflows/test.yml/badge.svg)](https://github.com/VainAsher/ashley-hazel-wedding-portal/actions/workflows/test.yml)

A full-stack wedding portal: a guest-facing site (RSVP, schedule, blessings, photo
gallery) and an admin planning dashboard (guests, budget, vendors, events, timeline,
communications, invitations, settings). **Status: V1.0 release candidate.**

> The original static design concept lives at the repo root (`index.html`, `app.js`,
> `styles.css`, `data/fixture.js`) and is kept only as a visual reference. The real
> application is under `production/`.

## Stack

- **Backend** — Python / FastAPI + SQLAlchemy, PostgreSQL, session-cookie auth with three
  roles (`guest`, `coordinator`, `couple`), plus `/health` (liveness) and `/health/ready`
  (DB-readiness) endpoints (`production/backend`)
- **Frontend** — React + TypeScript + Vite, React Query, Radix/shadcn UI, Tailwind (`production/frontend`)
- **Database** — PostgreSQL with SQL migrations (`production/database`)
- **Delivery** — Docker Compose, Nginx (serves the SPA + proxies `/api` and `/uploads`), GitHub Actions CI/CD to a staging host via a Cloudflare Tunnel

## Features

**Guest portal** (invite-code login): Dashboard (countdown + key details), RSVP (meal/dietary/plus-one),
Schedule, Blessings guestbook, and a Gallery to view approved photos and submit their own.

**Admin dashboard** (coordinator/couple): Budget (line items + summary), Vendors, Events, Timeline
(task board), RSVP overview, Invitations (invite-code generation), Communications, Gallery moderation
(approve/reject submissions), Blessings moderation, and Settings — including a **wedding phase
lifecycle** (Planning → Live → Event → Archived) that gates guest RSVP.

## Running locally

Backend (needs a PostgreSQL with the schema applied — see `production/database`):

```bash
cd production/backend
pip install -r requirements.txt
uvicorn app.main:app --port 3001        # or: python -m app.main
```

Frontend:

```bash
cd production/frontend
npm ci
npm run dev          # Vite dev server on :3000, proxies /api -> :3001
npm run build        # production build
```

## Testing

- **Backend**: `cd production/backend && python -m pytest tests` (needs a test PostgreSQL).
- **Frontend e2e** (Playwright, mocked + against the real backend): `cd production/frontend && npm test`.
- CI runs both on every push to `main`.

## Deployment

Pushing to `main` runs **Tests**; on success the **Deploy** workflow ships to staging
(`workflow_run`, gated by the `DEPLOY_ENABLED` variable). Production is a manual
`workflow_dispatch`. See `docs/ci/` for the full pipeline, environments, and runbooks.

## Documentation

- `docs/ARCHITECTURE.md` — system architecture, auth, data model, API surface, CI/CD
- `docs/ci/` — deployment, environments, GitHub Actions, logging, monitoring, e2e
- `docs/privacy/DATA_BOUNDARY.md` — what may/may not be stored (use synthetic data until approved)
- `production/backend/docs/SECURITY.md`, `production/database/*_STRATEGY.md` — security & DB design

## Data boundary

Use synthetic/placeholder data only until the boundary in `docs/privacy/DATA_BOUNDARY.md`
is approved for real wedding data.
