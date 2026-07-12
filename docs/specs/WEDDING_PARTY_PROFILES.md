# Wedding-party mini profiles (ROADMAP Wave 3 item 15)

Agreed 2026-07-12. Flagged Stag/Hen members get a small customisable profile;
per the couple's confirmed decision, profiles are **guest-visible**, not
party-only — a public "Meet the wedding party" page open to every logged-in
guest. The prototype's Profiles screen (repo-root `index.html`) is the visual
reference: avatar/role/known-for cards in the plum/gold theme.

## Data model — migration 022_member_profiles.sql

- `member_profiles`: `invite_id` (unique FK → `invites.id`, CASCADE),
  `display_name VARCHAR(100)`, `role_title VARCHAR(100)` (free text — "Best
  Man", "Bridesmaid", whatever they want, independent of `invites.party_title`),
  `about TEXT`, `best_known_for VARCHAR(200)`, `favourite_song VARCHAR(200)`,
  `photo_path VARCHAR(500)`, `updated_at`.
- Eligibility: any invite with `party IS NOT NULL` (a flagged Stag or Hen
  member) may have a profile. A profile row is created lazily on first save
  (no row = "hasn't filled theirs in yet").

## API

- `GET /api/profiles/me` (require_guest) — the caller's own profile, or 404
  if they have no `party` flag (not eligible) — distinguish this from "200
  with empty fields" (eligible, just not filled in yet) so the frontend can
  show the right empty state.
- `PUT /api/profiles/me` (require_guest, 403 if `invite.party is None`) —
  upsert display_name/role_title/about/best_known_for/favourite_song. Field
  length caps matching the columns; `about` reasonably bounded (~1000 chars)
  server-side even though the column is TEXT.
- `POST /api/profiles/me/photo` (require_guest, same 403) — multipart upload,
  reuses `save_upload`'s validation (image/* only) but stores under its own
  `<wedding_id>/profiles/` subfolder — do not reuse `gallery_items`, this is
  a distinct upload with a distinct lifecycle (no moderation queue; you own
  your own photo).
- `GET /api/profiles` (require_guest) — every flagged member's profile,
  wedding-scoped, ordered by party then display_name, **including members
  who haven't filled theirs in yet** (fall back to their guest name + party
  title so the page isn't full of gaps). This is the guest-visible directory
  — no party-based filtering, per the confirmed decision.

## Frontend

- **"My profile" editor**: reachable from the guest's own Stag/Hen party page
  (a "My profile" button/section) when they're eligible — avatar upload,
  display name, role title, about, best-known-for, favourite song, Save.
  Warm empty state before their first save.
- **"Meet the wedding party" page** (new guest route, e.g. `/wedding-party`,
  nav entry visible to all guests): a grid of cards (prototype-referenced
  design) — photo/fallback avatar, display name, role title, best-known-for,
  grouped by party (Stag / Hen) with a friendly heading each. Read-only here;
  editing only happens on your own party page.
- Guest nav gains **"Wedding Party"** (always visible — this page has no
  gating, unlike Stag Do/Hen Do).

## Tests

Backend: eligibility gate (party members only), upsert semantics (create vs
update), directory includes unfilled profiles with sensible fallbacks,
photo upload validation (rejects non-images), wedding scoping, cross-wedding
404. Playwright: editor save round-trip, photo upload + preview, the public
directory renders all party members grouped correctly, nav entry always
visible regardless of the viewer's own party status.

## Explicitly out of scope here

Mounting profile cards *inside* the Stag/Hen party pages themselves (that's
item 14 D3, a small follow-up once this lands — it just renders a filtered
slice of `GET /api/profiles` by party). @mentions (item 16) — separate item,
consumes this directory once it exists.
