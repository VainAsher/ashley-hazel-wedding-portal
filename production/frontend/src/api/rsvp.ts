const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export type RsvpStatus = 'pending' | 'accepted' | 'declined' | 'tentative'

export interface GuestRsvp {
  id: number
  wedding_id: number
  name: string
  email: string | null
  phone: string | null
  address: string | null
  relationship: string | null
  rsvp_status: RsvpStatus
  // Stores the chosen menu option's name (legacy rows may hold old
  // fixed values like 'chicken').
  meal_choice: string | null
  dietary_notes: string | null
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

export interface GuestRsvpUpdate {
  rsvp_status: RsvpStatus
  // Omitted while menu selection is closed — the backend PATCH uses
  // exclude_unset, so leaving it out preserves any stored choice (and the
  // backend rejects meal fields outright while selection is closed).
  meal_choice?: string | null
  plus_one_meal_choice?: string | null
  dietary_notes: string | null
  plus_one_name: string | null
}

// Guest self-service contact update -- accepted by the same PATCH endpoint
// regardless of wedding phase (see production/backend/app/api/guests.py),
// unlike the RSVP-status/meal/dietary fields above.
export interface GuestContactUpdate {
  email?: string | null
  phone?: string | null
  address?: string | null
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
  payload: GuestRsvpUpdate | GuestContactUpdate,
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
