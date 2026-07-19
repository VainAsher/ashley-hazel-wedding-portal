# Feedback & Backlog — Ashley & Hazel Wedding Portal

**The single place** to capture everything during the v1.0 real-use period
(2026-06-26 → ~2026-07-24) so it can be triaged into **v1.1**. Drop entries in
as they come up — rough is fine; we'll prioritise at the review.

- **Live:** https://ashley-and.hazel-of-halifax.com · **Released:** v1.0.0 (2026-06-26) · **Current:** v1.1.0-rc1 (2026-07-10)
- **Next review:** ~2026-07-24 → cut a prioritised v1.1 scope (bugs first).
- **Plans:** every outstanding item has a bounded plan + size in **[`ROADMAP.md`](ROADMAP.md)**.

## How to log an entry
Add a row to the right table. Keep it short. Use:
- **Source:** Guest · Coordinator · Couple · IT/Admin
- **Severity (bugs):** 🔴 blocker · 🟠 major · 🟡 minor
- **Status:** new · triaged · in-progress · done · won't-do

---

## 🐞 Bugs / key fixes
| Date | Source | Area | What happens / expected | Severity | Status |
|------|--------|------|--------------------------|----------|--------|
| 2026-06-26 | Couple | Timeline (tasks) | **Editing a task doesn't save** — opening a created task and pressing Save doesn't persist the edits. *2026-07-09: root cause found — the update schema typed `due_date` as datetime while the form sends a plain date, so editing any task that has a due date was rejected (422). One-line backend fix + regression test. *2026-07-09: fixed, live in prod — verified by editing a task with a due date on the live admin* | 🟠 major | done |
| 2026-06-26 | Couple | Gallery / images | **Photos load very slowly** — needs lazy-loading + caching (and likely served thumbnails / responsive sizes instead of full-res for the grid). *Ratified 2026-07-08: grid fires all 86 full-res originals at once; no `loading="lazy"` in `Gallery.tsx`, no thumbnail sizes in the schema (`gallery_items` stores only `file_path`)*. *2026-07-09: fixed, live in prod: lazy-loading + decoding=async + 24-per-page "Show more"; also fixed nav doing a full page reload on every click (raw `<a>` → SPA links). True thumbnails still need backend work* *2026-07-11: done, live in prod — migration 015 + Pillow ~480px JPEG derivatives on upload, backfill endpoint, grid serves thumbs (lightbox keeps originals)* | 🟡 minor | done |
| 2026-07-08 | IT/Admin | Guest footer | **Placeholder support email** — `support@wedding.example.com` hardcoded in `GuestLayout.tsx:85`, shown on every guest page; the mailto goes nowhere. *2026-07-09: fixed, live in prod: now Ajandrews210888@aol.com* | 🟡 minor | done |
| 2026-07-08 | IT/Admin | Gallery (data) | **85/86 photo titles are raw filenames** (e.g. "20260613_120148.jpg") — the bulk load set `title` = filename (verified in prod DB). Frontend fallback is "Photo {id}", so fix = null/replace the seeded titles, or friendlier frontend handling. *2026-07-09: fixed, live in prod: frontend now shows a friendly date for timestamp filenames and hides camera-style names; DB cleanup optional* | 🟡 minor | done |
| 2026-07-08 | IT/Admin | Schedule | **Ceremony never appears on the Schedule page** — it lists only `events` rows (2 exist); the ceremony lives on `weddings.ceremony_time` so guests see rehearsal dinner + wedding breakfast but not the ceremony itself. Also data checks for the couple: Wedding Breakfast is 11:00, *before* the 12:00 ceremony; Rehearsal Dinner has no time set; guest page shows no year on dates. *2026-07-09: fixed, live in prod: Schedule now synthesizes the ceremony from the wedding record (skipped if a ceremony event exists) and dates include the year. Couple confirmed the 11:00 breakfast / 12:00 ceremony and missing rehearsal time are intentional while plans are in flux* | 🟡 minor | done |

## 💡 Ideas / feature requests
| Date | Source | Idea | Why it helps | Status |
|------|--------|------|--------------|--------|
| 2026-06-26 | Couple | Gallery: **slideshow view** of approved photos | A nicer way to view the album / show it off on the day. *2026-07-09: fixed, live in prod: play/pause auto-advance in the lightbox* | done |
| 2026-06-26 | Couple | Gallery: **click a photo to open it full-size in a modal/lightbox** (grid currently shows small thumbnails only) | View photos properly instead of tiny tiles; pairs with the slideshow. *2026-07-09: fixed, live in prod: lightbox with prev/next, arrow keys, Escape* | done |
| 2026-07-08 | Couple | Guest site: **use the couple's own photos as page backgrounds** — 5 photos supplied, now in `docs/assets/feedback/guest-site-backgrounds/`. Will need cropping/scaling per viewport, fixed in place (no scroll), with a tint/blur overlay so content stays readable | Makes the guest site feel personal instead of a plain app shell. *2026-07-09: done, live in prod — theme ported from the original prototype (plum/gold/cream, Georgia, invitation hero); per-page photos under a plum tint* | done |
| 2026-07-08 | Couple | Landing page: **warmer, more welcoming greeting** — current "Welcome to Ashley & Hazel's wedding / 346 days to go" is functional but flat; wants it to read like a heartfelt wedding welcome | First thing guests see; should feel like an invitation, not a dashboard. *2026-07-09: done, live in prod — theme ported from the original prototype (plum/gold/cream, Georgia, invitation hero); "You are warmly invited / Welcome, {first name}" hero with the prototype's two-families line* | done |
| 2026-07-08 | Couple | Header/brand: **replace the purple "W" avatar with a photo of the couple's cat** and change the title to **"Ashley and Hazel's Wedding Portal"** (currently generic "Wedding Portal / Guest Portal") | Personal branding across every page. *2026-07-09: done, live in prod — cat seal in guest header, invite page, and admin sidebar; title "Ashley & Hazel's Wedding Portal"* | done |
| 2026-07-08 | IT/Admin | **Per-route page titles** — every guest page shows "Wedding Dashboard" in the browser tab (static `<title>` in `index.html`) | Readable tabs, history, bookmarks. *2026-07-09: fixed, live in prod* | done |
| 2026-07-08 | IT/Admin | **Primary-button polish** — check "Save RSVP" contrast (dark text on saturated purple, likely fails WCAG) and unify the pattern (full-width Save RSVP vs small right-aligned Post blessing / Submit) | Consistency + accessibility. *2026-07-09: done via the retheme — gold buttons with plum text (~9:1); inputs white on cream cards* | done |
| 2026-07-08 | IT/Admin | **Gallery a11y cleanup** — each photo caption is a heading (86 headings on one page) and alt text just repeats the title; use figure/figcaption + meaningful alt | Screen-reader navigability. *2026-07-09: fixed, live in prod: figure/figcaption, meaningful alt, no heading-spam* | done |
| 2026-07-09 | Couple | RSVP: **menu builder + deferred meal selection** — menu options won't exist until ~12 weeks before the day, so guests can't pick meals yet. Interim (shipping now): guest RSVP collects dietary requirements only; meal choice hidden, stored values preserved. v1.1 feature: couple creates menu options in admin and flips a switch to open guest meal selection (needs a menu model/API + admin UI + guest selector) *2026-07-12: done, live in prod (v1.1.0) — migration 019, Menu card in admin Settings (option CRUD with dietary chips, soft-delete, "Meal selection open" switch), guest RSVP grows meal pickers for self + plus-one when open (403-gated otherwise, options validated against the active menu)* | Collects the right data at the right time | done |
| 2026-07-09 | Couple | Admin **theme dials** — Settings gains a "Guest Site Theme" card: accent colour, deep colour (hex pickers), photo tint strength slider, live preview, reset to default. Applies live across guest site, invite page, and admin; stored per-wedding (migration 012). *2026-07-09: done, live in prod* | Couple can retune the look without a deploy | done |
| 2026-07-09 | Couple | **Dancefloor: guest song requests + playlist curation** (from the original prototype) — guests request songs with dedications; couple reviews (approve/reject/do-not-play), merges duplicates, pins/reorders, exports a DJ pack (CSV/text); pasted Spotify/YouTube links auto-resolve metadata. *2026-07-09: done, live in prod (migration 013, /api/music, guest Dancefloor page, admin Music module; 29 backend + 15 browser tests)* | The wedding soundtrack, built by the guests, curated by the couple, handed to the DJ | done |
| 2026-07-09 | IT/Admin | Dancefloor v2 ideas: ♥ reactions on the song wall, "currently playing" widget for the day, optional Spotify playlist sync (per docs/specs/MUSIC_FEATURE.md phases) *2026-07-12: reactions + currently-playing done, live in prod (v1.1.0) — migration 018, one ♥ per member per song with optimistic UI, admin "Set as now playing" + guest "Currently playing — picked by Ashley & Hazel" card. Spotify sync stays behind its decision gate* | Prototype parity + day-of delight | done |
| 2026-07-10 | Couple | **Stag & Hen party portals** — a Wedding Party flag on members (value: Stag or Hen) unlocks an additional portal area per party, for that party to coordinate, communicate, organise and project-manage their stag/hen plans. *(Groundwork already reserved in the schema: the unused `wedding_party` role enum value and placeholder `wedding_party` table — see ARCHITECTURE.md.)* | Gives the parties their own space without leaking plans to the couple/guests. *2026-07-13: done, live in prod (v1.4.0) — migration 021, individual Ashley/Hazel invite identity, each partner excluded from their own party by default with a couple-configurable reveal setting for the other partner's, Best Man/MoH single-holder party_admin, planning board + message board per party, adversarially security-tested against the full access-rule truth table on staging before shipping* | done |
| 2026-07-10 | Couple | **Wedding-party mini profiles** — flagged members get a small customisable profile: pic, name, role, about me, best known for, etc. *(The prototype's "Profiles" screen is the design reference — avatar/role/known-for cards.)* | Personality + helps parties know each other. *2026-07-13: done, live in prod (v1.4.0) — migration 022, guest-visible "Meet the wedding party" page + party-scoped profile cards, self-serve editor with photo upload* | done |
| 2026-07-10 | Couple | **@mentions** — within submissions (blessings, songs, party areas) users can @ other members | Coordination + conversation. *2026-07-13: done, live in prod (v1.4.0) — @Name autocomplete + highlighting in blessings, song dedications, and party messages; directory scoped per area (party-only in party areas, never the full guest list to guests)* | done |
| 2026-07-10 | Couple | **Member dashboard as comms + notification surface** — wedding communications can be issued to the dashboard, targeted by flags (guests / wedding party / coordinators / stags / hens); @-mention notifications also land there. *(Pairs with the seed-list "communications don't actually send" item — in-app delivery becomes the first real channel.)* *2026-07-12: done, live in prod (v1.1.0) — migration 017; Send fans out real in-app notifications by audience (incl. future party flags), bell + unread badge in both layouts, Messages card on the guest dashboard, mark-read/read-all. External channels (email/SMS) remain a decision gate* | One reliable place everyone actually sees messages | done |
| 2026-07-10 | Couple | **Viewport-fit paged layout** — restructure each page (guest portal especially) so content fills one viewport with no scrolling; swipe left/right or hover arrow buttons switch between pages | App-like, deck-of-cards feel. *2026-07-14: done, live in prod (v1.5.0) — all 7-8 guest pages swipe together in one shared deck (guest-specific: a stag/hen guest's own party page joins the set), CSS scroll-snap + hover arrows + keyboard + swipe, desktop auto-fit-to-viewport, mobile burger menu (couple-approved from the Phase 0 review) replacing the old wrapped nav row now that there are more pages. Couple-flippable back to scroll mode in Admin Settings.* | done |
| 2026-07-10 | Couple | **Per-page composition pass** — rearrange content and move/crop/resize background images so each photo's focal point stays visible and unobscured, with content overlaid on uninteresting areas | The photos become part of the design, not behind it. *2026-07-19: done, live in prod (v1.6.0) — built as a couple-facing self-serve picker rather than a one-off recrop: a new "Page Backgrounds" card in Admin Settings lets the couple choose a photo per page (their own approved gallery, the 6 stock backgrounds, or a fresh upload) and drag a focal-point crosshair + zoom slider on a live preview, any time, with no dev pass needed. Full contract: `docs/specs/PAGE_BACKGROUNDS.md`.* | done |
| 2026-07-10 | Couple | **Typography theme dials** — font/typography configurable from admin Settings, like the colour theme (display + body faces, maybe scale) *2026-07-12: done, live in prod (v1.1.0) — 8 curated heading faces + 5 body faces + Cosy/Standard/Roomy scale in the theme card, live preview, applies site-wide incl. the invite page; no font downloads while on the Georgia/Inter defaults* | Full self-service brand control | done |
| 2026-07-10 | Couple | **⚡ Real-audio looping playlist** — turn submitted/approved songs into a looping playlist with real audio on the site. Wanted *sooner rather than later*. *2026-07-10: done, live in prod — chosen solution: 30-second previews (keyless iTunes Search API, matched server-side on approval; admin Find/Clear/Match-all controls). Guest Dancefloor gains the "Now playing" jukebox: artwork, dedication, play/pause/prev/next, auto-advance, looping. Full-length audio would be the YouTube-embed path if ever wanted* | The Dancefloor becomes audible; prototype's "Currently playing" widget for real | done |
| 2026-07-10 | Couple | **Kanban / project-management expansion** — drag-and-drop cards, dropdowns, validated design; worth getting right as the same board will power stag & hen planning *2026-07-12: done, live in prod (v1.2.1) — dnd-kit drag-and-drop with full keyboard support, inline priority/assignee dropdowns, overdue/due-soon chips, search + priority filters, "N of M done" progress bar, dismissable drag hint. Board extracted as a reusable TaskBoard component (migration 020 adds tasks.context/position) ready to mount for stag/hen planning. CI caught a real keyboard-drag bug pre-release — fixed before shipping* | One good planning tool reused across couple + parties | done |
| 2026-07-10 | Couple | **In-site bug/feedback tool** — super user-friendly way for ANY user to raise a bug or idea in-site, feeding a triage queue (i.e. this backlog, but self-serve) | Feedback stops depending on people finding this file. *2026-07-11: done, live in prod — migration 016, floating Feedback pill on every page (Bug/Idea + message + auto-captured page/role/viewport), admin triage queue at /admin/feedback with New/Triaged/Done tabs* | done |
| 2026-07-09 | Couple | **Save-The-Date envelope animation** — the invite/landing page opens like an envelope (cat wax seal), with a little confetti sprinkle for the joy of it | First impression = an invitation being opened. *2026-07-11: done, live in prod — sealed plum envelope with the cat wax seal, stays closed until tapped, card grows out with a one-shot confetti burst; once per session with a replay button; reduced-motion skips to the open card. Envelope sizes itself from the measured card (always 48px larger per side) after two rounds of couple feedback on the feel* | done |
| 2026-07-10 | Couple | **Progressive onboarding + in-site user guide** — data-driven onboarding (show people what they haven't done yet: RSVP, song request, photo…) and an in-site guide *2026-07-12: done, live in prod (v1.1.0) — "N of 4 done" checklist card on the dashboard (dismissable rows, hides when complete), one first-visit coach mark, "How this works" guide dialog in the footer* | New guests learn the portal without the docs | done |
| 2026-07-08 | IT/Admin | **Upload form should state accepted types/size limits** (images only today; guests already tried videos) | Avoids silent failures at the point of upload. *2026-07-09: fixed, live in prod: "Photos only, up to 25 MB" hint under the file input* | done |

## 📝 General feedback / observations
| Date | Source | Note |
|------|--------|------|
| 2026-07-08 | IT/Admin | Full guest-site UI review done (desktop, logged-in guest). Solid foundations: proper landmarks, labelled forms, good empty states, route-level code splitting, no console errors. Dashboard/RSVP/Blessings values verified against the prod DB — all render faithfully. |
| 2026-07-08 | IT/Admin | Minor: `/api/auth/me` is fetched twice per page load; dashboard shows bare "Loading wedding details..." text for ~4–6s before the hero (a skeleton would help). *2026-07-11: both fixed, live in prod — pages read the shared auth query (page-level duplicate fetch removed) and the dashboard shows a theme-tinted skeleton.* |
| 2026-07-08 | IT/Admin | Mobile-width pass not completed (browser window wouldn't resize during review) — do a phone check before the v1.1 cut. *2026-07-12: done, live in prod (v1.1.0) — Pixel-5 audit of every page (scripts/mobile-pass.mjs, reusable); fixed: nav clipping Dancefloor+Gallery, missing Dancefloor card, oversized Feedback pill, admin grid/table clipping on 11 pages, coordinator-facing Invitations error.* |
| 2026-07-09 | Couple | Cat photo supplied (`docs/assets/feedback/cat-header.jpeg`) for the header rebrand, plus a sixth background candidate (`bg-06-registry-candid.jpeg`). |
| 2026-07-09 | IT/Admin | Admin sidebar labels are low-contrast (purple on near-black) — fold into the design-pass button/contrast work. *2026-07-09: fixed in the design pass (explicit light link text, gold hover).* |

---

## Seed list — known limitations & candidate v1.1 items
(Already known as of v1.0.0 — pre-loaded so we don't forget. Add real-use findings above.)

- ~~**Gallery is image-only.**~~ *2026-07-14: done, live in prod (v1.5.0) — direct
  `.mp4` upload, 150MB cap, guests and couple both can upload (matching existing
  gallery permissions), `<video>` playback in the lightbox, no transcoding.*
- ~~**Communications don't actually send.**~~ *2026-07-12: in-app delivery is real
  as of v1.1.0 — Send fans out notifications to matching member dashboards and
  the UI says exactly that. 2026-07-14: real email via Resend now live in prod
  (v1.5.0) on top of the in-app bell — actual sending stays inert (in-app only,
  logged skip) until the couple supplies a Resend API key as a deploy secret.
  WhatsApp/SMS remain won't-do.*
- **No bulk guest import in the UI.** The 76 guests were loaded directly into the DB.
  *Candidate: CSV import + a households/plus-one model (the "+1/guest" rows are
  currently separate records).*
- ~~**No guest-data export/delete button.**~~ *2026-07-11: done, live in prod —
  per-row Export + "Export all guests (CSV)" (RFC-4180 client-side) beside the
  existing Delete/confirm flow on admin Guests.*
- ~~**Backups are manual.**~~ *2026-07-11: done — nightly 03:00 cron installed on
  `.32` (`backup.sh` → `/home/deploy/wedding-prod-backups`, 14-day retention);
  first dump taken, and the restore drill PASSED: restored into the throwaway
  `wedding_restore_test`, row counts matched live exactly (78 guests / 85
  photos / 11 invites / 2 songs), throwaway dropped. Offsite-to-NAS still
  waits on the NAS resize.*
- ~~**Bootstrap parity.**~~ *2026-07-11: done, live in prod — `bootstrap_prod.py`
  now detects re-runs (via the invites it creates) and preserves the live
  `phase` instead of resetting it to planning.*
- ~~**Minor ORM polish.**~~ *2026-07-11: done — `GuestAudit.wedding` viewonly
  relationship added (the only one missing); the migration-011 index-name
  "drift" was already resolved in the model, stale INDEXING_STRATEGY.md note
  corrected.*
- **Task `assigned_to` is a free-text/FK mismatch.** *Found 2026-07-12 during
  the Kanban V2 staging test.* The `tasks.assigned_to` column is an int FK to
  `wedding_party.id`, but the admin Timeline UI has always collected it as a
  plain text name — so a raw non-existent id (e.g. from a script or future
  API client) causes a 500 (FK violation) instead of a clean 4xx. Low
  severity: the UI itself only ever sends values the Select derives from
  already-observed assignee strings, so it doesn't manifest in normal use.
  *Candidate: proper fix arrives naturally with the Wave 3 wedding-party
  directory (items 14/15) — resolve `assigned_to` against real party members
  then, and validate/400 on the API in the meantime.*
