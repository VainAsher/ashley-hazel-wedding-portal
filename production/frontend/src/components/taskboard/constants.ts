import type { BadgeProps } from '@/components/ui/badge'
import type { TaskPriority, TaskStatus } from '@/api/tasks'

export interface BoardColumnDef {
  value: TaskStatus
  label: string
  /** Top-border accent class — a quiet visual cue per column. */
  accentClass: string
  emptyHint: string
}

export const BOARD_COLUMNS: BoardColumnDef[] = [
  {
    value: 'not_started',
    label: 'Not started',
    accentClass: 'border-t-gray-300',
    emptyHint: 'Nothing here — drag a task over or add one below.',
  },
  {
    value: 'in_progress',
    label: 'In progress',
    accentClass: 'border-t-gold',
    emptyHint: 'Nothing in progress yet — drag a task over or add one below.',
  },
  {
    value: 'blocked',
    label: 'Blocked',
    accentClass: 'border-t-red-400',
    emptyHint: 'Nothing blocked — drag a task over or add one below.',
  },
  {
    value: 'done',
    label: 'Done',
    accentClass: 'border-t-green-500',
    emptyHint: 'Nothing done yet — drag a task over or add one below.',
  },
]

export const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
]

export const PRIORITY_VARIANT: Record<TaskPriority, BadgeProps['variant']> = {
  low: 'neutral',
  medium: 'info',
  high: 'danger',
}

export function priorityLabel(priority: TaskPriority): string {
  return PRIORITY_OPTIONS.find((option) => option.value === priority)?.label ?? priority
}

export function columnLabel(status: TaskStatus): string {
  return BOARD_COLUMNS.find((column) => column.value === status)?.label ?? status
}
