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

export interface PortalThemeResponse {
  theme: {
    primary: string
    secondary: string
    tint_opacity: number
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
