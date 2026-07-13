# Viewport-fit paged layout — Phase 1 real rollout (Wave 4 item 17)

## Decision context
Phase 0 (`docs/specs/VIEWPORT_PAGING_SPIKE.md`) shipped a throwaway `/preview`
prototype behind `RequireAdmin`, iterated through several rounds of couple
feedback (burger menu, swipe hint, desktop auto-fit-to-viewport, static
header/footer, page-name label), and was approved 2026-07-13 ("this is
perfect, please accept this"). This spec covers making that pattern real for
every guest, replacing the throwaway spike plumbing with a proper
implementation.

**Scope boundary vs item 18 (per-page composition/art direction):** the
roadmap explicitly pairs these ("do WITH 17's phase 1"), but they are
different-sized work (18 is its own M/L item — background focal points,
Pillow recropping, responsive `image-set()`). Phase 1 carries over the
spike's auto-fit-to-viewport scaling as the interim content-fit mechanism
(good enough, already proven) rather than redesigning each page's
composition. Item 18 remains separate follow-up work.

**Pages affected:** Dashboard, RSVP, Schedule, Blessings only — exactly as
scoped in the original roadmap item. Dancefloor, Gallery, Wedding Party,
Party pages, and all `/admin/*` pages are **not touched** and keep normal
scrolling, unchanged, forever (per the roadmap: "Dancefloor + Gallery keep
internal scroll for their lists").

## A real implementation is simpler than the spike, not harder
The spike duplicated each page's full `GuestLayout` (header/nav/footer) once
per mounted slide, then used `position: fixed` + `inert` tricks to make 4
identical copies read as one — a deliberate hack to keep the spike isolated
and avoid touching `GuestLayout` at all. Phase 1 has no such constraint: it
renders **one real `GuestLayout` instance** around the whole deck, so none of
that duplication, `inert`-juggling, or fixed-position offset math is needed.
This also means the mobile burger-menu hack from the spike is **not carried
over** — there's only one real nav now, so the existing wrap-to-second-row
mobile nav (unchanged) just works.

## Architecture

### 1. Extract each page's content from its `GuestLayout` wrapper
`Dashboard.tsx`, `RSVP.tsx`, `Schedule.tsx`, `Blessings.tsx` each currently
export a single component that renders `<GuestLayout>{content}</GuestLayout>`.
Split each into:
- `DashboardContent`, `RSVPContent`, `ScheduleContent`, `BlessingsContent` —
  the actual page content, no `GuestLayout` wrapper, exported for the deck to
  use.
- The existing `Dashboard`, `RSVP`, `Schedule`, `Blessings` exports become
  thin wrappers (`export function Dashboard() { return <GuestLayout><DashboardContent /></GuestLayout> }`)
  so every existing import (`App.tsx`'s routes, and anything else) keeps
  working unchanged, and `layout_mode: 'scroll'` (see below) is just "render
  these thin wrappers, exactly as today" — zero behavior change for that
  path.

### 2. `weddings.theme` JSONB gains `layout_mode: 'paged' | 'scroll'`
No migration — same JSONB-absorbs pattern as `display_font`/`type_scale`.
Add to `WeddingTheme` (`app/db/schemas.py`) with an allowlist validator
matching the existing dials' style. Default **`'paged'`** — the couple
already approved the pattern; `'scroll'` is the escape hatch, not the
default a fresh wedding starts on. Flows through the existing public
`GET /api/portal/theme` endpoint automatically (already returns the whole
`WeddingTheme`), so `usePortalTheme()` on the frontend needs no new fetch.

### 3. Admin Settings: a toggle, not a redesign
A small new card in `admin/Settings.tsx` (mirrors the existing "Party
Visibility" card's shape exactly: two-option radio-style toggle, save
feedback, error handling) — "Guest page navigation: Paged (swipe between
Dashboard/RSVP/Schedule/Blessings) vs Scroll (today's normal scrolling
pages)." This is the "route-level fallback the couple can flip back from"
the roadmap calls for — flipping it takes effect immediately for every
guest, no redeploy.

### 4. `GuestLayout` gains paged-mode awareness
`GuestLayout` already computes `pathname` via `useLocation()`. Add:
```
const PAGED_ROUTES = ['/dashboard', '/rsvp', '/schedule', '/blessings']
const isPagedRoute = PAGED_ROUTES.includes(pathname)
const { layout_mode } = usePortalTheme()
```
When `isPagedRoute && layout_mode === 'paged'`: render a `<PagedGuestDeck
initialPath={pathname} />` in place of `{children}` (GuestLayout keeps
rendering its own header/nav/footer exactly as today — completely
unchanged, since it's the SAME single instance for every page now, not a
duplicate-per-slide hack). Otherwise render `{children}` exactly as today,
completely unchanged. This means **every non-paged page's code path is
untouched** — the risk surface is isolated to the new deck component plus
this one small branch in `GuestLayout`.

### 5. `PagedGuestDeck` — adapted from the spike's `PagedDeck`/`FitToSlide`
Reuses the proven mechanics (CSS scroll-snap, native swipe, hover-reveal
arrows on desktop / permanently-visible on mobile via `max-sm:opacity-100`,
document-level keyboard `ArrowLeft`/`ArrowRight` handling that skips
editable contexts, `aria-live` page announcer, one-time animated swipe
hint, `inert` on off-screen slides, desktop-only auto-fit-to-viewport
`<main>`-scoped scaling with the `MIN_FIT_SCALE` floor and internal-scroll
fallback) but **simplified**: since there's only one real header/footer now
(owned by `GuestLayout`, outside the deck entirely), `FitToSlide` no longer
needs to pin/measure header or footer at all — it only measures each
slide's own content against the space `GuestLayout`'s `<main>` region
already provides. The dot-indicator + current-page-name display moves into
`GuestLayout`'s own header (a small addition near the existing nav, visible
only when `isPagedRoute && layout_mode === 'paged'`) instead of a
spike-style separate banner.

**Real URL sync (the one genuinely new piece, not in the spike):** swiping
or arrow-navigating calls `navigate(path, { replace: true })` so the
address bar always reflects the visible page without polluting browser
back-history with every swipe (back button should leave the paged group
entirely, not step through Dashboard→RSVP→Schedule one swipe at a time).
Landing directly on `/rsvp` (a shared link, a bookmark, a fresh load)
mounts the deck already scrolled to that index — `PagedGuestDeck` takes
`initialPath` and resolves it to a slide index on mount, no visible jump.

## Test plan
- Backend: `WeddingTheme` accepts/rejects `layout_mode` per the allowlist,
  matching the existing dial validators' test shape; public theme endpoint
  round-trips it.
- Frontend, **scroll mode** (`layout_mode: 'scroll'`, the default off-switch):
  Dashboard/RSVP/Schedule/Blessings render and behave **exactly as today** —
  reuse the existing dashboard/rsvp/schedule/blessings Playwright specs
  unmodified as the regression backstop; they must all still pass verbatim.
- Frontend, **paged mode** (the default): deep-linking directly to each of
  the 4 routes lands on the correct slide; swipe/arrow/keyboard navigation
  between all 4 (mirroring the spike's own test); URL updates via `replace`
  (no extra back-history entries per swipe); reduced-motion jumps instead of
  smooth-scrolling; the settings toggle flips a live guest session's
  behavior without requiring a reload.
- Explicitly NOT retested: Dancefloor/Gallery/WeddingParty/Party specs
  (untouched code path, existing suites are the proof).

## Out of scope
Item 18's real per-page composition/background work, any change to
Dancefloor/Gallery/Wedding Party/Party pages, any change to admin pages.
