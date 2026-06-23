import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  createTask,
  deleteTask,
  fetchTasks,
  updateTask,
  type Task,
  type TaskPayload,
} from '@/api/tasks'

export type { Task, TaskPayload, TaskPriority, TaskStatus } from '@/api/tasks'
export { TaskApiError } from '@/api/tasks'

export const TASKS_QUERY_KEY = ['tasks'] as const

export function useTasks() {
  return useQuery<Task[]>({
    queryKey: TASKS_QUERY_KEY,
    queryFn: () => fetchTasks(),
  })
}

export function useCreateTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: TaskPayload) => createTask(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY })
    },
  })
}

export function useUpdateTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: TaskPayload }) =>
      updateTask(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY })
    },
  })
}

export function useDeleteTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => deleteTask(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY })
    },
  })
}
