# Viewport-fit paged layout — Phase 0 spike (Wave 4 item 17)

## Decision (couple, 2026-07-13)
Start the Phase 0 spike now, in parallel with video upload and email. This is
explicitly a **prototype for the couple to react to on their own phones** —
not a decided pattern yet. Nothing about the existing guest experience
changes as part of this item; it ships as a new, isolated, admin-gated route.

## Goal
Answer one question: does "each guest page fills the viewport, no page-level
scroll, swipe/arrow between pages" work for this content, or does it collide
too badly with long lists (86-photo gallery, growing song wall, blessings
wall) and mobile keyboards (RSVP form)? Build one throwaway prototype covering
a representative slice, not the whole app.

## Scope: 4 pages, prototype only
Dashboard, RSVP, Schedule, Blessings — the four the roadmap's Phase 1 would
touch first. Explicitly NOT included in the spike: Dancefloor, Gallery,
Wedding Party, Party pages, or any admin page (all of these already plan to
keep internal scroll regardless of what Phase 1 decides, per the roadmap).

## Route
New top-level route `/preview`, gated by the existing `RequireAdmin` guard
(same component `adminRoute()` in `App.tsx` already uses for `/admin/*`) —
this is a couple/coordinator-only review tool, not something a guest should
ever land on. Lazy-loaded like every other route-level page.

## Implementation
- New component `src/pages/PreviewPaged.tsx` + `src/components/PagedDeck.tsx`.
  **Does not touch `GuestLayout.tsx`** — a completely parallel layout shell so
  there is zero risk to the live guest experience regardless of spike outcome.
- `PagedDeck`: a horizontal flex container, one child per "page"
  (`scroll-snap-type: x mandatory` on the container, `scroll-snap-align:
  start` on each child, each child `width: 100vw` / `height: 100dvh`).
  Native swipe on touch devices; add simple hover-visible left/right arrow
  buttons for desktop (reuse the `ChevronLeft`/`ChevronRight` icons already
  used in the Gallery lightbox). Keyboard: `ArrowLeft`/`ArrowRight` scroll to
  the adjacent page (`element.scrollIntoView({ behavior: 'smooth' })`), and
  each page transition fires an `aria-live="polite"` announcement ("Page 2 of
  4: RSVP") for screen readers.
- Each of the 4 pages renders inside its own deck slide, wrapped so *that
  page's own content region* scrolls internally if it overflows the
  viewport (e.g., Blessings' wall) while the page chrome (nothing here, since
  there's no shared header inside `/preview` — see below) stays fixed. This
  is the core tension the spike exists to test: does "internal scroll only
  when a list is long" read as acceptable, or does it feel broken next to
  pages that truly fit?
- `prefers-reduced-motion`: skip the smooth-scroll animation, jump directly
  (`behavior: 'auto'`) — reuse `page.emulateMedia()` learnings from the
  existing test suite (the CSS media query itself works fine here; it was
  specifically Playwright's `test.use({ reducedMotion })` context option that
  doesn't reach the page in this repo's Playwright version, per the existing
  gotcha — so the *test* must use `page.emulateMedia()`, not `test.use`).
- No new backend, no new API calls, no migration — reuses the exact same
  data hooks (`useAuth`, `useApprovedGallery`... no, gallery's excluded —
  reuses whatever hooks Dashboard/RSVP/Schedule/Blessings already call) so
  the prototype shows real live data, not mocked content.
- A one-line banner at the top of `/preview` ("Prototype — internal review
  only") so it's unambiguous this isn't the live site if a screenshot gets
  shared around.

## What happens after the spike
This spec covers Phase 0 only. The couple reviews `/preview` on staging (their
own phones, real content) and makes a go/no-go call. If "go": Phase 1 (a
separate, later spec) applies the chosen pattern for real to
Dashboard/RSVP/Schedule/Blessings inside `GuestLayout`, with a route-level
fallback the couple can flip back from. If "no-go": delete `/preview`,
`PagedDeck.tsx`, `PreviewPaged.tsx` — nothing else in the app was touched, so
there's nothing to unwind.

## Tests
- Playwright: `/preview` requires admin auth (guest session gets redirected,
  same as any other `/admin/*`-guarded route today); swiping/clicking arrows
  moves between all 4 pages; keyboard arrow-key navigation works; each page
  transition updates the `aria-live` region; `page.emulateMedia({
  reducedMotion: 'reduce' })` confirms no animation class/transition applies.
- No backend tests needed — no backend changes.

## Out of scope
Everything in Phase 1 (real rollout, fallback mechanism, the other guest
pages), the per-page composition/background pass (item 18, explicitly tied to
Phase 1 not Phase 0), and any decision about whether this ships at all — that
call belongs to the couple after they've used the prototype.
