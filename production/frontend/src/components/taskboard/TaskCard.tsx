import { useEffect, useRef, useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronLeft, ChevronRight, GripVertical, MoreVertical, Pencil, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { Task, TaskPriority } from '@/api/tasks'
import { PRIORITY_OPTIONS, PRIORITY_VARIANT, priorityLabel } from './constants'
import { dueDateTone, formatDueDate } from './dueDate'

const UNASSIGNED = '__unassigned__'

interface TaskCardProps {
  task: Task
  dragDisabled: boolean
  assigneeOptions: string[]
  canMovePrev: boolean
  canMoveNext: boolean
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
  onPriorityChange: (task: Task, priority: TaskPriority) => void
  onAssigneeChange: (task: Task, assignee: string | null) => void
  onMovePrev: (task: Task) => void
  onMoveNext: (task: Task) => void
}

/** Small self-contained kebab menu (Edit/Delete) — no dropdown-menu
 * dependency exists yet in this app, and two actions don't warrant adding
 * one; a manual click-outside/Escape popover matches the pattern already
 * used by NotificationsBell. */
function CardMenu({ task, onEdit, onDelete }: Pick<TaskCardProps, 'task' | 'onEdit' | 'onDelete'>) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={`More actions for ${task.title}`}
        aria-expanded={open}
        aria-haspopup="menu"
        className="rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
      >
        <MoreVertical className="h-4 w-4" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={`Actions for ${task.title}`}
          className="absolute right-0 top-full z-20 mt-1 w-32 overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            aria-label={`Edit ${task.title}`}
            onClick={() => {
              setOpen(false)
              onEdit(task)
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            Edit
          </button>
          <button
            type="button"
            role="menuitem"
            aria-label={`Delete ${task.title}`}
            onClick={() => {
              setOpen(false)
              onDelete(task)
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            Delete
          </button>
        </div>
      )}
    </div>
  )
}

export function TaskCard({
  task,
  dragDisabled,
  assigneeOptions,
  canMovePrev,
  canMoveNext,
  onEdit,
  onDelete,
  onPriorityChange,
  onAssigneeChange,
  onMovePrev,
  onMoveNext,
}: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: dragDisabled,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const tone = dueDateTone(task.due_date)
  const dueVariant = tone === 'overdue' ? 'danger' : tone === 'due-soon' ? 'warning' : 'neutral'

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid={`task-card-${task.id}`}
      className={cn(
        'grid gap-2 rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-shadow',
        isDragging && 'opacity-40',
      )}
    >
      <div className="flex items-start gap-2">
        {!dragDisabled && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Reorder ${task.title} (space to lift, arrows to move, space to drop)`}
            className="mt-0.5 shrink-0 cursor-grab touch-none rounded p-0.5 text-gray-300 hover:bg-gray-100 hover:text-gray-500 active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4" aria-hidden="true" />
          </button>
        )}

        <p className="m-0 min-w-0 flex-1 break-words font-medium text-gray-900">{task.title}</p>

        <CardMenu task={task} onEdit={onEdit} onDelete={onDelete} />
      </div>

      <div className="flex flex-wrap items-center gap-1.5 pl-0.5">
        {task.due_date && (
          <Badge variant={dueVariant} aria-label={`Due ${formatDueDate(task.due_date)}`}>
            {tone === 'overdue' ? 'Overdue · ' : ''}
            {formatDueDate(task.due_date)}
          </Badge>
        )}
        {task.category && <Badge variant="info">{task.category}</Badge>}
      </div>

      {task.assigned_to && (
        <p className="m-0 pl-0.5 text-xs text-gray-500">Assigned to {task.assigned_to}</p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 pl-0.5 pt-1">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={task.priority}
            onValueChange={(value) => onPriorityChange(task, value as TaskPriority)}
          >
            <SelectTrigger
              aria-label={`Priority for ${task.title}`}
              className="h-7 w-auto gap-1 rounded-full border-none px-2 py-0 text-xs shadow-none"
            >
              <Badge variant={PRIORITY_VARIANT[task.priority]} className="pointer-events-none">
                <SelectValue>{priorityLabel(task.priority)}</SelectValue>
              </Badge>
            </SelectTrigger>
            <SelectContent>
              {PRIORITY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {assigneeOptions.length > 0 && (
            <Select
              value={task.assigned_to ?? UNASSIGNED}
              onValueChange={(value) =>
                onAssigneeChange(task, value === UNASSIGNED ? null : value)
              }
            >
              <SelectTrigger
                aria-label={`Assignee for ${task.title}`}
                className="h-7 w-auto gap-1 rounded-full px-2 py-0 text-xs shadow-none"
              >
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                {assigneeOptions.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            aria-label={`Move ${task.title} to previous column`}
            disabled={!canMovePrev}
            onClick={() => onMovePrev(task)}
            className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-plum disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={`Move ${task.title} to next column`}
            disabled={!canMoveNext}
            onClick={() => onMoveNext(task)}
            className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-plum disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  )
}
