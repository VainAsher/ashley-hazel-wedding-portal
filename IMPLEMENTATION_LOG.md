# Wedding Dashboard Implementation Log

## Week 1: Foundation

### TASK-001: Import Database Schema
- Status: COMPLETE
- Date: 2026-06-10
- Time: 30 min
- PR: https://github.com/VainAsher/ashley-hazel-wedding-portal/pull/5
- Commit: 207ef7d
- Notes: Replaced the placeholder production schema with the full Ashley & Hazel wedding schema, imported it into the `wedding` database, and verified table/query health.
- Verification: Confirmed 13 public tables, 18 foreign key constraints, `SELECT COUNT(*) FROM guests`, and per-table row counts.
- Follow-up: Task docs reference 11 tables, but the full schema includes 13 tables because `gifts` and `attire` are present.

### TASK-002: Create Guest SQLAlchemy Model
- Status: COMPLETE
- Date: 2026-06-10
- Time: 45 min
- PR: https://github.com/VainAsher/ashley-hazel-wedding-portal/pull/7
- Commit: 4a8787b
- Notes: Added the backend DB package with SQLAlchemy engine/session helpers, shared `Base`, `RsvpStatus`, `Wedding`, and `Guest` mapped to the imported schema.
- Verification: Confirmed model imports, `Guest.__tablename__`, 16 mapped columns, `Base.metadata.tables`, live `SessionLocal` query against `guests`, and `compileall app/db`.
- Follow-up: The task snippet used `first_name`/`last_name`, but the actual imported schema has a single `name` column and RSVP/plus-one/seating fields.

### TASK-003: Create Guest CRUD API Endpoints
- Status: COMPLETE
- Date: 2026-06-10
- Time: 90 min
- PR: https://github.com/VainAsher/ashley-hazel-wedding-portal/pull/9
- Commit: fd1a7eb
- Notes: Added FastAPI guest CRUD routes, Pydantic create/update/response schemas, and router registration in `app/main.py`.
- Verification: Ran compile checks and curl-tested create, list, detail, update, validation error, missing guest 404, delete, and post-delete 404 on temporary port 3101.
- Follow-up: API follows the live schema with `wedding_id` and `name`, not the simplified `first_name`/`last_name` snippet.

### TASK-004: Create Guest API Tests
- Status: COMPLETE
- Date: 2026-06-10
- Time: 60 min
- PR: https://github.com/VainAsher/ashley-hazel-wedding-portal/pull/11
- Commit: 3e199eb
- Notes: Added pytest coverage for guest CRUD endpoints and added `httpx` so FastAPI `TestClient` can run.
- Verification: Ran `PYTHONPATH=. venv/bin/pytest tests/test_guests.py -v`; 8 tests passed.
- Follow-up: Tests isolate cleanup to guests with emails beginning `pytest-guest` and follow the actual `wedding_id`/`name` schema.

### TASK-005: Create Guest List Component
- Status: COMPLETE
- Date: 2026-06-10
- Time: 60 min
- PR: https://github.com/VainAsher/ashley-hazel-wedding-portal/pull/13
- Commit: 539516a
- Notes: Added typed React `GuestList` component with API fetch, loading, empty, error, table, and imperative refresh states.
- Verification: Ran `npm run build` in `production/frontend`; build passed in the VM frontend state.
- Follow-up: Frontend app shell files are still untracked setup state on the VM, so TASK-005 staged only the component file.

### TASK-006: Create Guest Form Component
- Status: COMPLETE
- Date: 2026-06-10
- Time: 75 min
- PR: https://github.com/VainAsher/ashley-hazel-wedding-portal/pull/15
- Commit: 3608906
- Notes: Added typed React `GuestForm` component with all guest-create fields, client validation, API submission, success/error states, form reset, and success callback.
- Verification: Bundled `GuestForm.tsx` directly with esbuild and ran `npm run build`; both passed in the VM frontend state.
- Follow-up: TASK-006 staged only the component file because the frontend app shell remains untracked setup state on the VM.

### TASK-007: Build Guests Page
- Status: COMPLETE
- Date: 2026-06-10
- Time: 60 min
- PR: https://github.com/VainAsher/ashley-hazel-wedding-portal/pull/17
- Commit: f2d6add
- Notes: Added `Guests` page combining `GuestForm` and `GuestList` with add/cancel toggle, count state, and refresh-after-create behavior.
- Verification: Bundled `Guests.tsx` directly with esbuild and ran `npm run build`; both passed in the VM frontend state.
- Follow-up: TASK-008 will wire the page into the app shell and navigation.

### TASK-008: Add Navigation & Integration
- Status: COMPLETE
- Date: 2026-06-10
- Time: 90 min
- PR: https://github.com/VainAsher/ashley-hazel-wedding-portal/pull/19
- Commit: 5e41e43
- Notes: Added React Router v6 app routing with Home, `/guests`, and fallback routes; tracked the Vite app shell files; configured Vite host/proxy behavior; and switched guest API defaults to relative `/api` paths for browser access and testability.
- Verification: Ran `npm run build`; ran `npm run test:browser` with Playwright desktop Chromium and Pixel 5 mobile projects covering home-to-guests navigation, direct `/guests` access, fallback routing, mocked guest data rendering, and no browser console/page errors.
- Follow-up: TASK-009 should expand the browser E2E coverage now that Playwright is installed and routed app access is available.

### TASK-009: End-to-End Testing
- Status: COMPLETE
- Date: 2026-06-10
- Time: 120 min
- PR: https://github.com/VainAsher/ashley-hazel-wedding-portal/pull/21
- Commit: 5bbc189
- Notes: Added the missing UI affordances needed for E2E coverage: guest detail viewing, edit mode, delete actions, page-level success/error feedback, stable browser labels, and deterministic Playwright tests for guest-management flows.
- Verification: Ran backend pytest (`8 passed`), `npm run build`, `npm run test:browser` (`8 passed`, `2 skipped` live tests by default), and a live full-stack Playwright run with `LIVE_E2E=1` against a temporary FastAPI server (`2 passed` across desktop Chromium and Pixel 5 mobile). Confirmed no leftover `live-e2e-*` database guests after validation.
- Follow-up: TASK-010 can use the merged per-task PRs and validation evidence to prepare the final Week 1 review package.

### TASK-010: Create PR & Validation
- Status: COMPLETE
- Date: 2026-06-10
- Time: 45 min
- PR: https://github.com/VainAsher/ashley-hazel-wedding-portal/pull/23
- Commit: aa7e46a
- Notes: Added `WEEK_1_VALIDATION_REPORT.md` as the final review package because Tasks 1-9 were already merged through separate implementation and documentation PRs.
- Verification: Re-ran validation from merged `main`: backend pytest (`8 passed`), `npm run build`, `npm run test:browser` (`8 passed`, `2 skipped` live tests by default), and live full-stack Playwright (`2 passed` across desktop Chromium and Pixel 5 mobile). Confirmed `0` leftover `live-e2e-*` guests.
- Follow-up: Week 1 foundation is ready for human review and Week 2 planning.

## Week 3: Auth + RSVP

### TASK-016: Auth Invite-Code Session Middleware
- Status: COMPLETE
- Date: 2026-06-12
- Time: 90 min
- PR: https://github.com/VainAsher/ashley-hazel-wedding-portal/pull/42
- Commit: 1f70a84
- Notes: Added invite-code authentication with an `invites` table, deterministic optional `guest_id` ownership mapping, Starlette session middleware, `/api/auth/login`, `/api/auth/me`, `/api/auth/logout`, session config, CI migration wiring, and demo invite seed data.
- Verification: Ran TDD red check (`Invite` missing), local-safe auth/config subset (`14 passed`), config validation, import smoke, disposable PostgreSQL schema plus migrations `002`-`005`, focused auth/config tests (`21 passed`), full backend pytest (`100 passed`), curl login/me/logout/invalid-invite verification, `git diff --check`, and GitHub Backend/Frontend CI.
- Follow-up: TASK-017 should add role-based FastAPI dependencies and apply coordinator/couple protection to guest-management routes while preserving authenticated guest access for future RSVP endpoints.

### TASK-017: Auth Role-Based Route Protection
- Status: COMPLETE
- Date: 2026-06-12
- Time: 90 min
- PR: https://github.com/VainAsher/ashley-hazel-wedding-portal/pull/44
- Commit: 2f34b4e
- Notes: Added reusable role gates (`require_couple()`, `require_coordinator()`, `require_guest()`), protected guest CRUD routes with coordinator/couple access, and updated guest-management, integration, and logging tests to use authenticated coordinator sessions.
- Verification: Ran `python -m pytest tests/test_auth.py -v` (`16 passed`), full backend pytest (`107 passed`), `git diff --check`, and GitHub Backend/Frontend CI on PR #44.
- Follow-up: TASK-018 should add the frontend invite-code form and route unauthenticated guests through `/invite`.

### TASK-018: Auth Invite-Code Form
- Status: COMPLETE
- Date: 2026-06-13
- Time: 75 min
- PR: https://github.com/VainAsher/ashley-hazel-wedding-portal/pull/45
- Commit: 8621c1f
- Notes: Added a typed frontend auth API helper, `/invite` page, invite-code validation, invalid-code and network-error states, success redirect to `/rsvp`, and invite-first routing for `/` and fallback routes.
- Verification: Captured TDD red check for missing `/invite` redirect, ran `npm run build`, focused invite Playwright (`5 passed`), full browser matrix (`38 passed`, `2 skipped`), GitHub Backend/Frontend CI, deployed revision `935a0a1` to homelab staging, seeded demo invite codes, and validated `DEMO-001` login through the staging tunnel.
- Follow-up: TASK-019 should add missing RSVP schema fields (`meal_choice`, `dietary_notes`) while preserving existing `rsvp_status`, plus-one, and timestamp fields.

### TASK-019: RSVP Guest Schema Fields
- Status: COMPLETE
- Date: 2026-06-13
- Time: 75 min
- PR: https://github.com/VainAsher/ashley-hazel-wedding-portal/pull/46
- Commit: 125e50d
- Notes: Added `meal_choice` and `dietary_notes` to the guests table, SQLAlchemy model, API schemas, base schema, migration set, fixtures, and RSVP persistence tests while preserving existing RSVP status, plus-one, and timestamp fields.
- Verification: Captured TDD red check for missing RSVP detail fields, applied disposable PostgreSQL schema plus migrations `002`-`006`, verified column types, ran focused schema tests (`4 passed`), focused DB-backed RSVP persistence (`1 passed`), guest-focused backend suite (`35 passed`), full backend pytest (`112 passed`), `git diff --check`, and GitHub Backend/Frontend CI on PR #46.
- Follow-up: TASK-020 should add an authenticated RSVP-specific PATCH endpoint so guests can update only their own RSVP and coordinators/couple can update any guest RSVP.

### TASK-020: RSVP Authenticated Guest API
- Status: COMPLETE
- Date: 2026-06-13
- Time: 75 min
- PR: https://github.com/VainAsher/ashley-hazel-wedding-portal/pull/47
- Commit: f8e9f46
- Notes: Added an authenticated RSVP-specific `PATCH /api/guests/{guest_id}` endpoint, allowed guests to read and update only their own RSVP state, allowed coordinator/couple sessions to update any guest RSVP, and added `GuestRSVPUpdate` validation for RSVP status, meal choices, dietary notes length, and plus-one names.
- Verification: Captured TDD red check for missing PATCH and guest-owned GET access, ran focused RSVP API tests (`10 passed`), auth/guest-focused backend suite (`61 passed`), full backend pytest (`122 passed`), frontend build, `git diff --check`, and GitHub Backend/Frontend CI on PR #47.
- Follow-up: TASK-021 should add the guest-facing RSVP form that reads the authenticated guest state and submits accepted/declined/tentative, meal choice, dietary notes, and plus-one name.
