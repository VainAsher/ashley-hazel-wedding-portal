# Kanban V2 — Task Board contract (ROADMAP Wave 3 item 13)

> **Status 2026-07-12: SHIPPED to production as v1.2.1.** See
> docs/FEEDBACK_BACKLOG.md and docs/ROADMAP.md for the release record.

Agreed 2026-07-12. The Timeline task board grows into a feature-rich, genuinely
intuitive kanban — and gets extracted into a reusable `TaskBoard` component,
because the same board will power the Stag & Hen planning areas (Wave 3 item
14 D2). The couple's brief: **feature-rich, user-friendly, adds to UX,
intuitive to use.**

## Non-negotiables

- The existing task CRUD, validated dialog, and status-move buttons keep
  working — buttons remain as the accessible/mobile fallback alongside drag
  and drop, not replaced by it.
- House theme: the admin's light surface with plum/gold accents; warm,
  celebratory copy (this is a wedding, not Jira).
- Everything wedding-scoped; `context` scoping ready for `stag`/`hen` boards.

## Backend

- **Migration 020_task_board_v2.sql**: `ALTER TABLE tasks ADD COLUMN IF NOT
  EXISTS context VARCHAR(20) NOT NULL DEFAULT 'wedding'` with CHECK
  `context IN ('wedding','stag','hen')`; `ADD COLUMN IF NOT EXISTS position
  INTEGER`; backfill `position` per (wedding_id, status) ordered by
  created_at; index `(wedding_id, context, status, position)`.
  Add to BOTH CI migration lists (test.yml).
- Task list endpoint: accepts optional `?context=` (default `wedding`),
  returns tasks ordered by `(status, position)`.
- **Move/reorder**: `PATCH /api/tasks/{id}/move` body
  `{status: <col>, position: <int>}` — moves a card to a column slot in one
  call, resequencing neighbours server-side (no fractional positions; simple
  integer resequence per column is fine at wedding scale). New cards append
  to the end of their column. Existing status-only PATCH keeps working.
- Task create/update schemas gain `context` (validated) but the admin
  Timeline always uses `wedding`.

## Board UX (the heart of the brief)

- **Drag & drop** via `@dnd-kit/core` + `@dnd-kit/sortable` (approved new
  dependency — a11y-first, maintained, small): drag between columns and
  reorder within a column; a lifted **drag overlay** card with slight scale +
  shadow; clear **drop indicator** (gap/highlight) where the card will land;
  column highlights while a card hovers over it; smooth drop animation.
  **Keyboard DnD** must work (dnd-kit keyboard sensor: space to lift, arrows
  to move, space to drop) and gets a Playwright test.
- **Columns**: Not started / In progress / Blocked / Done, each with a count
  badge, a subtle per-column accent (e.g. neutral / gold / red / green top
  border), a friendly empty state ("Nothing here — drag a task over or add
  one below"), and a per-column **“+ Add task”** button that opens the dialog
  pre-set to that status.
- **Cards**: title; colour-coded priority chip; due-date chip (red when
  overdue, amber within 7 days, neutral otherwise, hidden when unset);
  category chip when set; assignee line. **Inline dropdowns on the card** for
  priority and assignee (Select, no dialog round-trip). Edit + Delete stay,
  tucked behind a kebab/ghost-icon row so cards stay scannable. The existing
  move-status buttons remain (compact icon buttons: ← →).
- **Board header**: "N of M done" with a slim gold progress bar; a search
  box filtering cards by title/description as you type; priority filter
  chips (All / High / Medium / Low). Filters compose; filtered-out cards are
  hidden, counts reflect the filter, and drag is disabled while filtering
  (simpler + predictable) with a small hint saying so.
- **Mobile** (≤ sm): columns stack vertically (as today), cards full-width;
  the ← → move buttons are the primary mechanism there; touch drag may work
  via dnd-kit sensors but MUST NOT break scrolling (activation constraint:
  ~8px distance or long-press delay).
- **First-visit hint**: one small dismissable line under the header —
  "Tip: drag cards between columns, or use the arrows." (localStorage).

## Component extraction

- `src/components/taskboard/TaskBoard.tsx` (+ its column/card subcomponents)
  owns rendering + DnD, receives tasks + mutation callbacks + an optional
  `readOnly`/`context` flavouring via props. `pages/admin/Timeline.tsx`
  becomes a thin page that feeds it the wedding context. No party-portal
  work now — just make the seam real.

## Tests

- Backend: move/reorder semantics (append, mid-insert resequence, cross-
  column move, invalid column/position, cross-wedding 404, context filter +
  validation, position backfill sanity).
- Playwright: keyboard DnD moves a card between columns and persists (PATCH
  asserted); within-column reorder; inline priority change fires PATCH;
  per-column add pre-selects status; search + priority filters; overdue/due-
  soon chip rendering; mobile project — stacked columns still fully operable
  via buttons. Existing Timeline specs keep passing (update, don't delete,
  unless an assertion is genuinely obsolete).

## Out of scope (explicitly)

Swimlanes, multiple boards per context, task comments/attachments, WIP
limits, column customisation, stag/hen mounting (Wave 3 item 14 D2).
