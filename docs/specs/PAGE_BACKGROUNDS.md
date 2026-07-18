# Per-page background configuration (ROADMAP item 18)

Agreed 2026-07-18. Guest page backgrounds are currently hardcoded in
`GuestLayout.tsx`'s `ROUTE_BACKGROUNDS` map (one fixed stock photo per route,
always centered) and in `AuthLayout.tsx` (a single hardcoded file for the
pre-login invite page). Rather than hand-tuning crops per photo, the couple
gets direct control: upload or pick a photo per page, then set its focal
point and zoom themselves — the same self-serve dial pattern already
established for colors/fonts/layout mode in Admin Settings.

**Scope for v1**: Dashboard, RSVP, Schedule, Celebrate, Wedding Party (the 5
paged-deck slides) and the pre-login Invite/landing page. Stag/Hen party
pages keep their current fixed backgrounds — out of scope for this pass.

**Image source**: an upload, one of the couple's own approved Gallery
photos, or one of the 6 existing stock backgrounds. **Position control**: a
drag-to-reposition focal-point crosshair on a live preview (not sliders),
plus a separate zoom slider.

## Data shape

Nested inside the existing `theme` JSONB column (`weddings.theme`) — no
migration, same precedent as `layout_mode` (already nested in `theme` rather
than its own column so it flows through the existing PUT/GET with zero new
plumbing). A page key's *absence* from `page_backgrounds` means "not
customized" — this is what keeps every existing wedding (`theme: null`, or a
theme predating this feature) visually unchanged until the couple actively
touches a page.

```json
"page_backgrounds": {
  "dashboard": { "source": "stock", "url": "/backgrounds/bg-02-registry-office.jpg", "focal_x": 50.0, "focal_y": 50.0, "zoom": 1.0 },
  "rsvp": { "source": "gallery", "url": "/uploads/3/gallery/ab12....jpg", "focal_x": 32.4, "focal_y": 68.1, "zoom": 1.6 }
}
```

Page keys (allowlisted both sides): `dashboard`, `rsvp`, `schedule`,
`celebrate`, `wedding_party`, `invite`. `source` is one of `stock` / `gallery`
/ `upload`; `focal_x`/`focal_y` are 0–100 (percent); `zoom` is 1.0–2.5. A
`stock` source's `url` must be one of the 6 shipped files; `gallery`/`upload`
must point under `/uploads/`.

## Backend

- `PageBackground` Pydantic model + `page_backgrounds: dict[str, PageBackground]`
  on `WeddingTheme` (`app/db/schemas.py`), with an allowlist validator for
  unknown page keys, plus `PageBackground`'s own source/url-shape validators.
  No migration — `theme` is already `Mapped[dict | None]` JSONB with no
  DB-level shape.
- No changes needed to `GET/PUT /api/settings/wedding` or `GET
  /api/portal/theme` — both already do generic `model_dump`/`model_validate`
  over the whole theme object, so the new nested field rides along for free.
  `/api/portal/theme` is deliberately unauthenticated (guest site needs
  colors pre-login) — this is the same mechanism that makes the `invite`
  page's background work pre-login, no new auth-bypass needed.
- New `POST /api/settings/backgrounds/upload` (coordinator-only, in
  `app/api/settings.py`). Modeled on `profiles.py`'s
  `upload_my_profile_photo` — no moderation, no thumbnail, no DB row at all.
  It only drops the file (`<wedding_id>/backgrounds/<uuid><ext>` under the
  uploads volume) and returns the URL; persistence happens via the couple's
  subsequent Settings PUT embedding that URL into `page_backgrounds`. Cap at
  15MB (gallery's 150MB video allowance is the wrong precedent for a single
  photo). No nginx change needed — `/api/` already has a 25MB
  `client_max_body_size` ceiling.

## Frontend consumption (`GuestLayout.tsx` / `AuthLayout.tsx`)

**The zoom/focal-point mechanism**: split today's single combined div
(photo+tint painted via one CSS multi-background value) into an
`overflow-hidden` clip wrapper containing two absolutely-positioned
children — a photo layer (`background-position` for focal point,
`transform: scale()` + matching `transform-origin` for zoom) and an
unscaled tint layer sibling above it. `position: fixed` on the outer wrapper
is viewport-relative regardless of paged-deck vs scroll layout, so the split
needs no per-mode handling. Geometry guarantee: at `zoom=1`,
`background-size: cover` already covers the box edge-to-edge for any
position; scaling >1× about an interior origin point strictly grows the box
in every direction, so combined with the wrapper's clip there is never a
visible edge gap for any `focal_x/focal_y ∈ [0,100]`, `zoom ∈ [1.0, 2.5]`.

A route → page-key map resolves which pages read from the new config;
routes not in the map (Stag/Hen) keep resolving through the untouched
legacy `ROUTE_BACKGROUNDS`. The existing decorative sunflower/lavender frame
overlay div (a sibling added directly after the backdrop block) is
unaffected by this split — it was never nested inside the old combined div.

`AuthLayout.tsx` gets the identical two-layer treatment, sourcing the
`invite` key instead of its current hardcoded file.

`DEFAULT_PAGE_BACKGROUNDS` (in `lib/theme.ts`) reproduces today's
`ROUTE_BACKGROUNDS` values at the neutral focal point/zoom that renders
identically to plain `bg-cover`/`bg-center` — a `resolvePageBackground(key,
theme)` helper falls back to it key-by-key, independent of
`themeWithDefaults()`'s shallow merge, so an uncustomized wedding is
provably unchanged.

## Admin UI (`PageBackgroundsCard` in `Settings.tsx`)

New card, same contract as the existing Theme/Layout-mode cards (local
state seeded from `themeWithDefaults`, own Save button):

1. Page tabs (6) — same hand-rolled button-group pattern already used for
   the type-scale dial.
2. Source tabs (Gallery / Stock / Upload) for the selected page. Picking any
   image resets that page's focal point and zoom to neutral (an old focal
   point rarely fits a new photo). Upload posts to the new endpoint, no
   drag-drop dependency (plain file input, matching admin Gallery's pattern).
3. A live preview (the same two-layer photo+tint render as the real guest
   page, so it's WYSIWYG) with a draggable crosshair — plain pointer events,
   no dependency: `focal_x/y = clamp(0, 100, (pointer - box.left/top) /
   box.width/height * 100)`, applied on pointer-down (so a plain click also
   repositions) and pointer-move while dragging.
4. A zoom slider (100–250%, mapped to `zoom = value / 100`).
5. One "Save all backgrounds" button (merges the whole 6-key map into the
   existing theme object, same pattern `LayoutModeCard` already uses) and a
   small per-page "Reset this page's photo" (scoped reset, not a whole-theme
   reset — wrong blast radius otherwise).

## Tests

Backend: PUT/GET round-trip for `page_backgrounds`; validation rejects an
unknown page key, unknown source, out-of-range `focal_x`/`focal_y`/`zoom`,
and a `stock` url not in the shipped list. Upload endpoint: 200 + correct
URL for a valid image, 400 for non-image, 413 over 15MB, 403 for a
non-coordinator, file actually lands on disk under the expected path.

Frontend: `tsc` clean. Playwright — admin sets a page's background (gallery
pick + drag focal point + zoom) and it persists across reload; a guest page
with a customized background renders the configured photo with the expected
`background-position`/`transform` inline style values (assert style values
directly, not screenshot diffing); the pre-login Invite page picks up a
configured `invite` background with no auth; regression check that an
uncustomized wedding (`theme: null`) still renders exactly today's stock
photos, unchanged.

Staging: DEMO codes, verify both paged-deck and scroll-mode render
correctly, verify upload through the real nginx ceiling, restore staging
state after.

## Sequencing

Three PRs, in order (de-risks the guest-facing rendering change before any
real customized data exists to expose bugs in it):

1. Backend + upload endpoint — ships invisibly, nothing consumes the field yet.
2. `GuestLayout`/`AuthLayout` consumption — `page_backgrounds` is still empty
   for every real wedding at this point, so this is provably a
   no-visual-change refactor before any admin UI can write real values.
3. `PageBackgroundsCard` admin UI, wired to both prior PRs.

## Explicitly out of scope

Stag/Hen party pages (keep fixed backgrounds). Per-breakpoint focal
points/zoom (desktop vs mobile) — one focal point/zoom per page for now.
Moderation of uploaded background photos — only the coordinator can set
these, so no review queue is needed (unlike guest-submitted Gallery photos).
