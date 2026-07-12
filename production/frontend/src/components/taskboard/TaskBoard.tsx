import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { Search, X } from 'lucide-react'

import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { Task, TaskPriority, TaskStatus } from '@/api/tasks'
import { BOARD_COLUMNS, PRIORITY_OPTIONS } from './constants'
import { createBoardKeyboardCoordinateGetter } from './keyboardCoordinates'
import { buildColumnMap } from './reorder'
import { TaskCard } from './TaskCard'
import { TaskColumn } from './TaskColumn'

const HINT_SEEN_KEY = 'ah-taskboard-hint-seen'
const STATUSES = BOARD_COLUMNS.map((column) => column.value)

// Measure droppable rects once when a drag starts, not continuously while
// it's in flight. Without this, our own onDragOver reorder reflows the
// column layout, dnd-kit remeasures, the shifted geometry resolves to a new
// "closest" collision on its own, and a single keyboard hop can cascade into
// several — most visible on a keyboard-driven cross-column move, where
// there's no real pointer position anchoring the drag.
const MEASURING_CONFIG = {
  droppable: { strategy: MeasuringStrategy.BeforeDragging },
}

type PriorityFilter = 'all' | TaskPriority

interface TaskBoardProps {
  tasks: Task[]
  isLoading: boolean
  isError: boolean
  errorMessage?: string | null
  onCreateTask: (status: TaskStatus) => void
  onEditTask: (task: Task) => void
  onDeleteTask: (task: Task) => void
  onMove: (taskId: number, target: { status: TaskStatus; position: number }) => void
  onPriorityChange: (task: Task, priority: TaskPriority) => void
  onAssigneeChange: (task: Task, assignee: string | null) => void
  /** Hides every mutating control — the board becomes a read-only view. */
  readOnly?: boolean
}

function readHintSeen(): boolean {
  try {
    return window.localStorage.getItem(HINT_SEEN_KEY) === '1'
  } catch {
    return true
  }
}

function DragHint({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      role="note"
      aria-label="Drag and drop hint"
      className="flex items-center justify-between gap-3 rounded-lg border border-gold/60 bg-gold/10 px-3 py-2 text-sm text-plum"
    >
      <p className="m-0">Tip: drag cards between columns, or use the arrows.</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss drag and drop hint"
        className="shrink-0 rounded-full p-1 text-plum/60 transition-colors hover:bg-plum/10 hover:text-plum"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  )
}

export function TaskBoard({
  tasks,
  isLoading,
  isError,
  errorMessage,
  onCreateTask,
  onEditTask,
  onDeleteTask,
  onMove,
  onPriorityChange,
  onAssigneeChange,
  readOnly = false,
}: TaskBoardProps) {
  const [search, setSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all')
  const [hintDismissed, setHintDismissed] = useState(() => readHintSeen())
  const [activeTask, setActiveTask] = useState<Task | null>(null)

  const tasksById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks])

  const [localColumns, setLocalColumns] = useState<Record<TaskStatus, number[]>>(() =>
    buildColumnMap(tasks, STATUSES),
  )
  const isDraggingRef = useRef(false)

  // Always-current ref for the keyboard coordinateGetter (see
  // keyboardCoordinates.ts) — a keyboard drag gesture is a single sensor
  // instance spanning several keypresses, so it must read live state rather
  // than whatever `localColumns` looked like at the moment the gesture began.
  const localColumnsRef = useRef(localColumns)
  localColumnsRef.current = localColumns

  useEffect(() => {
    if (isDraggingRef.current) {
      return
    }
    setLocalColumns(buildColumnMap(tasks, STATUSES))
  }, [tasks])

  const filtersActive = search.trim() !== '' || priorityFilter !== 'all'
  const dragDisabled = readOnly || filtersActive

  const assigneeOptions = useMemo(() => {
    const names = new Set<string>()
    for (const task of tasks) {
      if (task.assigned_to) {
        names.add(task.assigned_to)
      }
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b))
  }, [tasks])

  const matchesFilters = (task: Task): boolean => {
    if (priorityFilter !== 'all' && task.priority !== priorityFilter) {
      return false
    }
    if (search.trim() === '') {
      return true
    }
    const needle = search.trim().toLowerCase()
    return (
      task.title.toLowerCase().includes(needle) ||
      (task.description ?? '').toLowerCase().includes(needle)
    )
  }

  const doneCount = tasks.filter((task) => task.status === 'done').length
  const totalCount = tasks.length
  const progressPct = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: createBoardKeyboardCoordinateGetter(STATUSES, () => localColumnsRef.current),
    }),
  )

  function findContainer(id: string | number): TaskStatus | undefined {
    if ((STATUSES as (string | number)[]).includes(id)) {
      return id as TaskStatus
    }
    return STATUSES.find((status) => localColumns[status]?.includes(Number(id)))
  }

  function handleDragStart(event: DragStartEvent) {
    if (dragDisabled) return
    isDraggingRef.current = true
    const task = tasksById.get(Number(event.active.id))
    setActiveTask(task ?? null)
  }

  function handleDragOver(event: DragOverEvent) {
    if (dragDisabled) return
    const { active, over } = event
    if (!over) return

    const activeId = Number(active.id)
    const activeContainer = findContainer(active.id)
    const overContainer = findContainer(over.id)
    if (!activeContainer || !overContainer || activeContainer === overContainer) {
      return
    }

    setLocalColumns((prev) => {
      const activeItems = prev[activeContainer]
      const overItems = prev[overContainer]
      const overIndex = overItems.indexOf(Number(over.id))
      const insertAt = overIndex >= 0 ? overIndex : overItems.length

      return {
        ...prev,
        [activeContainer]: activeItems.filter((id) => id !== activeId),
        [overContainer]: [
          ...overItems.slice(0, insertAt),
          activeId,
          ...overItems.slice(insertAt),
        ],
      }
    })
  }

  function handleDragEnd(event: DragEndEvent) {
    isDraggingRef.current = false
    setActiveTask(null)
    if (dragDisabled) return

    const { active, over } = event
    if (!over) return

    const activeId = Number(active.id)
    const activeContainer = findContainer(active.id)
    const overContainer = findContainer(over.id)
    if (!activeContainer || !overContainer) return

    let finalColumns = localColumns
    if (activeContainer === overContainer) {
      const items = localColumns[overContainer]
      const activeIndex = items.indexOf(activeId)
      const overIndex = items.indexOf(Number(over.id))
      if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
        finalColumns = {
          ...localColumns,
          [overContainer]: arrayMove(items, activeIndex, overIndex),
        }
        setLocalColumns(finalColumns)
      }
    }

    const finalIndex = finalColumns[overContainer].indexOf(activeId)
    onMove(activeId, { status: overContainer, position: finalIndex === -1 ? 0 : finalIndex })
  }

  const dismissHint = () => {
    setHintDismissed(true)
    try {
      window.localStorage.setItem(HINT_SEEN_KEY, '1')
    } catch {
      // Storage unavailable: the dismissal still applies for this visit.
    }
  }

  const moveToAdjacentColumn = (task: Task, direction: -1 | 1) => {
    const currentIndex = STATUSES.indexOf(task.status)
    const targetIndex = currentIndex + direction
    if (targetIndex < 0 || targetIndex >= STATUSES.length) return
    const targetStatus = STATUSES[targetIndex]
    const targetColumn = localColumns[targetStatus] ?? []
    onMove(task.id, { status: targetStatus, position: targetColumn.length })
  }

  if (isLoading) {
    return (
      <div role="status" className="rounded-md border border-gray-200 p-4 text-sm text-gray-600">
        Loading tasks...
      </div>
    )
  }

  if (isError) {
    return <Alert variant="destructive">{errorMessage ?? 'Failed to load tasks'}</Alert>
  }

  return (
    <div className="grid gap-4">
      <section className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-[12rem] flex-1">
            <p className="m-0 text-sm font-medium text-gray-700">
              {doneCount} of {totalCount} done
            </p>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-gold transition-all duration-300"
                style={{ width: `${progressPct}%` }}
                role="progressbar"
                aria-valuenow={progressPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Tasks completed"
              />
            </div>
          </div>
        </div>

        {!hintDismissed && !readOnly && <DragHint onDismiss={dismissHint} />}

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[14rem] flex-1">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search tasks..."
              aria-label="Search tasks"
              className="pl-8"
            />
          </div>

          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by priority">
            <button
              type="button"
              onClick={() => setPriorityFilter('all')}
              aria-pressed={priorityFilter === 'all'}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                priorityFilter === 'all'
                  ? 'border-plum bg-plum text-cream'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-plum/40',
              )}
            >
              All
            </button>
            {PRIORITY_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setPriorityFilter(option.value)}
                aria-pressed={priorityFilter === option.value}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  priorityFilter === option.value
                    ? 'border-plum bg-plum text-cream'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-plum/40',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {filtersActive && (
          <p className="m-0 text-xs text-gray-500">
            Drag is off while filtering — clear the search or priority filter to rearrange cards.
          </p>
        )}
      </section>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        measuring={MEASURING_CONFIG}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {BOARD_COLUMNS.map((column, index) => {
            const columnTasks = (localColumns[column.value] ?? [])
              .map((id) => tasksById.get(id))
              .filter((task): task is Task => Boolean(task))
              .filter(matchesFilters)
            const totalInColumn = tasks.filter((task) => task.status === column.value).length

            return (
              <TaskColumn
                key={column.value}
                column={column}
                tasks={columnTasks}
                totalCount={totalInColumn}
                isFiltered={filtersActive}
                dragDisabled={dragDisabled}
                assigneeOptions={assigneeOptions}
                onAddTask={onCreateTask}
                onEdit={onEditTask}
                onDelete={onDeleteTask}
                onPriorityChange={onPriorityChange}
                onAssigneeChange={onAssigneeChange}
                onMovePrev={(task) => moveToAdjacentColumn(task, -1)}
                onMoveNext={(task) => moveToAdjacentColumn(task, 1)}
                columnIndex={index}
                columnCount={BOARD_COLUMNS.length}
              />
            )
          })}
        </section>

        <DragOverlay>
          {activeTask && (
            <div className="scale-105 rotate-1 rounded-lg shadow-2xl">
              <TaskCard
                task={activeTask}
                dragDisabled={false}
                assigneeOptions={assigneeOptions}
                canMovePrev={false}
                canMoveNext={false}
                onEdit={() => {}}
                onDelete={() => {}}
                onPriorityChange={() => {}}
                onAssigneeChange={() => {}}
                onMovePrev={() => {}}
                onMoveNext={() => {}}
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
