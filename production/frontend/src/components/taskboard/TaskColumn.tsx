import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Task, TaskPriority, TaskStatus } from '@/api/tasks'
import type { BoardColumnDef } from './constants'
import { TaskCard } from './TaskCard'

interface TaskColumnProps {
  column: BoardColumnDef
  tasks: Task[]
  totalCount: number
  isFiltered: boolean
  dragDisabled: boolean
  assigneeOptions: string[]
  onAddTask: (status: TaskStatus) => void
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
  onPriorityChange: (task: Task, priority: TaskPriority) => void
  onAssigneeChange: (task: Task, assignee: string | null) => void
  onMovePrev: (task: Task) => void
  onMoveNext: (task: Task) => void
  columnIndex: number
  columnCount: number
}

export function TaskColumn({
  column,
  tasks,
  totalCount,
  isFiltered,
  dragDisabled,
  assigneeOptions,
  onAddTask,
  onEdit,
  onDelete,
  onPriorityChange,
  onAssigneeChange,
  onMovePrev,
  onMoveNext,
  columnIndex,
  columnCount,
}: TaskColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.value })

  return (
    <div
      className="flex flex-col gap-3"
      aria-label={`${column.label} column`}
    >
      <div className="flex items-center justify-between">
        <h3 className="m-0 text-sm font-semibold text-gray-900">{column.label}</h3>
        <Badge variant="neutral" aria-label={`${tasks.length} tasks`}>
          {isFiltered ? `${tasks.length} of ${totalCount}` : tasks.length}
        </Badge>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          'grid min-h-[4.5rem] auto-rows-min gap-3 rounded-lg border-t-4 bg-gray-50/60 p-2 transition-colors',
          column.accentClass,
          isOver && !dragDisabled && 'bg-plum/5 ring-2 ring-plum/30',
        )}
      >
        <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
          {tasks.length === 0 ? (
            <p className="m-0 rounded-md border border-dashed border-gray-300 bg-white/60 p-3 text-sm text-gray-500">
              {isFiltered ? 'No matching tasks.' : column.emptyHint}
            </p>
          ) : (
            tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                dragDisabled={dragDisabled}
                assigneeOptions={assigneeOptions}
                canMovePrev={columnIndex > 0}
                canMoveNext={columnIndex < columnCount - 1}
                onEdit={onEdit}
                onDelete={onDelete}
                onPriorityChange={onPriorityChange}
                onAssigneeChange={onAssigneeChange}
                onMovePrev={onMovePrev}
                onMoveNext={onMoveNext}
              />
            ))
          )}
        </SortableContext>
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="justify-start gap-1.5 text-gray-600"
        onClick={() => onAddTask(column.value)}
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        Add task
      </Button>
    </div>
  )
}
