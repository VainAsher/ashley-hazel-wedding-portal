# WD-004: Print and Export Functionality Slice

Date: 2026-06-10  
Issue: https://github.com/VainAsher/ashley-hazel-wedding-portal/issues/4  
Branch: `feature/wd-004-print-export-slice`  
Phase: 2 (Usable Local Dashboard)  

## Goal

Add print and export capabilities to the Wedding Dashboard so users can generate documents for planning, budget, and guest coordination using synthetic data.

## Slice Definition

### Must Do

1. **Print stylesheets** (`styles.css` additions)
   - Add `@media print` rules for planning board view
   - Add `@media print` rules for budget view
   - Hide navigation, sidebars in print view
   - Optimize for A4 paper (8.5" × 11")
   - Test at actual print size

2. **Print button on Planning screen**
   - Add "Print Planning Board" button near header
   - Browser print preview shows clean layout
   - No sidebar, no navigation in print
   - Tasks, owners, decisions visible
   - Waiting-on items highlighted

3. **Print button on Budget screen**
   - Add "Print Budget Summary" button near header
   - Browser print preview shows clean layout
   - Budget table visible with all columns
   - Totals and variance calculations visible
   - Synthetic budget data only (no real amounts)

4. **Export Planning as text**
   - Create simple text export of tasks
   - Format: "TO DO | Task name | Owner"
   - One task per line, sections separated
   - Include counts (x in TO DO, y in DOING, etc.)
   - Save as `.txt` file

5. **Export Budget as CSV-like text**
   - Create simple text export of budget summary
   - Format: Category | Allocated | Forecast | Paid | Variance | Status
   - One line per budget item
   - Include column headers
   - Synthetic budget data only
   - Save as `.txt` file

6. **Validate and document**
   - Record print layouts on phone, tablet, desktop
   - Test exports open in text editor
   - Add export schema to docs
   - Update CURRENT_STATE.md with completion
   - Ensure no real data in any export

### Must NOT Do

- Add backend services, APIs, or server calls
- Store real wedding data of any kind (budgets, guest details)
- Implement email export
- Implement cloud storage export
- Deploy or publish
- Change authentication or access model
- Run privacy review (not needed for Phase 2)
- Modify the visual design

## Technical Notes

- Print CSS should override screen CSS, not duplicate
- Export functions use vanilla JavaScript (no libraries)
- Export files are downloaded via `<a href="data:...">` blob URLs
- No localStorage or database needed
- All exports use synthetic data from fixture

## Validation Checklist

- [ ] Print stylesheet tested on phone (375px)
- [ ] Print stylesheet tested on tablet (768px)
- [ ] Print stylesheet tested on desktop (1280px)
- [ ] Planning export button works
- [ ] Budget export button works
- [ ] Exported files have correct format
- [ ] No real data in any export
- [ ] Export schema documented
- [ ] Code review approved
- [ ] Browser validation recorded

## Acceptance Criteria

1. Print stylesheets applied and tested
2. Planning and budget screens print cleanly
3. Planning export generates downloadable text file
4. Budget export generates downloadable text file
5. No real wedding data anywhere in exports
6. Mobile and desktop print layouts acceptable
7. Code review passes
8. Validation documentation complete

## Next Steps After Closure

If WD-004 closes successfully:

- **Phase 2 will be feature-complete** — dashboard is now interactive with print/export
- **Phase 3 can begin:** Define real data storage and access model
- **Security decision:** Review data boundary and invite model before any real data
- **Privacy review:** Must happen before Phase 3 implementation

Do not start Phase 3 (real data) until privacy review is complete.

## Related Documents

- ROADMAP.md (Phase 2)
- SYNTHETIC_DATA_SCHEMA.md (fixture details)
- WD-003 validation report
