# View as guest — generic preview

## Context

The admin UX redesign (v1.8.0) shipped a "View as guest" nav link and pulled it before merging: clicking it kept the couple on `/admin` instead of navigating, because `GuestLayout.tsx` deliberately restricts the `couple` role to `/party/:party` only. The original assumption was that every guest page needed a real `guest_id` for personalized data, which a couple's session doesn't have (`guest_id: null`).

Investigation (2026-07-21) found that assumption was mostly wrong:

| Page | `guest_id` dependency | Blocked by |
|---|---|---|
| Dashboard | none — wedding-wide (`GET /api/portal/wedding`, resolved from `wedding_id`) | only the `GuestLayout` redirect |
| Schedule | none — wedding-wide (`GET /api/portal/schedule`) | only the `GuestLayout` redirect |
| Celebrate (blessings/music/gallery) | none — all filtered by `wedding_id`/`invite_id` | only the `GuestLayout` redirect |
| Wedding Party directory | none — wedding-wide (`GET /api/profiles`) | only the `GuestLayout` redirect |
| Wedding Party "My Profile" editor | session-bound via `invite_id`, not `guest_id` — a couple's invite has no `party`, so it 404s and the section silently renders nothing | nothing extra; harmless empty state |
| RSVP | genuinely guest-specific (real `rsvp_status`, `meal_choice`, `dietary_notes`) | `RSVP.tsx:184`'s own `!user.guest_id` gate, in addition to the layout redirect |

The actual blocker for 4 of 5 pages is one redirect (`GuestLayout.tsx:131-133`), not an architectural `guest_id` requirement. The backend (`ensure_guest_rsvp_access`, `guests.py:58-71`) already permits a `couple` session to read/patch *any* `guest_id` — that's an unused, unenforced write surface worth being deliberate about rather than building on top of.

## Decision (2026-07-21, couple's call)

**Generic preview only** — no real guest is impersonated. Every page a couple previews shows either real wedding-wide data (identical to what any guest sees) or, for RSVP specifically, a clearly-labeled static sample state. No real guest's private RSVP/meal/dietary data is ever shown to the couple through this feature. This sidesteps the backend read/write question entirely — there's no real `guest_id` involved anywhere in the preview flow, so no backend change is needed for this scope. (Real-guest RSVP impersonation, e.g. for "why can't guest X see Y" support, was explicitly deferred — if it's wanted later, backend-side read-only enforcement should ship with it, not rely on a client-side-only disable.)

## Design

### Routes (`App.tsx`)

Five new routes under a `/preview/*` prefix, reusing the existing `PagedGuestLayoutRoute`/`GuestLayout` wrapper and `RequireGuestOrCouple` guard (already permits `couple` through — only `coordinator` is blocked):

```
/preview/dashboard      → <DashboardContent />
/preview/rsvp           → <RSVPContent previewMode />
/preview/schedule       → <ScheduleContent />
/preview/celebrate      → <CelebrateContent />
/preview/wedding-party  → <WeddingPartyContent />
```

No new guard component needed. A `coordinator` hitting any `/preview/*` URL directly is already redirected to `/admin` by `RequireGuestOrCouple`.

### `GuestLayout.tsx` changes

1. **Redirect carve-out.** Detect `const isPreview = pathname.startsWith('/preview/')`. The existing couple-redirect (line 131) only fires when `!isPreview && !pathname.startsWith('/party/')` — unchanged for every real guest route.
2. **Nav hrefs.** When `isPreview`, `navigationItems` hrefs get a `/preview` prefix (`/preview/dashboard` instead of `/dashboard`) so clicking between tabs stays inside preview mode — today's plain `NavLink to={item.href}` would otherwise drop back to the real (redirect-blocked) route on the second click. Stag Do/Hen Do nav items are excluded from the preview nav entirely — party pages are the couple's own real, already-shipped feature (`/party/:party`), not something to preview.
3. **Background resolution.** `PAGE_BACKGROUND_ROUTE_KEYS` is keyed on bare paths (`/dashboard`, `/rsvp`, …). Strip the `/preview` prefix before the lookup so a previewed page still resolves the couple's own configured background/focal point/zoom, instead of silently falling back to the `/dashboard` default for every page.
4. **Paged mode stays off.** `isPagedActive` already requires `user?.role === 'guest'`, so preview never triggers the swipeable paged deck — always plain scroll layout. Deliberate simplification, not a gap; worth a one-line comment so a future reader doesn't "fix" it.
5. **Preview banner.** A slim, persistent bar (under the header, above `<main>`) shown only when `isPreview`: *"You're previewing the guest experience — [Exit preview]"*, linking back to `/admin`. This is the "easy accessibility... back to admin" the original redesign ask called for.

### RSVP preview mode (`RSVP.tsx`)

`RSVPContent` gains an optional `previewMode?: boolean` prop (same pattern as `PartyContent`'s explicit `party` prop, rather than reading it from the URL). When `true`:
- Skip `loadRsvp`'s fetch entirely — no `guest_id`, no API call, no error state.
- Render the same `Card`/form shell for visual fidelity, but every field `disabled`, populated with placeholder copy (not fabricated "real-looking" values) — e.g. `placeholder="e.g. Attending"` rather than a filled-in fake name.
- An `Alert` at the top: *"This is what a guest sees on their RSVP page — their real status appears here once they've logged in and responded."*
- No enabled Save button.

### Entry point (`AdminLayout.tsx`)

A "Preview guest view" link in the header, next to `NotificationsBell`, visible only when `isCouple` (the constant already exists in `AdminLayout` for the `coupleOnly` nav-item filter). Uses the `Eye` icon (confirmed present in the installed `lucide-react` version). Links to `/preview/dashboard`.

### Tests

New `tests/browser/preview-guest.spec.ts`:
- A `coordinator` navigating directly to `/preview/dashboard` is redirected to `/admin` (regression coverage for `RequireGuestOrCouple`'s existing behavior, now exercised via the new route).
- A `couple` user sees "Preview guest view" in `AdminLayout`'s header; clicking it lands on `/preview/dashboard` with Dashboard content visible.
- The preview banner is visible with an "Exit preview" link back to `/admin`.
- Clicking through preview nav tabs (Dashboard → RSVP → Schedule → Celebrate → Wedding Party) keeps every URL under `/preview/*` — no drop back to the blocked real routes.
- `/preview/rsvp` renders the disabled sample state (no fetch to `/api/guests/*`, no real form data).
- Regression: a real `guest` session navigating to `/dashboard` (no `/preview` prefix) is completely unaffected.

## Explicitly out of scope

- Real-guest RSVP impersonation (view a specific guest's actual RSVP/meal/dietary data) — deferred; needs its own backend read-only enforcement, not just a client-side disable, per the couple's Q2 answer.
- Coordinator access to any preview — the couple confirmed "couple only" earlier in this same redesign pass; unchanged here.
- Any change to `/party/:party`'s existing couple access — untouched.

## Sequencing

Single PR — no migration, no backend change, isolated to frontend routing/component/nav changes. Sized M (not XL), doesn't need the fleet/worktree-swarm treatment.
