# WD-003: Interactive Fixture and State Management Slice

Date: 2026-06-10  
Issue: https://github.com/VainAsher/ashley-hazel-wedding-portal/issues/3  
Branch: `feature/wd-003-interactive-fixture-slice`  
Phase: 2 (Usable Local Dashboard)  

## Goal

Make the Wedding Dashboard interactive and more usable with synthetic data. Replace hard-coded mock values with a small, well-defined synthetic data fixture. Enable browser-local state for RSVP and request flows so users can actually interact with the prototype.

## Slice Definition

### Must Do

1. **Define synthetic wedding data fixture** (`data/fixture.js` or similar)
   - Small guest list (8-12 synthetic guests)
   - Event structure (ceremony, reception, etc.)
   - Example RSVP responses, blessings, requests
   - No real names, contact details, addresses, or phone numbers
   - Document schema in `docs/SYNTHETIC_DATA_SCHEMA.md`

2. **Load and use fixture on page init**
   - Import fixture in `app.js`
   - Replace all hard-coded mock values with fixture data
   - Initialize app state from fixture on page load

3. **Make RSVP flow interactive**
   - User clicks "RSVP Yes" or "Decline" button
   - State updates in memory (browser)
   - Show confirmation message and updated guest count
   - Toggle between pending/responded states

4. **Make blessings/request flow interactive**
   - User fills text field and clicks submit
   - Add new blessing/request to the list in memory
   - Show it immediately in the UI (no page reload)
   - Clear form after submit

5. **Improve mobile layout**
   - Test on phone, tablet, desktop
   - Fix any responsive issues from WD-002
   - Ensure RSVP and blessings flows are thumb-friendly on mobile

6. **Validate and document**
   - Record browser validation on at least 2 device types
   - Update `CURRENT_STATE.md` with fixture schema reference
   - Add validation notes in `docs/validation/WD-003-validation.md`

### Must NOT Do

- Add backend services, APIs, or server calls
- Store real wedding data of any kind
- Persist data to localStorage or IndexedDB yet (keep it in-memory)
- Deploy or publish to production
- Change authentication or access model
- Run privacy review (not yet)
- Modify the visual design from WD-001/WD-002 (only improve layout)

## Technical Notes

- Keep `app.js` as the single JavaScript file (no build step needed)
- Use vanilla JavaScript (no frameworks)
- All interactive state lives in memory; reload clears it
- Fixture file should be human-readable JSON or JS object
- No external API calls; all data is local

## Validation Checklist

- [ ] Synthetic data fixture created and documented
- [ ] RSVP interaction works (click yes/decline, shows confirmation)
- [ ] Blessings/requests interaction works (submit, appears in list)
- [ ] Mobile layout tested on at least 2 devices
- [ ] No real wedding data anywhere in code or commits
- [ ] Code review approved
- [ ] Browser validation recorded

## Acceptance Criteria

1. Synthetic data fixture loads on page init
2. At least three interactive flows work (RSVP, blessings, requests)
3. Mobile layout passes visual test on phone and tablet
4. No real data in any commits
5. Code review passes
6. Browser validation documented before merge

## Next Steps After Closure

If WD-003 closes successfully:

- **WD-004 option A:** Add print/export for planning and budget views
- **WD-004 option B:** Define real data storage and access model (Phase 3 prep)
- **Security decision:** Review data boundary and invite model before real data

Do not start Phase 3 (real data) until privacy review is complete.
