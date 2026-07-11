const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export type CommunicationChannel = 'email' | 'whatsapp' | 'sms' | 'announcement'
export type CommunicationAudience =
  | 'all'
  | 'attending'
  | 'pending'
  | 'declined'
  | 'guests'
  | 'coordinators'
  | 'wedding_party'
  | 'stags'
  | 'hens'
export type CommunicationStatus = 'draft' | 'scheduled' | 'sent'

export interface Communication {
  id: number
  wedding_id: number
  subject: string
  body: string | null
  channel: CommunicationChannel
  audience: CommunicationAudience
  status: CommunicationStatus
  scheduled_for: string | null
  sent_at: string | null
  created_at: string | null
  updated_at: string | null
}

export interface CommunicationPayload {
  subject: string
  body: string | null
  channel: CommunicationChannel
  audience: CommunicationAudience
  status: CommunicationStatus
  scheduled_for: string | null
}

export class CommunicationApiError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'CommunicationApiError'
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
    throw new CommunicationApiError(extractErrorMessage(payload, fallbackError), response.status)
  }

  return payload as T
}

export function fetchCommunications(): Promise<Communication[]> {
  return request<Communication[]>(
    '/api/communications',
    { method: 'GET' },
    'Failed to load communications',
  )
}

export function createCommunication(payload: CommunicationPayload): Promise<Communication> {
  return request<Communication>(
    '/api/communications',
    { method: 'POST', body: JSON.stringify(payload) },
    'Failed to create communication',
  )
}

export function updateCommunication(
  id: number,
  payload: CommunicationPayload,
): Promise<Communication> {
  return request<Communication>(
    `/api/communications/${id}`,
    { method: 'PUT', body: JSON.stringify(payload) },
    'Failed to update communication',
  )
}

export async function deleteCommunication(id: number): Promise<void> {
  await request<unknown>(
    `/api/communications/${id}`,
    { method: 'DELETE' },
    'Failed to delete communication',
  )
}

export function sendCommunication(id: number): Promise<Communication> {
  return request<Communication>(
    `/api/communications/${id}/send`,
    { method: 'POST' },
    'Failed to send communication',
  )
}
