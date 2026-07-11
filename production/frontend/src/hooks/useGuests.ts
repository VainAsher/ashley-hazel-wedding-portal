import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export type RsvpStatus = 'pending' | 'accepted' | 'declined' | 'tentative'
// Legacy fixed meal values used by the coordinator guest form; guest RSVP
// meal picks store free-form menu option names instead.
export type MealChoice = 'chicken' | 'fish' | 'vegetarian'

export interface Guest {
  id: number
  wedding_id: number
  name: string
  email: string | null
  phone: string | null
  relationship: string | null
  rsvp_status: RsvpStatus
  // Menu option name (or a legacy fixed value like 'chicken').
  meal_choice: string | null
  dietary_restrictions: string | null
  plus_one_name: string | null
  plus_one_rsvp: RsvpStatus | null
  plus_one_dietary: string | null
  plus_one_meal_choice: string | null
  table_number: number | null
  seat_number: number | null
  notes: string | null
  created_at: string | null
  updated_at: string | null
}

export interface GuestPayload {
  wedding_id: number
  name: string
  email: string | null
  phone: string | null
  relationship: string | null
  rsvp_status: RsvpStatus
  // Coordinator edits still offer the legacy fixed values, but existing rows
  // may hold menu option names picked by guests — keep the type open.
  meal_choice: string | null
  dietary_restrictions: string | null
  plus_one_name: string | null
  plus_one_rsvp: RsvpStatus | null
  plus_one_dietary: string | null
  plus_one_meal_choice?: string | null
  table_number: number | null
  seat_number: number | null
  notes: string | null
}

export class GuestApiError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'GuestApiError'
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
    throw new GuestApiError(extractErrorMessage(payload, fallbackError), response.status)
  }

  return payload as T
}

export function fetchGuests(): Promise<Guest[]> {
  return request<Guest[]>('/api/guests', { method: 'GET' }, 'Failed to load guests')
}

export function createGuest(payload: GuestPayload): Promise<Guest> {
  return request<Guest>(
    '/api/guests',
    { method: 'POST', body: JSON.stringify(payload) },
    'Failed to add guest',
  )
}

export function updateGuest(id: number, payload: GuestPayload): Promise<Guest> {
  return request<Guest>(
    `/api/guests/${id}`,
    { method: 'PUT', body: JSON.stringify(payload) },
    'Failed to update guest',
  )
}

export async function deleteGuest(id: number): Promise<void> {
  await request<unknown>(`/api/guests/${id}`, { method: 'DELETE' }, 'Failed to delete guest')
}

export const GUESTS_QUERY_KEY = ['guests'] as const

export function useGuests() {
  return useQuery<Guest[]>({
    queryKey: GUESTS_QUERY_KEY,
    queryFn: () => fetchGuests(),
  })
}

export function useCreateGuest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: GuestPayload) => createGuest(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: GUESTS_QUERY_KEY })
    },
  })
}

export function useUpdateGuest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: GuestPayload }) =>
      updateGuest(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: GUESTS_QUERY_KEY })
    },
  })
}

export function useDeleteGuest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => deleteGuest(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: GUESTS_QUERY_KEY })
    },
  })
}
