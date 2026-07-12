export type DueDateTone = 'overdue' | 'due-soon' | 'neutral'

const DUE_SOON_WINDOW_DAYS = 7
const MS_PER_DAY = 86_400_000

/** Parse a 'YYYY-MM-DD' string as a local calendar date (not UTC), so the
 * "today" comparison lines up with the viewer's own clock. */
function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, (month || 1) - 1, day || 1)
}

/** null when there's no due date (the chip is hidden entirely). */
export function dueDateTone(dueDate: string | null): DueDateTone | null {
  if (!dueDate) {
    return null
  }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = parseLocalDate(dueDate)
  due.setHours(0, 0, 0, 0)

  const diffDays = Math.round((due.getTime() - today.getTime()) / MS_PER_DAY)
  if (diffDays < 0) {
    return 'overdue'
  }
  if (diffDays <= DUE_SOON_WINDOW_DAYS) {
    return 'due-soon'
  }
  return 'neutral'
}

export function formatDueDate(dueDate: string): string {
  const due = parseLocalDate(dueDate)
  // Pinned to 'en-US' (not the viewer's locale): a consistent "Jul 15" reads
  // clearly for this couple's guest list either way, and it keeps the chip
  // deterministic instead of silently reordering to "15 Jul" for some
  // visitors (also avoids a real Node-vs-Chromium locale mismatch we hit in
  // Playwright, where `undefined` resolved to different default locales).
  return due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
