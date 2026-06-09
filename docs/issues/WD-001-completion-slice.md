# WD-001 - Safe Static Dashboard Completion Slice

Status: Closed after WD4 browser validation and main merge
Project: Wedding Dashboard
Repo: `C:\dev\ashley-hazel-wedding-portal-prototype`
Created: 2026-06-09
GitHub Issue: https://github.com/VainAsher/ashley-hazel-wedding-portal/issues/1
Feature Branch: feature/wd-001-static-dashboard-slice
Validation Note: docs/validation/WD-001-validation-2026-06-09.md
Merged Commit: cf7eda5

## Goal

Turn the clickable static prototype into a safe, reviewable baseline for Wedding Dashboard completion without introducing real guest data.

## Scope

- Preserve the current screen set and visual direction.
- Keep the implementation static/browser-only for this slice.
- Use synthetic data only.
- Make one coherent first interaction pass across the guest-facing flow.
- Document manual validation results.

## Candidate Implementation Tasks

1. Replace inline repeated mock values with a small synthetic data fixture in `app.js`.
2. Make RSVP controls update visible page state in browser memory only.
3. Make dancefloor and blessing-wall submissions update local in-memory lists only.
4. Add basic validation and empty states for guest-facing forms.
5. Run `docs/validation/MANUAL_TEST_SCRIPT.md`.

## Out Of Scope

- real guest data
- backend service
- database
- authentication beyond prototype invite-gate behavior
- public deployment
- spreadsheet import/export
- payment or gift registry integrations

## Acceptance Criteria

- The app remains openable from `index.html` without a build step.
- All existing screens remain reachable.
- RSVP, music request, and blessing-wall flows have a visible synthetic/local interaction path.
- No real guest, contact, RSVP, invite-code, or budget data is committed.
- Manual test script results are recorded in this issue or a linked validation note.

## Privacy Gate

Before using real wedding data, create a separate data-handling issue and update `docs/privacy/DATA_BOUNDARY.md`.

