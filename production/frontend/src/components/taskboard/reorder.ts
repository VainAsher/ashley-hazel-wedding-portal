import type { Task, TaskStatus } from '@/api/tasks'

/**
 * Pure re-implementation of the server's move/resequence semantics
 * (app/api/tasks.py::move_task), used to optimistically update the React
 * Query cache the instant a drag (or arrow-button move) completes, before
 * the PATCH round-trip resolves. Keeping this in one place means the
 * optimistic client order and the server's persisted order agree.
 */
export function applyMove(
  tasks: Task[],
  taskId: number,
  target: { status: TaskStatus; position: number },
): Task[] {
  const moving = tasks.find((task) => task.id === taskId)
  if (!moving) {
    return tasks
  }

  const destinationColumn = tasks
    .filter((task) => task.status === target.status && task.id !== taskId)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))

  const clampedIndex = Math.min(Math.max(target.position, 0), destinationColumn.length)
  destinationColumn.splice(clampedIndex, 0, moving)

  const nextBysId = new Map<number, { status: TaskStatus; position: number }>()
  destinationColumn.forEach((task, index) => {
    nextBysId.set(task.id, { status: target.status, position: index })
  })

  if (target.status !== moving.status) {
    const sourceColumn = tasks
      .filter((task) => task.status === moving.status && task.id !== taskId)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    sourceColumn.forEach((task, index) => {
      nextBysId.set(task.id, { status: moving.status, position: index })
    })
  }

  return tasks.map((task) => {
    const update = nextBysId.get(task.id)
    return update ? { ...task, status: update.status, position: update.position } : task
  })
}

/** Group task ids by column, in position order, for dnd-kit's local state. */
export function buildColumnMap(
  tasks: Task[],
  statuses: readonly TaskStatus[],
): Record<TaskStatus, number[]> {
  const map = Object.fromEntries(statuses.map((status) => [status, [] as number[]])) as Record<
    TaskStatus,
    number[]
  >
  const sorted = [...tasks].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
  for (const task of sorted) {
    if (map[task.status]) {
      map[task.status].push(task.id)
    }
  }
  return map
}
