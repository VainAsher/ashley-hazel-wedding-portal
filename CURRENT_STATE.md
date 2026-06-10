# Current State

Date: 2026-06-09
Status: Canonical private GitHub repo baseline

## Summary

This repo is the canonical local source for the Ashley and Hazel Wedding Portal / Wedding Dashboard work.

The current product is a static clickable prototype with four root files:

- `index.html`
- `styles.css`
- `app.js`
- `README.md`

It represents the public invite gate, guest home, RSVP flow, story/profile screens, dancefloor requests, blessings wall, private dashboard, budget tracker, planning board, and contacts screens.

## Current Boundary

This repo must use synthetic or placeholder data only until a real data-handling plan is approved.

Do not commit:

- real guest names or contact details
- RSVP submissions
- household invite lists
- dietary/accessibility notes from real people
- addresses, phone numbers, email addresses, or private notes
- budget records that should remain private

## Current Work

**WD-003 is complete and ready for code review.**

**Branch:** `feature/wd-003-interactive-fixture-slice`  
**GitHub issue:** https://github.com/VainAsher/ashley-hazel-wedding-portal/issues/3  

**What was accomplished:**
- ✅ Created `data/fixture.js` with synthetic guest, song, and blessing data
- ✅ Refactored `app.js` to load state from fixture via `createAppState()`
- ✅ Updated `index.html` to load fixture before app.js
- ✅ Documented synthetic data schema in `docs/SYNTHETIC_DATA_SCHEMA.md`
- ✅ Tested all interactive flows: RSVP, blessings, song requests
- ✅ Validated mobile responsiveness (375px width)
- ✅ Confirmed no real wedding data anywhere in code
- ✅ Recorded validation in `docs/validation/WD-003-validation.md`

**Next gate decision needed:**
- **Option A:** Merge WD-003 and create WD-004 for print/export features (Phase 2)
- **Option B:** Merge WD-003 and pause Wedding Dashboard to prioritize VainCraft rescue
- **Option C:** Add additional features to WD-003 before merging

## GitHub remote

- Repository: https://github.com/VainAsher/ashley-hazel-wedding-portal
- Visibility: private
- Default branch: main
- First issue: https://github.com/VainAsher/ashley-hazel-wedding-portal/issues/1
