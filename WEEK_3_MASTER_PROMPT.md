# Week 3 Master Prompt — Wedding Portal Auth + RSVP

**For:** Codex or implementer continuing Week 3 work
**Context date:** 2026-06-12 (TASK-015 merged)
**Goal:** Complete guest-facing RSVP flow + auth system + planning board foundation

---

## Your Mission

You are continuing the Ashley & Hazel Wedding Portal from where Codex left off on TASK-015 (performance monitoring). The portal is a real, tested, deployable FastAPI backend + React frontend. Week 1-2 built guest CRUD and infrastructure. **Week 3 is about making it functional for actual guests to RSVP.**

The next 10 tasks (TASK-016 through TASK-025) will:
1. Add invite-code auth (session-based, not Discord)
2. Add RSVP flow (accept/decline/meal choice/dietary notes)
3. Start the planning board backend (tasks table + API)
4. End with a full validation report

This is the first week where real guests could use the system.

---

## Before You Start

### Verify Your Environment

```bash
# Backend
cd production/backend
python -m venv venv
source venv/bin/activate  # or .\venv\Scripts\activate on Windows
pip install -r requirements.txt
python main.py
# Should start on http://localhost:3001

# Frontend (new terminal)
cd production/frontend
npm install
npm run dev
# Should start on http://localhost:5173

# Verify tests run
cd production/backend
pytest tests/test_guests.py -v  # Should pass
cd ../..
npm run test:browser  # Should run (some tests will skip until auth is ready)
```

### Read These Docs (In Order)

1. **WEEK_3_PLAN.md** (in this repo) — full task breakdown with implementation prompts per task
2. **IMPLEMENTATION_LOG.md** — see Weeks 1-2 to understand the pattern
3. **production/backend/docs/ci/PERFORMANCE_MONITORING.md** — what TASK-015 added
4. **production/backend/app/main.py** — where middleware is registered
5. **production/frontend/src/App.tsx** — current routing structure

### Understand the Pattern

Every task follows this flow:
1. **Create branch** `week3/task-NNN-description`
2. **Implement** with passing tests
3. **Write PR** with summary + validation steps
4. **Merge** to main
5. **Update IMPLEMENTATION_LOG.md** with task record
6. **Move to next task**

Example branch: `git checkout -b week3/task-016-auth-invite-code`

Example test run: `pytest production/backend/tests/test_auth.py -v`

Example PR description:
```
## TASK-016: Auth: Invite-Code Session Middleware

### Summary
- Added invites table and seeded test invite codes
- Implemented POST /api/auth/login with session creation
- Implemented get_current_user() dependency for route protection
- Added comprehensive auth tests (8 passing)

### Validation
- pytest tests/test_auth.py -v -> 8 passed
- curl http://localhost:3001/api/auth/login with DEMO-001 -> returns user + session
- curl without session -> 401 Unauthorized
- git diff --check -> clean
```

---

## Your Task Queue (In Order)

### Week 3 Immediate Actions

1. **TASK-016:** Auth — invite-code session middleware (90 min)
   - PostgreSQL: add `invites` table with invite code + role
   - FastAPI: `POST /api/auth/login` + `get_current_user()` dependency
   - Tests: 8+ tests covering valid/invalid/session expiry
   - After merge: frontend can call login endpoint

2. **TASK-017:** Auth — role-based route protection (60 min)
   - FastAPI: `require_couple()`, `require_coordinator()`, `require_guest()` dependencies
   - Apply to existing routes (gating guest CRUD as coordinator-only for now)
   - Tests: permission checks, 401/403 responses
   - After merge: routes are permission-gated

3. **TASK-018:** Frontend — invite-code form (60 min)
   - React: new Invite.tsx page with code input + submit
   - POST to `/api/auth/login`, handle error + success
   - Routing: `/invite` for unauthenticated, redirect to `/rsvp` on success
   - Tests: form submission, error handling, redirect
   - After merge: guests can log in via UI

4. **TASK-019:** Schema — extend guest for RSVP fields (60 min)
   - SQL migration: add rsvp_status, meal_choice, dietary_notes, plus_one_name
   - SQLAlchemy + Pydantic: update Guest model/schemas
   - Tests: model instantiation, schema validation
   - After merge: DB schema ready for RSVP

5. **TASK-020:** API — RSVP guest update (75 min)
   - FastAPI: `PATCH /api/guests/{guest_id}` for RSVP submission
   - Validation: rsvp_status enum, meal choice validation, dietary notes limit
   - Auth: guest can only update own RSVP; coordinator can update any
   - Tests: update own, update other (as coordinator), invalid status rejected
   - After merge: backend can persist RSVP changes

6. **TASK-021:** Frontend — RSVP form (90 min)
   - React: new RSVP.tsx page with radios (Accept/Decline/Tentative), meal dropdown, textarea fields
   - Fetch current guest state on mount (pre-fill)
   - POST to `PATCH /api/guests/{guest_id}`
   - Error + success handling, disable form after submit
   - Tests: form renders, can change selections, submit sends correct data
   - After merge: guests can submit RSVP via UI

7. **TASK-022:** Routing — guest portal flow (60 min)
   - React: update App.tsx router for auth-aware routing
   - `useAuth()` hook for session/role state
   - PrivateRoute wrapper: redirect unauthenticated to `/invite`
   - Routes: `/invite`, `/rsvp`, `/` (home), `/admin` (couple only, stub)
   - Tests: unauthenticated redirects, authenticated routing works
   - After merge: full guest flow is wired (invite → login → RSVP)

8. **TASK-023:** E2E Tests — full RSVP flow (120 min)
   - Playwright: `rsvp-flow.spec.ts` covering invite entry → login → RSVP form → submit → persist → reload
   - Test data: seed one guest with valid invite
   - Run `npm run test:browser` + `LIVE_E2E=1 npm run test:browser`
   - Verify: desktop + mobile, no console errors, test guest cleaned up after
   - After merge: full guest flow validated end-to-end

9. **TASK-024:** Planning API — task model + skeleton (90 min)
   - SQL: create tasks table (title, status, priority, due_date, assigned_to, category)
   - SQLAlchemy + Pydantic: Task model + schemas
   - FastAPI: skeleton CRUD routes (couple/coordinator auth required)
   - Tests: basic CRUD, role gating
   - After merge: couple can see task list via API (no UI yet)

10. **TASK-025:** Documentation — Week 3 validation report (45 min)
    - Run full test suite: pytest backend + npm build + E2E
    - Write WEEK_3_VALIDATION_REPORT.md
    - Record evidence: test counts, E2E screenshots, any known issues
    - After merge: Week 3 is complete and documented

---

## Key Constraints & Patterns

### Auth Design

Invite codes are simple strings (non-guessable, seeded in `.env` or seed script). Session is HTTP-only cookie + `itsdangerous` signing. No JWT, no external OAuth this week.

```python
# POST /api/auth/login
request = { "invite_code": "DEMO-001" }
response = { "user": { "id": 1, "name": "Guest", "role": "guest" }, "session": "..." }
# Session cookie set automatically by FastAPI
```

### Role Hierarchy

- **couple** → can do anything (RSVP, planning, budgets, admin)
- **coordinator** → can manage planning, see all guests, not couple-only features
- **guest** → can only update own RSVP, see own household info

### RSVP State Machine

Guest starts in `pending` state. Can transition to:
- `accepted` (+ meal choice)
- `declined`
- `tentative`

No complex workflows this week (e.g., no reminder emails, no deadline blocking).

### Testing Standards

- Backend: pytest with 8+ tests per feature
- Frontend: Playwright with happy path + error case
- E2E: full guest flow in one test (no mocking backend)
- Coverage: >80% for new code

All tests pass before merge.

### Git Workflow

- Branch per task: `week3/task-016-auth-invite-code`
- Commits are small and semantic (e.g., "feat(auth): add session middleware")
- PR description includes Summary, Validation steps, and any notes
- Do NOT merge until tests pass + PR reviewed

---

## Troubleshooting Checklist

**Backend won't start?**
- Check PostgreSQL is running: `psql -U postgres -d wedding` should work
- Check `production/backend/.env` has DATABASE_URL set
- Check migrations have run: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'` should show guests, invites (after TASK-016)

**Frontend build fails?**
- Delete `node_modules` and `package-lock.json`, re-run `npm install`
- Check Node version: `node --version` (should be 18+)
- Check Vite config: `production/frontend/vite.config.ts`

**Tests timeout or hang?**
- If DB tests hang, PostgreSQL may be locked: `psql -U postgres -d wedding` and check for active connections
- If E2E hangs, kill any dangling backend processes: `pkill -f "python main.py"`

**Session cookie not persisting?**
- Confirm `Set-Cookie` header in response (check DevTools Network tab)
- Confirm cookie domain/path match (localhost should work)
- Confirm FastAPI session middleware is registered in `main.py`

**Test guest not cleaning up?**
- Add email prefix `test-*` or `e2e-*` to test guests and clean before each run
- Or: drop and recreate test database between test runs

---

## Coordination with VainCraft

**Do NOT attempt component reuse from VainCraft admin this week.** Focus on wedding-specific auth + RSVP.

VainCraft admin components (`AdminTasks.tsx`, `AdminCalendarView.tsx`, etc.) are targets for **Week 4 or later**, not Week 3. They will be easier to port once the wedding backend is stable and auth is working.

---

## Success Criteria for Week 3

By end of week (2026-06-19), all 10 tasks should be merged and passing:

- ✅ Guest can enter invite code and log in
- ✅ Guest can see RSVP form with current state pre-filled
- ✅ Guest can submit RSVP (accept/decline/meal/notes)
- ✅ RSVP state persists across page reload
- ✅ Couple can see guest list (via API; no UI yet)
- ✅ Couple can see task list skeleton (via API; no UI yet)
- ✅ All tests pass (backend pytest + frontend E2E)
- ✅ No console errors or security issues
- ✅ WEEK_3_VALIDATION_REPORT.md exists with evidence

**Not in scope this week:**
- Admin dashboard UI
- Planning kanban UI (backend only)
- Budget tracker
- Blessings wall / guestbook
- Song requests
- Couple announcements
- VainCraft component reuse

---

## Ready to Start?

1. Create a new branch: `git checkout -b week3/task-016-auth-invite-code`
2. Open `WEEK_3_PLAN.md` and read TASK-016 implementation prompt
3. Start coding
4. Run tests as you go: `pytest production/backend/tests/test_auth.py -v`
5. When done, open a PR with the summary + validation steps from the prompt
6. After review, merge to main
7. Update IMPLEMENTATION_LOG.md
8. Move to TASK-017

If anything is unclear, pause and ask. This is a new implementer's first week; better to clarify than to build wrong.

Good luck! 🚀
