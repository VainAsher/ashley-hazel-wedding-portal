const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export type RsvpStatus = 'pending' | 'accepted' | 'declined' | 'tentative'
export type MealChoice = 'chicken' | 'fish' | 'vegetarian'

export interface GuestRsvp {
  id: number
  wedding_id: number
  name: string
  email: string | null
  phone: string | null
  relationship: string | null
  rsvp_status: RsvpStatus
  meal_choice: MealChoice | null
  dietary_notes: string | null
  dietary_restrictions: string | null
  plus_one_name: string | null
  plus_one_rsvp: RsvpStatus | null
  plus_one_dietary: string | null
  table_number: number | null
  seat_number: number | null
  notes: string | null
  created_at: string | null
  updated_at: string | null
}

export interface GuestRsvpUpdate {
  rsvp_status: RsvpStatus
  meal_choice: MealChoice | null
  dietary_notes: string | null
  plus_one_name: string | null
}

export class RsvpApiError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'RsvpApiError'
    this.status = status
  }
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  const payload = await response.json().catch(() => null)
  if (payload && typeof payload === 'object' && 'detail' in payload) {
    const detail = payload.detail
    if (typeof detail === 'string') {
      return detail
    }
  }

  return fallback
}

async function requestJson<T>(
  path: string,
  options: RequestInit = {},
  fallbackError: string,
  apiBaseUrl = API_BASE_URL,
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    credentials: 'include',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : null),
      ...options.headers,
    },
  })

  if (!response.ok) {
    throw new RsvpApiError(await readErrorMessage(response, fallbackError), response.status)
  }

  return response.json() as Promise<T>
}

export async function fetchGuestRsvp(
  guestId: number,
  apiBaseUrl = API_BASE_URL,
): Promise<GuestRsvp> {
  return requestJson<GuestRsvp>(
    `/api/guests/${guestId}`,
    {},
    'Unable to load RSVP.',
    apiBaseUrl,
  )
}

export async function saveGuestRsvp(
  guestId: number,
  payload: GuestRsvpUpdate,
  apiBaseUrl = API_BASE_URL,
): Promise<GuestRsvp> {
  return requestJson<GuestRsvp>(
    `/api/guests/${guestId}`,
    {
      body: JSON.stringify(payload),
      method: 'PATCH',
    },
    'Unable to save RSVP.',
    apiBaseUrl,
  )
}
