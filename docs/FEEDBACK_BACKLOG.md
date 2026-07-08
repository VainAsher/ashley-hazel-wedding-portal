# Feedback & Backlog — Ashley & Hazel Wedding Portal

**The single place** to capture everything during the v1.0 real-use period
(2026-06-26 → ~2026-07-24) so it can be triaged into **v1.1**. Drop entries in
as they come up — rough is fine; we'll prioritise at the review.

- **Live:** https://ashley-and.hazel-of-halifax.com · **Released:** v1.0.0 (2026-06-26)
- **Next review:** ~2026-07-24 → cut a prioritised v1.1 scope (bugs first).

## How to log an entry
Add a row to the right table. Keep it short. Use:
- **Source:** Guest · Coordinator · Couple · IT/Admin
- **Severity (bugs):** 🔴 blocker · 🟠 major · 🟡 minor
- **Status:** new · triaged · in-progress · done · won't-do

---

## 🐞 Bugs / key fixes
| Date | Source | Area | What happens / expected | Severity | Status |
|------|--------|------|--------------------------|----------|--------|
| 2026-06-26 | Couple | Timeline (tasks) | **Editing a task doesn't save** — opening a created task and pressing Save doesn't persist the edits | 🟠 major | new |
| 2026-06-26 | Couple | Gallery / images | **Photos load very slowly** — needs lazy-loading + caching (and likely served thumbnails / responsive sizes instead of full-res for the grid). *Ratified 2026-07-08: grid fires all 86 full-res originals at once; no `loading="lazy"` in `Gallery.tsx`, no thumbnail sizes in the schema (`gallery_items` stores only `file_path`)* | 🟡 minor | triaged |
| 2026-07-08 | IT/Admin | Guest footer | **Placeholder support email** — `support@wedding.example.com` hardcoded in `GuestLayout.tsx:85`, shown on every guest page; the mailto goes nowhere | 🟡 minor | new |
| 2026-07-08 | IT/Admin | Gallery (data) | **85/86 photo titles are raw filenames** (e.g. "20260613_120148.jpg") — the bulk load set `title` = filename (verified in prod DB). Frontend fallback is "Photo {id}", so fix = null/replace the seeded titles, or friendlier frontend handling | 🟡 minor | new |
| 2026-07-08 | IT/Admin | Schedule | **Ceremony never appears on the Schedule page** — it lists only `events` rows (2 exist); the ceremony lives on `weddings.ceremony_time` so guests see rehearsal dinner + wedding breakfast but not the ceremony itself. Also data checks for the couple: Wedding Breakfast is 11:00, *before* the 12:00 ceremony; Rehearsal Dinner has no time set; guest page shows no year on dates | 🟡 minor | new |

## 💡 Ideas / feature requests
| Date | Source | Idea | Why it helps | Status |
|------|--------|------|--------------|--------|
| 2026-06-26 | Couple | Gallery: **slideshow view** of approved photos | A nicer way to view the album / show it off on the day | new |
| 2026-06-26 | Couple | Gallery: **click a photo to open it full-size in a modal/lightbox** (grid currently shows small thumbnails only) | View photos properly instead of tiny tiles; pairs with the slideshow | new |
| 2026-07-08 | Couple | Guest site: **use the couple's own photos as page backgrounds** — 5 photos supplied, now in `docs/assets/feedback/guest-site-backgrounds/`. Will need cropping/scaling per viewport, fixed in place (no scroll), with a tint/blur overlay so content stays readable | Makes the guest site feel personal instead of a plain app shell | new |
| 2026-07-08 | Couple | Landing page: **warmer, more welcoming greeting** — current "Welcome to Ashley & Hazel's wedding / 346 days to go" is functional but flat; wants it to read like a heartfelt wedding welcome | First thing guests see; should feel like an invitation, not a dashboard | new |
| 2026-07-08 | Couple | Header/brand: **replace the purple "W" avatar with a photo of the couple's cat** and change the title to **"Ashley and Hazel's Wedding Portal"** (currently generic "Wedding Portal / Guest Portal") | Personal branding across every page; ⚠️ cat photo not yet supplied — need it from the couple | new |
| 2026-07-08 | IT/Admin | **Per-route page titles** — every guest page shows "Wedding Dashboard" in the browser tab (static `<title>` in `index.html`) | Readable tabs, history, bookmarks | new |
| 2026-07-08 | IT/Admin | **Primary-button polish** — check "Save RSVP" contrast (dark text on saturated purple, likely fails WCAG) and unify the pattern (full-width Save RSVP vs small right-aligned Post blessing / Submit) | Consistency + accessibility | new |
| 2026-07-08 | IT/Admin | **Gallery a11y cleanup** — each photo caption is a heading (86 headings on one page) and alt text just repeats the title; use figure/figcaption + meaningful alt | Screen-reader navigability | new |
| 2026-07-08 | IT/Admin | **Upload form should state accepted types/size limits** (images only today; guests already tried videos) | Avoids silent failures at the point of upload | new |

## 📝 General feedback / observations
| Date | Source | Note |
|------|--------|------|
| 2026-07-08 | IT/Admin | Full guest-site UI review done (desktop, logged-in guest). Solid foundations: proper landmarks, labelled forms, good empty states, route-level code splitting, no console errors. Dashboard/RSVP/Blessings values verified against the prod DB — all render faithfully. |
| 2026-07-08 | IT/Admin | Minor: `/api/auth/me` is fetched twice per page load; dashboard shows bare "Loading wedding details..." text for ~4–6s before the hero (a skeleton would help). |
| 2026-07-08 | IT/Admin | Mobile-width pass not completed (browser window wouldn't resize during review) — do a phone check before the v1.1 cut. |

---

## Seed list — known limitations & candidate v1.1 items
(Already known as of v1.0.0 — pre-loaded so we don't forget. Add real-use findings above.)

- **Gallery is image-only.** No video support — the Roora-day `.mp4`/`.mov` files
  couldn't be uploaded. *Candidate: video support, or an "external links" section.*
- **Communications don't actually send.** `POST /…/send` marks a message "sent" but
  performs **no real dispatch** (no email/WhatsApp/SMS). *Candidate: real delivery.*
- **No bulk guest import in the UI.** The 76 guests were loaded directly into the DB.
  *Candidate: CSV import + a households/plus-one model (the "+1/guest" rows are
  currently separate records).*
- **No guest-data export/delete button.** Delete exists in the API; export doesn't.
  *Candidate: per-guest export + a one-click delete in the UI (privacy).*
- **Backups are manual.** `backup.sh` exists but isn't scheduled yet (PBS covers the
  VM). *Candidate: ship the cron/systemd timer + offsite-to-NAS once resized.*
- **Bootstrap parity.** `bootstrap_prod.py` now sets `phase=planning` + details, but
  only on a fresh image; the live wedding row was corrected manually. Low priority.
- **Minor ORM polish.** A couple of models lack `wedding` relationships (DB enforces
  correctness); index-name drift in migration 011 vs the model. Cosmetic.
