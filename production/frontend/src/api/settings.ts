const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export type WeddingPhase = 'planning' | 'live' | 'event' | 'archived'

export interface WeddingSettings {
  id: number
  couple_names: string
  wedding_date: string
  ceremony_time: string | null
  ceremony_location: string | null
  reception_location: string | null
  phase: WeddingPhase
}

export interface WeddingSettingsPayload {
  couple_names: string
  wedding_date: string
  ceremony_time: string | null
  ceremony_location: string | null
  reception_location: string | null
  phase: WeddingPhase
}

export class SettingsApiError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'SettingsApiError'
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
    throw new SettingsApiError(extractErrorMessage(payload, fallbackError), response.status)
  }

  return payload as T
}

export function fetchSettings(): Promise<WeddingSettings> {
  return request<WeddingSettings>(
    '/api/settings/wedding',
    { method: 'GET' },
    'Failed to load settings',
  )
}

export function updateSettings(payload: WeddingSettingsPayload): Promise<WeddingSettings> {
  return request<WeddingSettings>(
    '/api/settings/wedding',
    { method: 'PUT', body: JSON.stringify(payload) },
    'Failed to save settings',
  )
}
