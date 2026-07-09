# Ashley & Hazel Wedding Portal

[![Tests](https://github.com/VainAsher/ashley-hazel-wedding-portal/actions/workflows/test.yml/badge.svg)](https://github.com/VainAsher/ashley-hazel-wedding-portal/actions/workflows/test.yml)

A full-stack wedding portal: a guest-facing site (RSVP, schedule, blessings,
Dancefloor song requests, photo gallery) and an admin planning dashboard (guests,
budget, vendors, events, timeline, communications, music curation, invitations,
theme, settings). **Status: live in production since v1.0.0 (2026-06-26); current
version `1.1.0-rc1`.**

> The original static prototype at the repo root (`index.html`, `app.js`,
> `styles.css`, `data/fixture.js`) is the **canonical visual identity** — its
> plum/gold/cream invitation look (and its Dancefloor concept) have been ported into
> the real application, which lives under `production/`.

## Stack

- **Backend** — Python / FastAPI + SQLAlchemy, PostgreSQL, session-cookie auth with three
  roles (`guest`, `coordinator`, `couple`), plus `/health` (liveness) and `/health/ready`
  (DB-readiness) endpoints (`production/backend`)
- **Frontend** — React + TypeScript + Vite, React Query, Radix/shadcn UI, Tailwind (`production/frontend`)
- **Database** — PostgreSQL with SQL migrations (`production/database`)
- **Delivery** — Docker Compose, Nginx (serves the SPA + proxies `/api` and `/uploads`), GitHub Actions CI/CD to a staging host via a Cloudflare Tunnel

## Features

**Guest portal** (invite-code login, themed with the couple's photos): Dashboard
(personal welcome, countdown + key details), RSVP (dietary requirements + plus-one;
meal selection opens when the menu is finalised), Schedule (ceremony + events),
Blessings guestbook, **Dancefloor** (song requests with dedications + the approved
song wall), and a Gallery with lightbox/slideshow viewing and guest photo submission.

**Admin dashboard** (coordinator/couple): Budget (line items + summary), Vendors, Events,
Timeline (task board), RSVP overview, Invitations (invite-code generation, couple-only),
Communications, Gallery moderation, **Music curation** (approve/reject/block song
requests, merge duplicates, pin/reorder the playlist, export a **DJ pack** as CSV or
text), Blessings moderation, and Settings — the **wedding phase lifecycle**
(Planning → Live → Event → Archived) that gates guest responses, plus **Guest Site
Theme** dials (colours + photo-tint strength, applied live, no deploy).

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

- **Backend**: `cd production/backend && python -m pytest tests` (needs a test PostgreSQL
  with the schema + migrations applied).
- **Frontend e2e** (Playwright, mocked + against the real backend): `cd production/frontend && npm test`.
- CI runs both on every push to `main`. **New migrations must also be added to the two
  explicit psql lists in `.github/workflows/test.yml`.**

## Deployment

Pushing to `main` runs **Tests**; on success the **Deploy** workflow ships to staging
(`workflow_run`, gated by the `DEPLOY_ENABLED` variable). Production is a manual
`workflow_dispatch`. See `docs/ci/` for the full pipeline, environments, and runbooks.

## Documentation

- `docs/guides/` — **user guides** (Guest, Coordinator, Couple, IT/Admin)
- `docs/ARCHITECTURE.md` — system architecture, auth, data model, API surface, CI/CD
- `docs/ci/` — deployment, environments, GitHub Actions, logging, monitoring, e2e; `PRODUCTION_RUNBOOK.md` for go-live
- `docs/privacy/DATA_BOUNDARY.md` — what may/may not be stored (use synthetic data until approved)
- `docs/FEEDBACK_BACKLOG.md` — running feedback/ideas/bugs log feeding the next update
- `production/backend/docs/SECURITY.md`, `production/database/*_STRATEGY.md` — security & DB design

## Data boundary

Use synthetic/placeholder data only until the boundary in `docs/privacy/DATA_BOUNDARY.md`
is approved for real wedding data.
