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
  `HomeRedirect` (guests land on `/dashboard`, staff on `/admin`); `RequireGuestOrCouple`
  additionally lets `couple`-role sessions reach guest-facing routes (needed once the
  couple could visit `/party/*` themselves). Note: the SQL `user_role` enum also
  defines a fourth value, `wedding_party`, that the auth system does not use.
- **Individual couple identity** (Wave 3 item 14): `invites` rows with `role='couple'`
  can now carry `partner_label` (display only, e.g. "Ashley"/"Hazel") and
  `associated_party` (`stag`/`hen` — which party is *that partner's own* do, driving
  the Stag/Hen access rule below). Previously there was one shared couple invite; the
  couple now issues one each.
- Everything is **wedding-scoped**: each request operates on `current_user.wedding_id`;
  create endpoints derive `wedding_id` from the session (clients never send it).

## Wedding phase lifecycle

`weddings.phase` ∈ `planning | live | event | archived` (default `live`), editable in
Settings and surfaced to guests via `UserResponse.wedding_phase`. Guest RSVP submission
and Dancefloor song requests are gated to the `live` phase (backend 403 + a
phase-specific message on the guest pages).

## Data model (PostgreSQL)

Core: `weddings` (incl. `theme` JSONB — colours **+ `display_font`/`body_font`/
`type_scale`**; NULL/absent = defaults — plus `now_playing_song_id`,
`meal_selection_open`, `party_visibility_mode` — see below), `users` (legacy, unused
by the app), `guests` (incl. `plus_one_meal_choice`), `invites` (incl.
`party`/`party_admin`/`party_title` for wedding-party flagging and
`partner_label`/`associated_party` for individual couple identity — see Roles above).
Planning: `budget_categories`, `budget_items`, `vendors`, `events`, `tasks` (incl.
`context` — `wedding`/`stag`/`hen`, which board it belongs to — and `position`, its
order within a column; both added for Kanban V2). Guest engagement: `gallery_items`
(status `pending|approved|rejected`, plus `thumb_path` — a ~480px derivative generated
on upload, backfillable), `blessings` (`hidden` flag), `song_requests` (status
`pending|approved|rejected|blocked`, plus `pinned`/`position` for playlist curation,
oEmbed-resolved metadata columns, and `preview_url` — a 30-second-clip match via the
iTunes Search API), `song_reactions` (one ♥ per invite per song, unique constraint),
`communications`, `notifications` (`kind` communication/mention/system, `read_at`,
fanned out by Communications' Send action), `feedback` (guest-submitted bug/idea
reports, `status` new/triaged/done), `menu_options` (name, description, dietary
flags, `active`), and the Stag/Hen party tables: `party_reveals` (the reversible
reveal-grant rows keyed by wedding/party/invite), `party_messages`
(blessings-pattern, `pinned`/`hidden`), `party_info` (free-text details per
wedding+party).
Schema is created by `production/database/schema.sql` on first boot; incremental
changes are numbered SQL migrations in `production/database/migrations/` (currently
through **021**; applied by `deploy.sh` via a `schema_migrations` ledger, and listed
explicitly in CI `test.yml`).

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
| `/api/guests` — `GET /{id}`, `PATCH /{id}` | guest RSVP self-update (meal fields gated by `meal_selection_open`) | require_guest |
| `/api/invites` — full CRUD (incl. `party`/`party_admin`/`partner_label`/`associated_party`) | invite-code + wedding-party management | require_couple |
| `/api/budget` — items + categories + summary | budget | require_coordinator |
| `/api/vendors`, `/api/events` | planning CRUD | require_coordinator |
| `/api/tasks` — `GET ""` (`?context=`), CRUD, `PATCH /{id}/move` | task board incl. drag/reorder | require_coordinator |
| `/api/communications` | guest messages + send (fans out `notifications` on Send) | require_coordinator |
| `/api/notifications` — `GET ""`, `POST /{id}/read`, `POST /read-all` | own notifications + unread count | require_guest |
| `/api/feedback` — `POST ""` | submit a bug/idea report | require_guest |
| `/api/feedback` — `GET ""`, `PATCH /{id}` | triage queue | require_coordinator |
| `/api/gallery` — `GET ""`, `POST ""`, `PATCH /{id}`, `DELETE /{id}`, `POST /thumbnails/backfill` | admin list/upload/moderate/thumbnail backfill | require_coordinator |
| `/api/gallery` — `POST /submit`, `GET /approved` | guest submit / view approved (thumb_url when available) | require_guest |
| `/api/blessings` — `GET ""`, `POST ""` | guest list/post | require_guest |
| `/api/blessings` — `GET /all`, `PATCH /{id}`, `DELETE /{id}` | admin moderation | require_coordinator |
| `/api/music` — `POST /requests`, `GET /requests/wall`, `POST`/`DELETE /requests/{id}/react` | guest song requests + approved song wall + ♥ reactions | require_guest |
| `/api/music` — `GET /requests`, `PATCH`/`DELETE /requests/{id}`, `POST /requests/{id}/merge`, `GET /export`, `PUT`/`GET /now-playing` | curation, duplicate merge, DJ-pack export, now-playing | require_coordinator |
| `/api/menu` | menu option CRUD | require_coordinator |
| `/api/portal/menu` | active menu options + `meal_selection_open` | require_guest |
| `/api/portal/wedding`, `/api/portal/schedule` | guest-readable wedding info + events | require_guest |
| `/api/portal/me/progress` | onboarding checklist booleans | require_guest |
| `/api/portal/theme` | guest-site theme (colours, tint, fonts, scale) | **public** (pre-login invite page) |
| `/api/party/access` | `{stag, hen}` nav-hint booleans (never the security boundary) | require_guest |
| `/api/party/{party}/summary`, `POST`/`PATCH /messages`, `PUT /info` | party content, gated by `has_party_access` (see below) | require_guest |
| `/api/party/{party}/reveal` | toggle a reveal-grant row | require_guest (see access rule) |
| `/api/settings/wedding` — `GET`/`PUT` | wedding details, phase, `party_visibility_mode` | require_coordinator |
| `/health`, `/health/ready` | liveness / DB-readiness | public |

**Stag/Hen access rule** (the one endpoint family that isn't a flat role check —
`app/api/party.py`'s `has_party_access`): a guest-role invite gets in iff
`invite.party == party`. A couple-role invite is excluded from their own
(`associated_party`) party by default, and their *partner's* party depends on
`weddings.party_visibility_mode` and any explicit `party_reveals` row — full truth
table in `docs/specs/PARTY_PORTALS_D1.md`. Coordinators are deliberately denied
content reads here (only the mutation endpoints), the one guest-facing surface they
don't get by default.

## Frontend structure

- `src/pages/` — guest pages (Dashboard, RSVP, Schedule, Blessings, Music ("Dancefloor"),
  Gallery, Invite, Party) and `src/pages/admin/` — admin modules (Budget, Vendors,
  Events, Timeline, RsvpAdmin, Communications, Gallery, Music, Blessings, Feedback,
  Settings, Invitations) + the Admin dashboard.
- `GuestLayout` / `AdminLayout` shells; routes + lazy-loading + guards in `App.tsx`.
  `GuestLayout` also renders the notifications bell, conditional Stag/Hen nav links
  (from `GET /api/party/access`), the feedback button, and the footer's "How this
  works" dialog.
- `src/components/taskboard/` — the Kanban V2 board (`TaskBoard`/`TaskCard`/
  `TaskColumn`), extracted so it can be mounted with a different `context` prop for
  Stag/Hen planning boards later (`docs/specs/KANBAN_V2.md`).
- `src/components/` — feature components shared across pages: `NotificationsBell`,
  `NotificationsCard`, `OnboardingChecklist`, `FeedbackWidget`, `EnvelopeReveal`,
  `HowThisWorksDialog`.
- `src/api/*` typed fetch modules; `src/hooks/*` React Query (queries + mutations with
  invalidation); shared UI in `src/components/ui/*`; shared helpers in `src/lib/`
  (`format.ts` for GBP currency/dates, `theme.ts` for the CSS-variable/font pipeline).

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
colour, deep colour, photo-tint strength, plus a **display/body font** pick-list and a
**type scale**): values persist in `weddings.theme` (JSONB), are served by the public
`GET /api/portal/theme`, and `ThemeApplier` (`src/hooks/useTheme.ts` + `src/lib/theme.ts`)
rewrites the CSS variables at runtime — including the pre-login invite page. A Google
Fonts `<link>` is injected only when a non-default font is chosen, so the site stays
dependency-free out of the box. Guest pages render one of the couple's photos
(`public/backgrounds/`) behind the content under a theme-derived radial tint.

## Music metadata & previews

Pasted Spotify/YouTube links on song requests are resolved best-effort at submission
time via the providers' **public oEmbed endpoints** (`app/utils/music_metadata.py`) —
no API keys, 3s timeout, failure never blocks a submission. Separately, on approval
(or via the admin "Match all previews" backfill), `app/utils/music_previews.py`
matches the song against the keyless **iTunes Search API** to fetch a 30-second
preview clip + artwork (token-overlap scoring rejects weak matches) — this is what
powers the guest Dancefloor jukebox and the "currently playing" spotlight. Both
integrations are deliberately keyless and best-effort; there are no other external
integrations and no background workers.

## Gallery uploads

Guests/admins upload images (multipart). Files are stored under `/app/uploads/{wedding_id}/`
on the `uploads_data` volume, served by a FastAPI `StaticFiles` mount at `/uploads` and
proxied by Nginx (`location ^~ /uploads/`). The `Dockerfile` pre-creates the dir owned by
the non-root app user so the volume inherits write access.
