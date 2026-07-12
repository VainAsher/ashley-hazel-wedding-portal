import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  createTask,
  deleteTask,
  fetchTasks,
  moveTask,
  updateTask,
  type Task,
  type TaskContext,
  type TaskMovePayload,
  type TaskPayload,
} from '@/api/tasks'
import { applyMove } from '@/components/taskboard/reorder'

export type { Task, TaskPayload, TaskContext, TaskMovePayload, TaskPriority, TaskStatus } from '@/api/tasks'
export { TaskApiError } from '@/api/tasks'

export const TASKS_QUERY_KEY = ['tasks'] as const

function queryKeyFor(context: TaskContext) {
  return [...TASKS_QUERY_KEY, context] as const
}

export function useTasks(context: TaskContext = 'wedding') {
  return useQuery<Task[]>({
    queryKey: queryKeyFor(context),
    queryFn: () => fetchTasks(context),
  })
}

export function useCreateTask(context: TaskContext = 'wedding') {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: TaskPayload) => createTask(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeyFor(context) })
    },
  })
}

export function useUpdateTask(context: TaskContext = 'wedding') {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: TaskPayload }) =>
      updateTask(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeyFor(context) })
    },
  })
}

export function useDeleteTask(context: TaskContext = 'wedding') {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => deleteTask(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeyFor(context) })
    },
  })
}

/**
 * Drag a card to a column slot (or step it via the ← → buttons). Optimistic:
 * the board reorders instantly using the same resequence logic the server
 * applies (see reorder.ts), then reconciles with the server on settle so a
 * failed PATCH snaps back rather than leaving the board out of sync.
 */
export function useMoveTask(context: TaskContext = 'wedding') {
  const queryClient = useQueryClient()
  const queryKey = queryKeyFor(context)

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: TaskMovePayload }) =>
      moveTask(id, payload),
    onMutate: async ({ id, payload }) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<Task[]>(queryKey)
      if (previous) {
        queryClient.setQueryData<Task[]>(queryKey, applyMove(previous, id, payload))
      }
      return { previous }
    },
    onError: (_err, _vars, mutationContext) => {
      if (mutationContext?.previous) {
        queryClient.setQueryData(queryKey, mutationContext.previous)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey })
    },
  })
}
