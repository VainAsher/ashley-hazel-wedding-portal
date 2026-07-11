# Roadmap — Bounded Plans & Assessments for Every Outstanding Backlog Item

> Living document, agreed 2026-07-10. Companion to `FEEDBACK_BACKLOG.md` (the intake
> list): every outstanding backlog item gets its bounded plan, size, dependencies, and
> open decisions here. Update both when items ship.

## Context

All couple-requested v1.0 feedback except gallery thumbnails is now live; the backlog
(as of v1.1.0-rc1, review date ~2026-07-24) holds ~20 outstanding items ranging from
one-hour chores to multi-fleet features. This document gives each one a bounded plan:
scope, concrete touchpoints, size, dependencies, and the decisions only the couple can
make — plus a recommended build order. Sizes: **S** <½ session · **M** ~1 session ·
**L** 1–2 sessions (fleet-able) · **XL** multi-stage programme.

House process for every item: test-led (red→green), migration additions go in BOTH
CI lists in `.github/workflows/test.yml`, verify on staging (DEMO-* codes, restore
phase/data after), gated prod deploy, flip the backlog row to done.

**Backlog hygiene first (part of Wave 1):** the Timeline task-edit bug row still says
"fix pending deploy" — it shipped & was verified live 2026-07-09 → flip to done. The
Save-The-Date note (observations table, with typos) should move to the Ideas table.

---

## Wave 1 — v1.1 close-out (cheap, real value, before the ~24 Jul review)

> **Status 2026-07-11: SHIPPED to production** (built by a 5-agent swarm in one
> day). Items 1–6 fully live: backups cron + restore drill passed, exports,
> thumbnails (85/85 backfilled in prod, grid 254MB→5MB), chores, envelope
> (revised twice on couple feedback), feedback tool. Only item 7's **mobile
> pass** remains.

### 1. Backups scheduling (seed list) — **S** · ops only, no code
Nightly `backup.sh` via cron for `deploy@192.168.0.32` (command already documented in
`docs/guides/IT_ADMIN_GUIDE.md`), run one `restore.sh` drill to prove dumps restore,
tick the DATA_BOUNDARY checklist line. NAS offsite deferred until the NAS is resized.
**Risk of NOT doing it:** currently only PBS VM snapshots protect real guest data.

### 2. Guest export / delete buttons (seed list) — **S/M**
Admin Guests rows get **Export** (client-side JSON/CSV of the row — data's already in
the table query) and **Delete** wired to the existing `DELETE /api/guests/{id}` with
the house confirm-dialog pattern (`pages/Guests.tsx` already has one for delete? verify
— if present this is S). Add a whole-list "Export all guests (CSV)" button (client-side
from the loaded list; no backend). Tests: guests spec additions.

### 3. Gallery thumbnails (bug row, in-progress) — **M** · backend
The one remaining perf item. Plan: add **Pillow** to backend requirements (first new
pip dep — justified); migration 015 `gallery_items.thumb_path VARCHAR(500)`;
`save_upload()` in `app/api/gallery.py` writes a ~480px JPEG derivative alongside the
original (`1/thumbs/<name>.jpg`), non-JPEG/PNG inputs skip gracefully (original used);
coordinator endpoint `POST /api/gallery/thumbnails/backfill` for the 86 existing
photos; response schema += `thumb_url`; grid `<img>` uses thumb, lightbox keeps
original. Tests mirror the upload tests with a tiny generated image.
**Risk:** exotic phone formats (HEIC) — explicitly out; originals still display.

### 4. Chore batch: auth/me dedupe, dashboard skeleton, bootstrap parity, ORM polish — **M** (one session, four small wins)
- Route `fetchCurrentUser()` callers (`RSVP.tsx`, `Music.tsx`) through a shared React
  Query (`useAuth` already holds the user — expose `wedding_phase` there) → kills the
  double `/api/auth/me`.
- Replace "Loading wedding details..." with a small skeleton shimmer (theme-tinted).
- `bootstrap_prod.py` parity + the missing `wedding` ORM relationships + migration-011
  index-name drift (cosmetic, from the seed list).

### 5. Save-The-Date envelope animation + confetti (couple, 2026-07-09) — **M**
Interpretation to confirm at build time: the invite/landing page IS the save-the-date.
Plan: on first load the invitation card renders as a **closed envelope** (CSS 3D flap,
the cat seal as the wax seal 🐱) that opens after a beat or on tap, revealing the
existing hero card, with a one-shot confetti burst (tiny inline canvas, no dependency,
plum/gold/cream particles). `prefers-reduced-motion` skips straight to the open state;
session-storage so it plays once per visit, replay button for the fun of it.
Playwright: reduced-motion path + open-state assertions.

### 6. In-site feedback tool (couple) — **M/L**
Floating "🖊 Feedback" button in both layouts → dialog: type (Bug/Idea), message,
auto-captured context (page, role, viewport — no PII beyond the session name). Backend:
migration `feedback` table (wedding-scoped, status new/triaged/done, gallery-pattern),
`POST /api/feedback` (require_guest), admin list/status endpoints; **admin Feedback
page** = a triage queue clone of the music/gallery moderation UI. This becomes the
self-serve front door to this very backlog. Tests both sides.

### 7. Mobile pass (observation) — **S/M** · audit, then fixes
Playwright already runs a mobile project, but do a human-shaped pass: emulated 390px
run through every guest page + admin on the deployed staging (Chrome device toolbar
via CDP metrics override, or the user's actual phone on the LAN), log findings to the
backlog, fix the small ones in-session. Known suspects: admin tables, jukebox row wrap
(fixed), hero type scale.

---

## Wave 2 — engagement layer (make the portal talk back)

> **Status 2026-07-12: SHIPPED to production as v1.1.0** (bundled with the
> Wave 1 mobile pass). All five items built by a second 5-agent swarm
> (migrations 017–019); comms "Send" now delivers in-app for real. Rollback
> ready: pre-release dump `wedding_prod-20260711-230948.sql.gz` + rollback.sh
> re-ups image `104c5c8` (migrations are additive, old image runs cleanly).
> Spotify sync + external channels remain behind their decision gates.

### 8. Member dashboard as comms + notifications surface (couple) — **L** · foundation piece
The keystone for mentions, party comms, and honest "send". Plan:
- Migration: `notifications` (id, wedding_id, recipient_invite_id, kind
  ('communication'|'mention'|'system'), title, body, link_path, created_at, read_at)
  + index (recipient, read_at).
- Communications: extend audience targeting with flags (all / guests / coordinators /
  wedding-party / stags / hens — the party flags land with item 12 but the enum can
  ship first); `POST /send` now **fans out notifications** to matching invites (real
  in-app delivery — the "doesn't actually send" caveat becomes "delivers in-app;
  email/SMS still external"), keeping the existing status flow.
- API: `GET /api/notifications` (mine, unread count), `POST /{id}/read`, `POST
  /read-all` (require_guest).
- Frontend: bell + unread badge in `GuestLayout`/`AdminLayout`; dashboard "Messages"
  card listing recent notifications; mark-read on view.
- Update the comms admin UI copy so "Send" says what it does per channel.
**Decision (couple):** are email/WhatsApp/SMS still wanted at all, or is in-app +
their normal group chats enough? (Recommend: in-app only; revisit email via SMTP if
RSVP chasing needs it — that would be a separate M item.)

### 9. Dancefloor v2: ♥ reactions + "currently playing" (backlog row) — **M**
- Reactions: migration `song_reactions` (song_request_id, invite_id, unique pair);
  `POST/DELETE /api/music/requests/{id}/react`; wall response gains `reaction_count` +
  `reacted_by_me`; heart button on song-wall cards (and jukebox card); admin sees
  counts (useful curation signal). Prototype parity ("guests can react").
- Currently-playing: `weddings.now_playing_song_id` (nullable FK, migration shared
  with reactions); admin Music gets a "Set as now playing" action; guest Dashboard +
  Dancefloor show a live "Currently playing — selected by Ashley & Hazel" card when
  set (poll via the existing wall query). Day-of tool for the `event` phase.
- **Spotify playlist sync stays deferred** (own decision gate): OAuth app + redirect +
  token care for a wedding-sized playlist the DJ pack already covers. Only build if
  the couple still wants it after using the DJ pack. (L if ever.)

### 10. Progressive onboarding + in-site guide (couple) — **M/L**
- Backend: `GET /api/portal/me/progress` — one cheap endpoint returning booleans:
  rsvp_submitted (guest row status != pending), song_requested, photo_submitted,
  blessing_posted (existence queries by invite/guest identity).
- Guest Dashboard: a warm checklist card ("3 of 4 done — you haven't requested a song
  yet 🎵") with CTAs to each page; dismissable per item; hides when complete.
- First-visit coach marks: lightweight custom tooltips (no dependency) pointing at the
  nav on first login (localStorage flag), + a "How this works" help dialog reachable
  from the footer, content sourced from `docs/guides/GUEST_GUIDE.md`.

### 11. Typography theme dials (couple) — **M**
Extend `WeddingTheme` (backend schema + `weddings.theme` JSONB — no migration needed,
JSONB absorbs it) with `display_font`, `body_font` from a **curated allowlist** (~8
display / 5 body Google Fonts pairings that suit the brand, incl. current
Georgia/Inter as defaults) + optional `type_scale` (0.9/1.0/1.1). `lib/theme.ts`
injects the fonts stylesheet link + sets `--font-display`/`--font-sans` (tailwind
config reads the vars — mirrors the colour-dial pattern exactly, incl. the public
theme endpoint so the invite page matches). Admin Settings: two font pickers with
live-preview text + the existing Save/Reset. Playwright: dial → PATCH payload,
preview updates.

### 12. Menu builder + deferred meal selection (couple, needed ~12wk out ≈ Mar 2027) — **L**
- Migrations: `menu_options` (wedding_id, name, description, course
  ('starter'|'main'|'dessert'|NULL), is_vegetarian/vegan/gf flags, active bool) and
  `weddings.meal_selection_open BOOLEAN DEFAULT FALSE`; `guests.plus_one_meal_choice`
  (plus-ones currently have no meal column).
- API: menu CRUD (require_coordinator), open/close toggle via settings; guest RSVP
  PATCH accepts meal choices only while open (mirror phase-gate pattern); portal
  endpoint serving active options to guests.
- Admin: "Menu" card in Settings (or small admin page): option CRUD + the open
  switch; RSVP overview meal breakdown becomes dynamic per option.
- Guest RSVP: when open, meal selectors (self + plus-one) appear with the dietary
  field retained; the existing "menu opens nearer the day" copy swaps automatically.
**Decision (couple):** flat option list vs per-course menus (recommend flat v1 —
matches the caterer conversation, courses can come later).

---

## Wave 3 — the parties (biggest programme; order matters)

### 13. Kanban v2 (couple) — **L** · prerequisite for the party portals
- **Generalise**: extract the Timeline board into a reusable `TaskBoard` component;
  migration: `tasks.context VARCHAR(20) DEFAULT 'wedding'` + `tasks.position INT`
  (order within column) — the same board then powers wedding + stag + hen.
- **Drag & drop**: adopt `@dnd-kit/core` (small, maintained, a11y-friendly — the
  project's first UI dependency, justified vs hand-rolled HTML5 DnD's mobile jank);
  drag between status columns (PATCH status) and within (PATCH positions); keyboard
  DnD + the existing buttons stay as fallback.
- Card polish: priority/assignee dropdowns on-card (existing Select), due-date
  chips, validated dialog (exists), column WIP counts.
- Tests: dnd-kit interactions in Playwright via keyboard DnD (reliable headless).

### 14. Stag & Hen party portals (couple) — **XL**, phased
**D1 — membership + shell + message board (L):**
- Migration: `invites.party VARCHAR(10)` ('stag'|'hen'|NULL) + `invites.party_admin
  BOOLEAN` (best man / maid of honour run their party); expose both via auth/me.
- Access rule (confirm with couple): party content visible ONLY to that party's
  members — **the couple is deliberately excluded** ("without leaking plans"), except
  memberships themselves which the couple manages in Invitations (assign Stag/Hen +
  party-admin toggles there).
- Guest nav gains "Stag Do" / "Hen Do" for flagged members → `/party` (single route,
  party resolved server-side). v1 content: members list (profiles from item 15),
  **party message board** (new `party_messages` table, blessings-pattern, scoped by
  party, party-admin can pin/hide), and a party details card (date/venue free-text,
  party-admin editable).
- Backend guard: `require_party_member` dependency (invite.party match); every
  endpoint wedding- AND party-scoped. Explicit tests that couple/coordinator/other
  party get 403/404.
**D2 — party planning board (M, after 13):** mount `TaskBoard` with
`context='stag'|'hen'`, party-admin manages, members view/complete.
**D3 — profiles on the party pages (S, after 15).**
**Risks:** the couple-exclusion rule inverts the app's "couple sees everything"
assumption — needs its own test class; and party members are guests with the same
codes, so no auth changes beyond the flag.

### 15. Wedding-party mini profiles (couple) — **M/L**
Migration: `member_profiles` (invite_id unique FK, display_name, role_title, about,
best_known_for, favourite_song, photo_path). Photo upload reuses the gallery
`save_upload` pattern (own subfolder, same 25MB nginx budget). API: `GET/PUT
/api/profiles/me` (any flagged member), `GET /api/profiles` (party/guest visibility
per decision). Frontend: "My profile" editor (prototype Profiles screen is the design
reference — avatar/role/known-for cards in the plum/gold theme); cards render in the
party area.
**Decision (couple):** party-only, or also a public "Meet the wedding party" page for
all guests (prototype had it public; recommend public page with party-approved
profiles only).

### 16. @mentions (couple) — **M**, after 8 (notifications) + 15 (directory)
Parse `@Display Name` in blessings, song dedications, and party messages at render;
autocomplete in composers fed by a scoped directory (party members in party areas;
wedding-party + couple elsewhere — do NOT expose the full guest list to guests).
On create, backend extracts mentions → notification rows (item 8's table) → bell.
Store nothing new beyond notifications; mentions are derived at save time.

---

## Wave 4 — the big design programme + long tail

### 17. Viewport-fit paged layout (couple) — **XL** · spike before committing
The riskiest item: "fills a viewport, no scrolling" collides with long content
(86-photo gallery, growing song wall) and mobile keyboards. Plan:
- **Phase 0 spike (M):** build ONE paged prototype on staging behind `/preview` —
  GuestLayout renders routes as a horizontal deck (CSS scroll-snap `x mandatory`,
  swipe native, hover arrow buttons for desktop, URL still routes for deep links);
  page chrome fixed; each page's content region gets an internal scroll *only if its
  content exceeds the viewport* (lists) while forms/hero pages are composed to fit.
  Couple reviews on their phones → go/no-go + rules.
- **Phase 1 (L):** apply the chosen pattern to Dashboard/RSVP/Schedule/Blessings;
  Dancefloor + Gallery keep internal scroll for their lists. Reduced-motion +
  keyboard (arrow keys) + a11y (`aria-live` page announcements).
- Ship behind the phase where the couple can flip back (route-level fallback).
**Sized honestly:** this reshapes every guest spec; budget a fleet.

### 18. Per-page composition pass (couple) — **M/L**, do WITH 17's phase 1
Art direction per background: define focal-point data per image (a small map in
`GuestLayout`: `object-position` / `background-position` per breakpoint), recrop the
worst offenders in Pillow (assets step), then place content cards over quiet regions
per page. Also a good moment to switch backgrounds to responsive `image-set()` sizes
(pairs with item 3's thumbnail tooling). Requires eyes-on-staging iteration with
screenshots — design work, not plumbing.

### 19. Video support (seed list) — **M or L, decision first**
**Option A (recommended, M):** gallery items accept a **YouTube/streamable link** as
an alternative to a file — reuses `music_metadata`-style oEmbed for title/thumb, plays
embedded in the lightbox. Zero storage/transcoding risk, covers the Roora `.mp4`s once
uploaded anywhere. **Option B (L):** direct `.mp4` upload (size cap ~100–200MB, nginx
budget bump, `<video>` in lightbox, no transcoding — desktop-uploaded H.264 only,
storage watch on the uploads volume). **Decision (couple):** A vs B vs both.

### 20. CSV guest import + households (seed list) — **M + L, split**
Import (M): admin Guests "Import CSV" — client parses + previews, posts rows through
the existing create API with per-row validation results. Low urgency (76 guests
already in). Households (L): real remodel — `households` table, `guests.household_id`,
invite-per-household linking, RSVP UX per household — only worth it if the couple
wants household-grouped invites/seating; **park until asked**.

### 21. Comms external channels (seed list) — **decision gate**
After item 8 ships in-app delivery: email via SMTP would be M (couple's SMTP creds in
env, per-audience fan-out, unsubscribe not needed at this scale); WhatsApp/SMS are
paid-provider territory — **recommend won't-do**. Ask the couple once item 8 is live.

---

## Recommended sequencing (one line)
**W1:** hygiene → backups cron → export/delete → thumbnails → chores → envelope 🎉 →
feedback tool → mobile pass · **W2:** notifications surface → Dancefloor v2 →
onboarding → typography dials → menu builder · **W3:** Kanban v2 → party portals
D1→D2→D3 → profiles → mentions · **W4:** paging spike → composition pass (+ video /
import / channels per decisions).

## Open decisions for the couple (non-blocking, listed per item above)
1. Comms: in-app only, or also email? (WhatsApp/SMS recommended won't-do)
2. Menu: flat list vs courses (recommend flat)
3. Party portals: confirm couple-excluded privacy + who gets party-admin
4. Profiles: party-only vs public "Meet the wedding party" (recommend public)
5. Video: external links vs direct upload (recommend links)
6. Households remodel: wanted at all?
7. Spotify sync: revisit only after DJ-pack use

## Verification (applies to every executed item)
Backend: red-first pytest against `wedding_test_agent` (apply new migrations over SSH,
foreground PowerShell). Frontend: `tsc`, targeted Playwright both projects, full suite
serial (isolate known local flake; CI is the arbiter). Ship: push → CI green → staging
auto-deploy → live walkthrough with DEMO codes (restore staging state) → gated prod
deploy → flip backlog row → update memory. Fleet-able items (L/XL) get a written
contract in `docs/specs/` first, MUSIC_FEATURE.md-style.
