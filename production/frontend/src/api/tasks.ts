const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export type TaskStatus = 'not_started' | 'in_progress' | 'done' | 'blocked'
export type TaskPriority = 'low' | 'medium' | 'high'

export interface Task {
  id: number
  wedding_id: number
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  due_date: string | null
  assigned_to: string | null
}

export interface TaskPayload {
  wedding_id: number
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  due_date: string | null
  assigned_to: string | null
}

export class TaskApiError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'TaskApiError'
    this.status = status
  }
}

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === 'string') {
    return payload
  }

  if (!payload || typeof payload !== 'object') {
    return fallback
  }

  const detail = 'detail' in payload ? (payload as { detail: unknown }).detail : null
  if (typeof detail === 'string') {
    return detail
  }

  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (item && typeof item === 'object' && 'msg' in item) {
          return String((item as { msg: unknown }).msg)
        }
        return String(item)
      })
      .join(', ')
  }

  return fallback
}

async function request<T>(
  path: string,
  options: RequestInit,
  fallbackError: string,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : null),
      ...options.headers,
    },
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    throw new TaskApiError(extractErrorMessage(payload, fallbackError), response.status)
  }

  return payload as T
}

export function fetchTasks(): Promise<Task[]> {
  return request<Task[]>('/api/tasks', { method: 'GET' }, 'Failed to load tasks')
}

export function createTask(payload: TaskPayload): Promise<Task> {
  return request<Task>(
    '/api/tasks',
    { method: 'POST', body: JSON.stringify(payload) },
    'Failed to add task',
  )
}

export function updateTask(id: number, payload: TaskPayload): Promise<Task> {
  return request<Task>(
    `/api/tasks/${id}`,
    { method: 'PATCH', body: JSON.stringify(payload) },
    'Failed to update task',
  )
}

export async function deleteTask(id: number): Promise<void> {
  await request<unknown>(`/api/tasks/${id}`, { method: 'DELETE' }, 'Failed to delete task')
}
