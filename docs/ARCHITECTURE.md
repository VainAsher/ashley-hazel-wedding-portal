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
- **Roles**: `guest`, `coordinator`, `couple`. Route guards: `require_guest` (any
  authenticated role), `require_coordinator` (couple OR coordinator), `require_couple`
  (couple only). Frontend mirrors this with `RequireGuest` / `RequireAdmin` and
  `HomeRedirect` (guests land on `/dashboard`, staff on `/admin`). Note: the SQL
  `user_role` enum also defines a fourth value, `wedding_party`, that the auth system does
  not use.
- Everything is **wedding-scoped**: each request operates on `current_user.wedding_id`;
  create endpoints derive `wedding_id` from the session (clients never send it).

## Wedding phase lifecycle

`weddings.phase` ∈ `planning | live | event | archived` (default `live`), editable in
Settings and surfaced to guests via `UserResponse.wedding_phase`. Guest RSVP submission
and Dancefloor song requests are gated to the `live` phase (backend 403 + a
phase-specific message on the guest pages).

## Data model (PostgreSQL)

Core: `weddings` (incl. `theme` JSONB — the couple-configurable guest-site theme;
NULL = defaults), `users`, `guests`, `invites`. Planning: `budget_categories`,
`budget_items`, `vendors`, `events`, `tasks`. Guest engagement: `gallery_items`
(status `pending|approved|rejected`), `blessings` (`hidden` flag), `song_requests`
(status `pending|approved|rejected|blocked`, plus `pinned`/`position` for playlist
curation and oEmbed-resolved metadata columns), `communications`.
Schema is created by `production/database/schema.sql` on first boot; incremental
changes are numbered SQL migrations in `production/database/migrations/` (applied by
`deploy.sh` via a `schema_migrations` ledger, and listed explicitly in CI `test.yml`).

> Note: `schema.sql` also defines five tables **reserved for future expansion** —
> `users`, `tables`, `seating_arrangements`, `gifts`, and `attire`. These are
> intentional, labelled placeholders (see the `FUTURE EXPANSION` comments in
> `schema.sql`): they have no ORM model or API yet. In V1, auth is driven by
> `invites` + `guests` (not `users`), and seating is denormalized onto
> `guests.table_number` / `guests.seat_number` rather than the `tables` /
> `seating_arrangements` tables. They will be wired up when those features are built.

## API surface (by area)

Access column uses the route-guard names: `require_guest` (any authenticated role),
`require_coordinator` (couple/coordinator), `require_couple` (couple only).

| Endpoint(s) | Purpose | Access |
|---|---|---|
| `/api/auth` — `POST /login`, `GET /me`, `POST /logout` | login / me / logout | public / session |
| `/api/guests` — `GET ""`, `POST ""`, `PUT /{id}`, `DELETE /{id}` | guest CRUD | require_coordinator |
| `/api/guests` — `GET /{id}`, `PATCH /{id}` | guest RSVP self-update | require_guest |
| `/api/invites` — full CRUD | invite-code management | require_couple |
| `/api/budget` — items + categories + summary | budget | require_coordinator |
| `/api/vendors`, `/api/events`, `/api/tasks` | planning CRUD | require_coordinator |
| `/api/communications` | guest messages + send | require_coordinator |
| `/api/gallery` — `GET ""`, `POST ""`, `PATCH /{id}`, `DELETE /{id}` | admin list/upload/moderate | require_coordinator |
| `/api/gallery` — `POST /submit`, `GET /approved` | guest submit / view approved | require_guest |
| `/api/blessings` — `GET ""`, `POST ""` | guest list/post | require_guest |
| `/api/blessings` — `GET /all`, `PATCH /{id}`, `DELETE /{id}` | admin moderation | require_coordinator |
| `/api/music` — `POST /requests`, `GET /requests/wall` | guest song requests + approved song wall | require_guest |
| `/api/music` — `GET /requests`, `PATCH`/`DELETE /requests/{id}`, `POST /requests/{id}/merge`, `GET /export` | curation, duplicate merge, DJ-pack export (csv/text) | require_coordinator |
| `/api/portal/wedding`, `/api/portal/schedule` | guest-readable wedding info + events | require_guest |
| `/api/portal/theme` | guest-site theme (colours + tint) | **public** (pre-login invite page) |
| `/api/settings/wedding` — `GET`/`PUT` | wedding details + phase | require_coordinator |
| `/health`, `/health/ready` | liveness / DB-readiness | public |

## Frontend structure

- `src/pages/` — guest pages (Dashboard, RSVP, Schedule, Blessings, Music ("Dancefloor"),
  Gallery, Invite) and `src/pages/admin/` — admin modules (Budget, Vendors, Events,
  Timeline, RsvpAdmin, Communications, Gallery, Music, Blessings, Settings, Invitations)
  + the Admin dashboard.
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

## Theming

The visual identity comes from the couple's original prototype (repo-root
`index.html`/`styles.css`): deep plum, sun gold, cream, Georgia display type. It's
implemented as CSS custom properties (`src/styles/design-tokens.css`) consumed by
Tailwind. The couple can retune it live from **Settings → Guest Site Theme** (accent
colour, deep colour, photo-tint strength): values persist in `weddings.theme` (JSONB),
are served by the public `GET /api/portal/theme`, and `ThemeApplier`
(`src/hooks/useTheme.ts` + `src/lib/theme.ts`) rewrites the CSS variables at runtime —
including the pre-login invite page. Guest pages render one of the couple's photos
(`public/backgrounds/`) behind the content under a theme-derived radial tint.

## Music metadata (oEmbed)

Pasted Spotify/YouTube links on song requests are resolved best-effort at submission
time via the providers' **public oEmbed endpoints** (`app/utils/music_metadata.py`) —
no API keys, 3s timeout, failure never blocks a submission. There are deliberately no
other external integrations and no background workers.

## Gallery uploads

Guests/admins upload images (multipart). Files are stored under `/app/uploads/{wedding_id}/`
on the `uploads_data` volume, served by a FastAPI `StaticFiles` mount at `/uploads` and
proxied by Nginx (`location ^~ /uploads/`). The `Dockerfile` pre-creates the dir owned by
the non-root app user so the volume inherits write access.
