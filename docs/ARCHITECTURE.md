# Architecture

The Ashley & Hazel Wedding Portal is a two-surface web app — a guest portal and an
admin dashboard — sharing one FastAPI backend and one PostgreSQL database, delivered
as Docker containers behind Nginx.

## Components

```
Browser ──► Nginx (frontend container, :80)
              ├─ serves the built React SPA (production/frontend/dist)
              ├─ proxies  /api/*     ─► backend:3001
              └─ proxies  /uploads/* ─► backend:3001  (gallery media, StaticFiles)
                                   │
                              FastAPI (backend container, :3001)
                                   └─► PostgreSQL (postgresql container, :5432)

Volumes: pgdata (DB), backend_logs, uploads_data (/app/uploads gallery files)
```

## Authentication & roles

- **Invite-code login**: `POST /api/auth/login` with an invite code creates a session
  (httpOnly cookie via Starlette `SessionMiddleware`). `GET /api/auth/me` returns the
  current user; `POST /api/auth/logout` clears it.
- **Roles**: `guest`, `coordinator`, `couple`. Route guards: `require_guest`,
  `require_coordinator`, `require_couple`. Frontend mirrors this with `RequireGuest` /
  `RequireAdmin` and `HomeRedirect` (guests land on `/dashboard`, staff on `/admin`).
- Everything is **wedding-scoped**: each request operates on `current_user.wedding_id`;
  create endpoints derive `wedding_id` from the session (clients never send it).

## Wedding phase lifecycle

`weddings.phase` ∈ `planning | live | event | archived` (default `live`), editable in
Settings and surfaced to guests via `UserResponse.wedding_phase`. Guest RSVP submission
is gated to the `live` phase (backend 403 + a phase-specific message on the RSVP page).

## Data model (PostgreSQL)

Core: `weddings`, `users`, `guests`, `invites`. Planning: `budget_categories`,
`budget_items`, `vendors`, `events`, `tasks`. Guest engagement: `gallery_items`
(status `pending|approved|rejected`), `blessings` (`hidden` flag), `communications`.
Schema is created by `production/database/schema.sql` on first boot; incremental
changes are numbered SQL migrations in `production/database/migrations/` (applied by
`deploy.sh` via a `schema_migrations` ledger, and listed explicitly in CI `test.yml`).

## API surface (by area)

| Prefix | Purpose | Access |
|---|---|---|
| `/api/auth` | login / me / logout | public / session |
| `/api/guests` | guest CRUD + guest RSVP self-update | coordinator / guest |
| `/api/invites` | invite-code management | coordinator |
| `/api/budget` | budget items + categories + summary | coordinator |
| `/api/vendors`, `/api/events`, `/api/tasks` | planning CRUD | coordinator |
| `/api/communications` | guest messages + send | coordinator |
| `/api/gallery` | admin list/upload/moderate; `/submit` + `/approved` for guests | coordinator / guest |
| `/api/blessings` | guest list/post; `/all` + moderate for admins | guest / coordinator |
| `/api/portal/{wedding,schedule}` | guest-readable wedding info + events | guest |
| `/api/settings/wedding` | wedding details + phase | coordinator |
| `/health`, `/health/ready` | liveness / DB-readiness | public |

## Frontend structure

- `src/pages/` — guest pages (Dashboard, RSVP, Schedule, Blessings, Gallery, Invite) and
  `src/pages/admin/` — admin modules (Budget, Vendors, Events, Timeline, RsvpAdmin,
  Communications, Gallery, Blessings, Settings, Invitations) + the Admin dashboard.
- `GuestLayout` / `AdminLayout` shells; routes + lazy-loading + guards in `App.tsx`.
- `src/api/*` typed fetch modules; `src/hooks/*` React Query (queries + mutations with
  invalidation); shared UI in `src/components/ui/*`; shared helpers in `src/lib/`
  (`format.ts` for GBP currency/dates).

## CI/CD

- **Tests** (`.github/workflows/test.yml`): backend pytest against a Postgres service +
  a real (un-mocked) login smoke test + the Playwright suite against the built backend
  image. New migrations must be added to its explicit psql list.
- **Deploy** (`.github/workflows/deploy.yml`): on Tests success (and `DEPLOY_ENABLED`),
  SSHes through a Cloudflare Tunnel and runs `production/scripts/deploy.sh` on the host —
  build → up → apply migrations → **reconcile the DB role password to the secret** →
  health + **`/health/ready` (DB-touching) gate** → record rollback tags. Production is a
  manual `workflow_dispatch`. Details and runbooks in `docs/ci/`.

## Gallery uploads

Guests/admins upload images (multipart). Files are stored under `/app/uploads/{wedding_id}/`
on the `uploads_data` volume, served by a FastAPI `StaticFiles` mount at `/uploads` and
proxied by Nginx (`location ^~ /uploads/`). The `Dockerfile` pre-creates the dir owned by
the non-root app user so the volume inherits write access.
