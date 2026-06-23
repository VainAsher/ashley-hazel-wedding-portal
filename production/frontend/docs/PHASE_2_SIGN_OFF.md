# Phase 2 Sign-Off — Invite & RSVP Migration

**Reviewer:** Phase 2 Review Agent (independent validation)
**Date:** 2026-06-23
**Scope:** Migration of Invite and RSVP pages to TailwindCSS + Radix design.

> **RESOLUTION (2026-06-23):** The single NO-GO blocker below was fixed in commit `ca68b55`
> (`tests/browser/auth-routing.spec.ts:128` scoped to `getByRole('main')`). Full suite re-run:
> **88 passed, 0 failed, 2 skipped.** Gate flipped to **GO**. Phase 3 cleared to start.

**Commits assessed:**
- `d2e2819` feat: redesign invite page with authlayout and modern card design
- `e2f66c9` feat: redesign rsvp page with guestlayout and component-based form
- `2d8467a` test: update rsvp page selectors for guestlayout and card structure
- `f124a7f` test: fix rsvp page test selectors for header/main ambiguity

---

## 1. Build Health

| Check | Command | Result |
|-------|---------|--------|
| Typecheck | `npm run typecheck` (`tsc --noEmit`) | **PASS** — 0 errors |
| Build | `npm run build` (`vite build`) | **PASS** — built in ~1.75s, 44 modules, no errors (only deprecation warnings unrelated to Phase 2) |

---

## 2. Test Suite

`npm run test` (Playwright, projects: `chromium-desktop` + `chromium-mobile`).

**Result: 86 passed, 2 failed, 2 skipped.**

### Failing tests

Both failures are the **same root cause** (one per project):

| File:Line | Test | Assertion | Root Cause | Phase 2 Regression? |
|-----------|------|-----------|------------|---------------------|
| `tests/browser/auth-routing.spec.ts:128` | `authenticated guest root traffic lands on RSVP form` (chromium-desktop) | `await expect(page.getByText('Route Guest')).toBeVisible()` | Strict-mode violation: `getByText('Route Guest')` resolves to **2 elements**. Phase 2's `GuestLayout` now renders the user's name (`user?.name` → "Route Guest") in the header `<banner>` (`GuestLayout.tsx:41`), and `RSVP.tsx` renders `guest.name` in `<CardDescription>` inside `<main>` (`RSVP.tsx:178`). The unscoped `getByText` matches both. | **YES** |
| `tests/browser/auth-routing.spec.ts:128` | `authenticated guest root traffic lands on RSVP form` (chromium-mobile) | (same as above) | (same as above) | **YES** |

**Regression analysis:** The assertion at line 128 was added in commit `27b544d` (TASK-022, auth-aware routing) and passed before Phase 2. The pre-redesign RSVP page rendered the guest name once and there was no `GuestLayout` header echoing the name, so the selector was unambiguous. Phase 2 introduced the duplicate by (a) adding `GuestLayout` which prints `user?.name` in the header and (b) printing `guest.name` in the card description. The implementation agents recognized this exact ambiguity and fixed it in `rsvp.spec.ts:145` (scoping to `getByRole('main')` — commits `2d8467a`/`f124a7f`), but **missed the identical assertion in `auth-routing.spec.ts:128`**. This is a Phase 2 migration regression with an incomplete test-selector fix, not a pre-existing failure.

**Skipped tests (2):** Pre-existing skips (live/guest-management variants), unrelated to Phase 2. Not a concern.

---

## 3. Invite Page Review (`src/pages/Invite.tsx`) — **PASS**

- Wrapped in `AuthLayout` (title="Enter Invite Code"). ✔
- Uses `Card` / `CardHeader` / `CardTitle` / `CardContent`. ✔
- Uses Radix/ui `Input`, `Label`, `Button`, `Alert` (`variant="destructive"`). ✔
- No leftover inline styles (`style=` count: 0). ✔
- Form submission + redirect logic intact: trims code, validates non-empty, calls `loginWithInviteCode` → `fetchCurrentUser` → `navigate(role === 'guest' ? '/rsvp' : '/admin')`. Matches `src/api/auth.ts` (POST `/api/auth/login` with `{ invite_code }`, GET `/api/auth/me`). ✔
- Error handling intact: 401 → "Code not found", network error → "Unable to reach the server. Try again.", empty → "Invite code is required." All covered by passing tests in `invite.spec.ts`. ✔

> Note: The task referenced `docs/API_CONTRACT.md` for the contract — **no such file exists** in the repo. Validation was performed against the actual API client modules `src/api/auth.ts` and `src/api/rsvp.ts`, which the pages match correctly.

---

## 4. RSVP Page Review (`src/pages/RSVP.tsx`) — **PASS (page code); test selector gap noted in §2**

- Wrapped in `GuestLayout`. ✔
- Card-based structure: header card (name/title), Attendance card, Meal & Preferences card, status Alert, submit Button. ✔ (Note: this is a single-guest RSVP form, not multi-household-member; "Card per household member" does not apply to current data model — one guest per session.)
- Conditional rendering preserved: Meal & Preferences card renders **only** when `formData.rsvpStatus === 'accepted'` (`RSVP.tsx:228`). Verified by passing test `hides meal preferences when not accepting invitation`. ✔
- No leftover inline styles (`style=` count: 0). ✔
- Form state + API calls intact: `fetchCurrentUser` → guard `guest_id` → `fetchGuestRsvp` on load; `saveGuestRsvp` (PATCH `/api/guests/:id`) on submit with payload `{ rsvp_status, meal_choice|null, dietary_notes, plus_one_name }`. Disable-on-save (`formDisabled = submitting || saved`) preserved. Matches `src/api/rsvp.ts`. ✔ Verified by passing tests in `rsvp.spec.ts`.
- Accessibility/labels: radios use implicit `<label>` wrapping (Accept/Decline/Tentative); select/textarea/input use `htmlFor`/`id` pairs — all `getByLabel` selectors resolve. ✔

---

## 5. Cross-Cutting Checks

- **Duplicate-text / selector ambiguity:** **One real issue, surfaced as the 2 test failures.** `GuestLayout` header (`<banner>`) renders `user?.name` and the RSVP card renders `guest.name`; when both equal the same string the name appears twice on the page. `rsvp.spec.ts` was updated to disambiguate via `getByRole('main')`; `auth-routing.spec.ts:128` was not. Page behavior itself is correct (showing the name in both header and card is intentional/acceptable UX); the fix belongs in the test selector.
- **Console errors on load:** No unexpected console errors. The 86 passing tests include `afterEach` hooks asserting zero unexpected browser errors (only expected 401/400 network errors filtered). Pages load clean.

---

## GATE DECISION: **NO-GO**

Blocked solely by the 2 failing tests (`npm run test` is non-zero exit). Page implementations are otherwise correct and production-quality. This is a **single-line, low-risk** test-selector fix — the cleanup agent can clear the gate quickly.

---

## Fix List for Cleanup Agent

### FIX 1 — Disambiguate the duplicated guest-name selector (REQUIRED to pass gate)

- **File:** `production/frontend/tests/browser/auth-routing.spec.ts`
- **Line:** 128
- **Current:**
  ```ts
  await expect(page.getByText('Route Guest')).toBeVisible()
  ```
- **Change to:**
  ```ts
  await expect(page.getByRole('main').getByText('Route Guest')).toBeVisible()
  ```
- **Why:** Phase 2's `GuestLayout` renders the user's name in the header `<banner>` and `RSVP.tsx` renders the guest name in `<CardDescription>` inside `<main>`. The unscoped `getByText` matches both and triggers a Playwright strict-mode violation. Scoping to `getByRole('main')` mirrors the fix already applied in `rsvp.spec.ts:145` and targets the card description, not the header. This fixes both the `chromium-desktop` and `chromium-mobile` failures (same assertion, run once per project).

**No source/page code changes required.** Do not modify `RSVP.tsx`, `GuestLayout.tsx`, or `Invite.tsx` — they are correct.

### Verification after fix
1. `npm run typecheck` → expect 0 errors (no source changes, should remain green).
2. `npm run test` → expect **88 passed, 0 failed, 2 skipped**.
3. Re-flip gate to **GO** once the suite is green.
