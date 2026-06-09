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

## Immediate Next Slice

`docs/issues/WD-001-completion-slice.md` is the first issue-backed completion slice.

The next implementation should turn the clickable prototype into a safe, testable dashboard baseline without introducing real guest data.

## GitHub remote

- Repository: https://github.com/VainAsher/ashley-hazel-wedding-portal
- Visibility: private
- Default branch: main
- First issue: https://github.com/VainAsher/ashley-hazel-wedding-portal/issues/1


