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
| 2026-06-26 | Couple | Gallery / images | **Photos load very slowly** — needs lazy-loading + caching (and likely served thumbnails / responsive sizes instead of full-res for the grid) | 🟡 minor | new |

## 💡 Ideas / feature requests
| Date | Source | Idea | Why it helps | Status |
|------|--------|------|--------------|--------|
| 2026-06-26 | Couple | Gallery: **slideshow view** of approved photos | A nicer way to view the album / show it off on the day | new |
| 2026-06-26 | Couple | Gallery: **click a photo to open it full-size in a modal/lightbox** (grid currently shows small thumbnails only) | View photos properly instead of tiny tiles; pairs with the slideshow | new |

## 📝 General feedback / observations
| Date | Source | Note |
|------|--------|------|
| | | |

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
