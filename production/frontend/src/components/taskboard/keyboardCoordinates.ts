import type { KeyboardCoordinateGetter } from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'

import type { TaskStatus } from '@/api/tasks'

/**
 * dnd-kit's built-in sortableKeyboardCoordinates picks the "closest" droppable
 * by raw rect distance, which works well for a single vertical list but is
 * unreliable across a *grid* of columns: sub-pixel rect rounding on a
 * fractional-width grid can make the card directly above/below in the SAME
 * column register as "closer" than anything in the next column, so
 * ArrowRight can silently no-op into a same-column reorder instead of
 * hopping columns (this is exactly the multi-container case dnd-kit's own
 * docs call out as needing a custom coordinateGetter).
 *
 * This wraps the default getter for ArrowUp/ArrowDown (same-column reorder,
 * where it works fine) and replaces ArrowLeft/ArrowRight with an explicit,
 * geometry-independent column hop: move to the adjacent column, landing on
 * whichever card occupies the same row (clamped), or the column itself when
 * empty.
 */
export function createBoardKeyboardCoordinateGetter(
  statuses: readonly TaskStatus[],
  getColumns: () => Record<TaskStatus, number[]>,
): KeyboardCoordinateGetter {
  return (event, args) => {
    if (event.code !== 'ArrowLeft' && event.code !== 'ArrowRight') {
      return sortableKeyboardCoordinates(event, args)
    }

    const columns = getColumns()
    const activeId = Number(args.active)
    const activeStatus = statuses.find((status) => columns[status]?.includes(activeId))
    if (!activeStatus) {
      return undefined
    }

    event.preventDefault()

    const currentIndex = statuses.indexOf(activeStatus)
    const targetIndex = currentIndex + (event.code === 'ArrowRight' ? 1 : -1)
    if (targetIndex < 0 || targetIndex >= statuses.length) {
      return undefined
    }
    const targetStatus = statuses[targetIndex]

    const rowIndex = columns[activeStatus].indexOf(activeId)
    const targetItems = columns[targetStatus] ?? []
    const targetId =
      targetItems.length > 0 ? targetItems[Math.min(rowIndex, targetItems.length - 1)] : undefined

    const { droppableRects } = args.context
    const rect =
      (targetId !== undefined ? droppableRects.get(targetId) : undefined) ??
      droppableRects.get(targetStatus)
    if (!rect) {
      return undefined
    }

    return { x: rect.left, y: rect.top }
  }
}
