const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export interface WeddingEvent {
  id: number
  wedding_id: number
  event_name: string
  event_date: string | null
  event_time: string | null
  location: string | null
  description: string | null
  created_at: string | null
}

export interface WeddingEventPayload {
  wedding_id: number
  event_name: string
  event_date: string | null
  event_time: string | null
  location: string | null
  description: string | null
}

export class EventsApiError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'EventsApiError'
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
    throw new EventsApiError(extractErrorMessage(payload, fallbackError), response.status)
  }

  return payload as T
}

export function fetchEvents(): Promise<WeddingEvent[]> {
  return request<WeddingEvent[]>('/api/events', { method: 'GET' }, 'Failed to load events')
}

export function createEvent(payload: WeddingEventPayload): Promise<WeddingEvent> {
  return request<WeddingEvent>(
    '/api/events',
    { method: 'POST', body: JSON.stringify(payload) },
    'Failed to add event',
  )
}

export function updateEvent(id: number, payload: WeddingEventPayload): Promise<WeddingEvent> {
  return request<WeddingEvent>(
    `/api/events/${id}`,
    { method: 'PUT', body: JSON.stringify(payload) },
    'Failed to update event',
  )
}

export async function deleteEvent(id: number): Promise<void> {
  await request<unknown>(`/api/events/${id}`, { method: 'DELETE' }, 'Failed to delete event')
}
