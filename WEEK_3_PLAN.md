# Week 3 Implementation Plan

**Date:** 2026-06-12
**Status:** Ready for implementation
**Goal:** Auth + RSVP flow (guest-facing value) + planning board foundation (admin capability)

---

## Context for Implementer

### Current State (as of TASK-015 merge)

**Backend:** Python/FastAPI/PostgreSQL, fully tested, deployable, metrics-instrumented
**Frontend:** React 18 + TypeScript + Vite, guest CRUD working, Playwright E2E passing
**Missing:** Auth, RSVP flow, admin planning features

**Canonical repos:**
- GitHub: `VainAsher/ashley-hazel-wedding-portal` (private)
- Local: `C:\dev\ashley-hazel-wedding-portal-prototype`

**Recent decisions:**
- Week 3 prioritizes guest-facing RSVP over admin planning (engagement > internal tools)
- VainCraft admin React components (`AdminTasks.tsx`, `AdminCalendarView.tsx`, etc.) are reuse targets for later
- Frontend stays React/Vite (no vanilla HTML migration)

---

## Week 3 Task Sequence

| Task | Title | Type | Est. Time | Depends |
|------|-------|------|-----------|---------|
| TASK-016 | Auth: Invite-code session middleware | Backend | 90 min | — |
| TASK-017 | Auth: Role-based route protection | Backend | 60 min | TASK-016 |
| TASK-018 | Auth: Invite-code form (guest portal) | Frontend | 60 min | TASK-016 |
| TASK-019 | RSVP: Extend guest model + schema | Backend | 60 min | TASK-017 |
| TASK-020 | RSVP: Update guest API (accept/decline/meal) | Backend | 75 min | TASK-019 |
| TASK-021 | RSVP: Guest form (accept/decline/meal picker) | Frontend | 90 min | TASK-020 |
| TASK-022 | RSVP: Guest page routing (invite → RSVP) | Frontend | 60 min | TASK-021 |
| TASK-023 | RSVP: Full-stack E2E tests | Both | 120 min | TASK-022 |
| TASK-024 | Planning: Task model + API skeleton | Backend | 90 min | TASK-017 |
| TASK-025 | Week 3 validation report | Both | 45 min | TASK-023 |

**Parallel possible:** TASK-016/017 can complete before TASK-018 starts.

---

## Implementation Prompts

### TASK-016: Auth: Invite-code Session Middleware

**Branch:** `week3/task-016-auth-invite-code`
**Type:** Backend (Python/FastAPI)

**Scope:**
Create an invite-code-based session system. Replace Discord OAuth with a simple invite-code lookup + session cookie. Endpoint: `POST /api/auth/login` accepts `{ invite_code }`, validates against a seeded invite list, and returns a session cookie. Provide a `get_current_user()` dependency for route protection.

**Implementation checklist:**
- [ ] Add `invites` table to PostgreSQL schema (code, wedding_id, household_name, role enum: couple/coordinator/guest, redeemed_at nullable)
- [ ] Add seed script to populate 2-3 test invites (invite codes: `DEMO-001`, `DEMO-COUPLE`, `DEMO-COORD`)
- [ ] FastAPI session config via `python-multipart` + `itsdangerous` for session signing
- [ ] `POST /api/auth/login` route: accept invite_code, validate, create session, return user object
- [ ] `POST /api/auth/logout` route: clear session
- [ ] `get_current_user()` dependency: decode session, raise 401 if invalid
- [ ] Tests: valid invite, invalid invite, logout, session expiry (optional 30-day TTL), concurrent sessions per invite
- [ ] Validation: `pytest tests/test_auth.py -v` (8+ tests), no secrets in logs, invite codes not stored in clear

**Reference:**
- VainCraft uses Discord OAuth + requireLevel middleware; adapt the role-gating pattern but swap identity lookup
- Wedding schema already has `users` table with `user_role` — align new invite system to it

**Notes:**
- Keep invite codes as generated strings (not guessable UUIDs); seeded invites are test data only
- Session should not expose invite code in serialized form
- Do not commit real invite codes to the repo

---

### TASK-017: Auth: Role-Based Route Protection

**Branch:** `week3/task-017-auth-rbac`
**Type:** Backend (Python/FastAPI)

**Scope:**
Build role-based access control on top of `get_current_user()`. Create middleware/dependencies for permission gates: `require_couple()`, `require_coordinator()`, `require_guest()`. Apply to existing guest CRUD routes and new RSVP routes.

**Implementation checklist:**
- [ ] `require_couple()` dependency: checks user role == couple, raises 403 if not
- [ ] `require_coordinator()` dependency: checks role in (couple, coordinator), raises 403 if not
- [ ] `require_guest()` dependency: checks role in (couple, coordinator, guest), raises 403 if not
- [ ] Apply `require_guest()` to guest CRUD routes (existing `GET /api/guests` is public for now; RSVP updates require auth)
- [ ] Apply `require_couple()` to budget/planning/admin routes (stubs for now)
- [ ] Tests: valid role access, invalid role 403, missing session 401
- [ ] Validation: `pytest tests/test_auth.py -v` (16+ tests), no role bypass, no hardcoded user IDs

**Notes:**
- Keep permission checks simple (no attribute-based policies yet)
- Couple role implicitly grants coordinator + guest permissions (hierarchy)
- Plan ahead: Week 3 TASK-024 will add couple-only routes for planning/budget

---

### TASK-018: Auth: Invite-Code Form (Guest Portal)

**Branch:** `week3/task-018-invite-form`
**Type:** Frontend (React/TypeScript)

**Scope:**
Build a guest-facing invite entry screen. Replace the landing page (or gate it behind the invite check). When guest enters invite code, validate via `POST /api/auth/login`, store session cookie, redirect to `/rsvp`.

**Implementation checklist:**
- [ ] New `pages/Invite.tsx`: text input for invite code, submit button, error handling
- [ ] Form: trim input, validate format (non-empty), POST to `/api/auth/login`
- [ ] Error states: invalid invite (red text "Code not found"), network error, success redirect
- [ ] Route: `GET /` redirects to `/invite` if no session; `GET /invite` shows form
- [ ] TypeScript types for auth API response (user object with role)
- [ ] Tests: valid invite input, invalid, network error, redirect on success

**Notes:**
- Session persistence: browser automatically includes session cookie on next request
- Keep form simple (no email verification, no multi-step for now)
- Plan ahead: home page layout once auth is working

---

### TASK-019: RSVP: Extend Guest Model + Schema

**Branch:** `week3/task-019-rsvp-schema`
**Type:** Backend (SQL + SQLAlchemy)

**Scope:**
Extend the `guests` table to capture RSVP state. Add columns: `rsvp_status` (enum: pending/accepted/declined/tentative), `meal_choice` (enum or fk to meals table), `dietary_notes` (text), `plus_one_name` (text nullable), `updated_at` (timestamp). Update SQLAlchemy model and Pydantic schema.

**Implementation checklist:**
- [ ] Create migration `005_add_rsvp_fields.sql`: add columns to guests table
- [ ] Update `Guest` SQLAlchemy model with new fields
- [ ] Update `GuestResponse` Pydantic schema to include new fields
- [ ] Migration is backward-compatible (nullable defaults)
- [ ] Tests: model can be instantiated with all fields, schema validates required vs optional

**Notes:**
- `rsvp_status` default = "pending"
- `meal_choice` can be string (e.g., "chicken", "vegetarian", "fish") for MVP; later → separate meals table if needed
- Plus-one handling: for now store name only (not a separate guest record)

---

### TASK-020: RSVP: Update Guest API (Accept/Decline/Meal)

**Branch:** `week3/task-020-rsvp-api`
**Type:** Backend (FastAPI)

**Scope:**
Add/update guest CRUD routes to handle RSVP submission. New route: `PATCH /api/guests/{guest_id}` accepts `{ rsvp_status, meal_choice, dietary_notes, plus_one_name }` and updates the guest. Only the guest (via session auth) or a coordinator can update their own RSVP.

**Implementation checklist:**
- [ ] `GuestRSVPUpdate` Pydantic schema: `rsvp_status`, `meal_choice`, `dietary_notes`, `plus_one_name` (all optional, not required)
- [ ] `PATCH /api/guests/{guest_id}` route: accept schema, validate guest_id matches session user or is coordinator, update DB
- [ ] Validation: rsvp_status is valid enum, meal_choice is valid choice, dietary_notes is <500 chars, no SQL injection
- [ ] Tests: guest updates own RSVP, coordinator updates guest RSVP, guest cannot update other guest, invalid status rejected
- [ ] Combine with existing `GET /api/guests/{guest_id}` to return full guest state including RSVP

**Notes:**
- Session should include guest_id or user_id so RSVP endpoint knows which guest is updating
- Keep PATCH generic (only send fields you want to change)
- Test with Playwright: submit form, confirm DB updated, reload page and see new state persisted

---

### TASK-021: RSVP: Guest Form (Accept/Decline/Meal Picker)

**Branch:** `week3/task-021-rsvp-form`
**Type:** Frontend (React/TypeScript)

**Scope:**
Build a guest RSVP form. Display guest name (from session), 3 radio buttons (Accept/Decline/Tentative), dropdown for meal choice (chicken/vegetarian/fish), textarea for dietary notes, plus-one name field, and submit. On success, show confirmation and disable form.

**Implementation checklist:**
- [ ] `pages/RSVP.tsx`: form with all fields
- [ ] Fetch GET `/api/guests/{guest_id}` on mount to pre-fill current state
- [ ] Radio group for rsvp_status, dropdown for meal, textareas for notes and plus-one
- [ ] Submit calls `PATCH /api/guests/{guest_id}` with form data
- [ ] Error handling: network error, validation error (show per-field), success message
- [ ] Disable form after submit (prevent double-submission)
- [ ] TypeScript types matching backend schema
- [ ] Tests: form renders, user can change selections, submit sends correct data

**Notes:**
- Pre-fill from current guest record so users can change their answer
- Meal choices: move to environment config or constants file (reusable)
- Layout: responsive for mobile (3 radio buttons should stack)

---

### TASK-022: RSVP: Guest Page Routing (Invite → RSVP)

**Branch:** `week3/task-022-guest-routing`
**Type:** Frontend (React/TypeScript)

**Scope:**
Wire together invite entry, RSVP form, and home page. Create a routing structure: unauthenticated users see invite form (`/invite`), authenticated guests see RSVP page (`/rsvp`), couple/coordinators see admin dashboard (stub for now, redirects to `/rsvp`).

**Implementation checklist:**
- [ ] Update `App.tsx` router: conditional routes based on role + session
- [ ] `useAuth()` hook: returns { user, isAuthenticated, role }
- [ ] PrivateRoute wrapper: redirects to `/invite` if not authenticated
- [ ] Routes: `/invite`, `/rsvp`, `/` (home, auth-required), `/admin` (couple/coordinator only, redirects)
- [ ] Persist session across page reload (session cookie handles it)
- [ ] Tests: unauthenticated redirects to invite, authenticated guest sees RSVP, couple redirects to admin stub

**Notes:**
- Don't build full admin dashboard yet (TASK-024 onwards)
- Home page can show couple/coordinator a simple stats view: "X RSVPs in, Y pending, Z declined"

---

### TASK-023: RSVP: Full-Stack E2E Tests

**Branch:** `week3/task-023-e2e-rsvp`
**Type:** Both (Playwright)

**Scope:**
Write end-to-end tests covering the full RSVP flow: guest enters invite code → logs in → sees RSVP form → changes selection → submits → database is updated → reloads page and sees persisted change.

**Implementation checklist:**
- [ ] `tests/browser/rsvp-flow.spec.ts`: invite entry → login → RSVP form → submit → reload → verify state
- [ ] Test data: seed one guest with a valid invite code for testing
- [ ] Steps: fill invite input, submit, wait for redirect to `/rsvp`, fill form (select meal, type dietary notes), submit, confirm success message, reload, verify form pre-filled
- [ ] Error case: invalid invite code rejects, shows error
- [ ] Run: `npm run test:browser` and `LIVE_E2E=1 npm run test:browser` (live against real backend)
- [ ] Verify: test passes on desktop Chromium and Pixel 5 mobile

**Notes:**
- Coordinate with TASK-020 to ensure test guest seed is created
- Clean up test guests afterward (use email prefix `e2e-rsvp-*` for cleanup)
- This is the primary validation signal for Week 3 completeness

---

### TASK-024: Planning: Task Model + API Skeleton

**Branch:** `week3/task-024-planning-model`
**Type:** Backend (SQL + FastAPI)

**Scope:**
Start building the planning board backend. Add `tasks` table (title, status enum: not_started/in_progress/done/blocked, priority, due_date, assigned_to user_id, category). Create Task SQLAlchemy model, Pydantic schema, and skeleton CRUD routes (`GET /api/tasks`, `POST /api/tasks`, `GET /api/tasks/{task_id}`, `PATCH /api/tasks/{task_id}`). Leave implementation of drag-drop logic and filters for Week 3 completion.

**Implementation checklist:**
- [ ] Migration `006_create_tasks_table.sql`: schema with all columns + FK to users
- [ ] `Task` SQLAlchemy model
- [ ] `TaskCreate`, `TaskUpdate`, `TaskResponse` Pydantic schemas
- [ ] Routes: GET list (couple/coordinator only), POST create, GET detail, PATCH update, DELETE (optional for now)
- [ ] Auth gate: all routes require `require_coordinator()`
- [ ] Tests: CRUD operations, invalid category rejected, only coordinator can see/modify

**Notes:**
- Do NOT build the React kanban board yet (that's Week 3 polish or TASK-025+)
- This is foundation for admin dashboard; not critical path for guest RSVP
- Task creation can be manual (no drag-drop UI yet)

---

### TASK-025: Week 3 Validation Report

**Branch:** `week3/task-025-validation`
**Type:** Documentation

**Scope:**
Consolidate Week 3 work into a validation report. Run the full test suite, E2E tests, manual validation script, and record evidence. Document: what worked, what was deferred, blockers encountered, and readiness for Week 4 (admin dashboard + planning board UI).

**Implementation checklist:**
- [ ] `WEEK_3_VALIDATION_REPORT.md`: summary of all merged tasks, test results, E2E evidence
- [ ] Run backend pytest (all suites) + frontend build + Playwright E2E
- [ ] Manual verification: invite flow end-to-end (real browser)
- [ ] Checklist: auth working, RSVP persisting, couple can see task list API (even if no UI yet)
- [ ] Deferred items: admin dashboard UI, planning kanban UI, (document as Week 4 scope)
- [ ] Known issues: none critical; list any minor edge cases

**Notes:**
- Target: all tests passing, no console errors, clean git history, documentation up-to-date

---

## Shared Context & References

### Database Schema
- `guests` table: id, name, email, rsvp_status, meal_choice, dietary_notes, plus_one_name, wedding_id, created_at, updated_at
- `invites` table (new): code, wedding_id, household_name, role, redeemed_at
- `tasks` table (new): id, title, status, priority, due_date, assigned_to, category, wedding_id, created_at, updated_at
- Full schema: `production/database/schema.sql`

### Stack Reminders
- **Backend:** FastAPI, SQLAlchemy ORM, pytest, Uvicorn
- **Frontend:** React 18, TypeScript, Vite, React Router v6, Playwright for E2E
- **Deployment:** GitHub Actions CI/CD, environment config (dev/staging/prod)

### VainCraft Reuse (Deferred to Week 4)
- `AdminTasks.tsx` → planning kanban (port week 4)
- `AdminCalendarView.tsx` → event timeline (port week 4)
- `AdminDashboard.tsx` → couple stats (port week 4)
- Do NOT attempt component reuse this week; focus on guest-facing RSVP

### Validation Thresholds
- **Tests:** All tests pass; coverage >80% for new code
- **E2E:** Guest RSVP flow works end-to-end; no console errors
- **Performance:** Metrics on `/api/` endpoints < 500ms p95, < 1s p99
- **Security:** No credentials in logs, invite codes non-guessable, role checks enforced

---

## Handoff Checklist

Before starting Week 3, confirm:

- [ ] TASK-015 merged and validation report reviewed
- [ ] Codex/implementer has read this doc and WEEK_3_PLAN.md
- [ ] Local dev environment has PostgreSQL running
- [ ] `production/backend/.env` has sample invite codes (DEMO-001, DEMO-COUPLE)
- [ ] `npm install` and `pip install -r requirements.txt` both pass
- [ ] Local backend starts: `cd production/backend && python main.py`
- [ ] Local frontend starts: `cd production/frontend && npm run dev`
- [ ] Playwright tests run: `npm run test:browser` (some tests skipped until auth is ready)

---

## Questions Before Starting?

If any task scope is unclear, or if constraints have changed since this doc was written (2026-06-12), post a comment in the GitHub issue or pause the session for clarification.

Target completion: all TASK-016 through TASK-025 merged and validated by end of week (2026-06-19).
