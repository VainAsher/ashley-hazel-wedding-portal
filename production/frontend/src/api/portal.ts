const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export interface PortalWedding {
  couple_names: string
  wedding_date: string
  ceremony_time: string | null
  ceremony_location: string | null
  reception_location: string | null
  phase: string
}

export interface PortalScheduleEvent {
  id: number
  event_name: string
  event_date: string
  event_time: string | null
  location: string | null
  description: string | null
}

export class PortalApiError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'PortalApiError'
    this.status = status
  }
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  const payload = await response.json().catch(() => null)
  if (payload && typeof payload === 'object' && 'detail' in payload) {
    const detail = (payload as { detail: unknown }).detail
    if (typeof detail === 'string') {
      return detail
    }
  }

  return fallback
}

async function requestJson<T>(
  path: string,
  fallbackError: string,
  apiBaseUrl = API_BASE_URL,
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    credentials: 'include',
  })

  if (!response.ok) {
    throw new PortalApiError(await readErrorMessage(response, fallbackError), response.status)
  }

  return response.json() as Promise<T>
}

export function fetchPortalWedding(apiBaseUrl = API_BASE_URL): Promise<PortalWedding> {
  return requestJson<PortalWedding>(
    '/api/portal/wedding',
    'Unable to load wedding details.',
    apiBaseUrl,
  )
}

export function fetchPortalSchedule(apiBaseUrl = API_BASE_URL): Promise<PortalScheduleEvent[]> {
  return requestJson<PortalScheduleEvent[]>(
    '/api/portal/schedule',
    'Unable to load the schedule.',
    apiBaseUrl,
  )
}

export interface PortalProgress {
  rsvp_submitted: boolean
  song_requested: boolean
  photo_submitted: boolean
  blessing_posted: boolean
}

// What the current member has and hasn't done yet (onboarding checklist).
export function fetchPortalProgress(apiBaseUrl = API_BASE_URL): Promise<PortalProgress> {
  return requestJson<PortalProgress>(
    '/api/portal/me/progress',
    'Unable to load your checklist.',
    apiBaseUrl,
  )
}

export interface PortalThemeResponse {
  theme: {
    primary: string
    secondary: string
    tint_opacity: number
    display_font: string
    body_font: string
    type_scale: number
  } | null
}

// Public (pre-login) — the invite page needs the couple's colours too.
export function fetchPortalTheme(apiBaseUrl = API_BASE_URL): Promise<PortalThemeResponse> {
  return requestJson<PortalThemeResponse>(
    '/api/portal/theme',
    'Unable to load the theme.',
    apiBaseUrl,
  )
}

export interface PortalMenuOption {
  id: number
  name: string
  description: string | null
  course: string | null
  is_vegetarian: boolean
  is_vegan: boolean
  is_gluten_free: boolean
}

export interface PortalMenuResponse {
  meal_selection_open: boolean
  options: PortalMenuOption[]
}

// Authenticated guests only: active options plus the couple's
// meal_selection_open switch, so the RSVP page knows whether to show
// meal selects.
export function fetchPortalMenu(apiBaseUrl = API_BASE_URL): Promise<PortalMenuResponse> {
  return requestJson<PortalMenuResponse>(
    '/api/portal/menu',
    'Unable to load the menu.',
    apiBaseUrl,
  )
}
