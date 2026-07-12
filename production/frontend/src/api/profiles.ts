const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export type PartyName = 'stag' | 'hen'

export interface MemberProfile {
  invite_id: number
  display_name: string | null
  role_title: string | null
  about: string | null
  best_known_for: string | null
  favourite_song: string | null
  photo_path: string | null
  photo_url: string | null
  updated_at: string | null
}

export interface MemberProfileUpdateInput {
  display_name?: string | null
  role_title?: string | null
  about?: string | null
  best_known_for?: string | null
  favourite_song?: string | null
}

export interface ProfileDirectoryEntry {
  invite_id: number
  party: PartyName
  display_name: string
  role_title: string | null
  about: string | null
  best_known_for: string | null
  favourite_song: string | null
  photo_path: string | null
  photo_url: string | null
  has_profile: boolean
}

export class ProfilesApiError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'ProfilesApiError'
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
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    throw new ProfilesApiError(extractErrorMessage(payload, fallbackError), response.status)
  }

  return payload as T
}

function jsonRequest<T>(path: string, options: RequestInit, fallbackError: string): Promise<T> {
  return request<T>(
    path,
    {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    },
    fallbackError,
  )
}

/** Returns null (not thrown) for a 404 -- "not eligible for a profile" is a
 * normal, expected state for a guest not in the Stag/Hen party, distinct
 * from any other error. */
export async function fetchMyProfile(): Promise<MemberProfile | null> {
  const response = await fetch(`${API_BASE_URL}/api/profiles/me`, { credentials: 'include' })
  if (response.status === 404) {
    return null
  }
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new ProfilesApiError(
      extractErrorMessage(payload, 'Unable to load your profile.'),
      response.status,
    )
  }
  return payload as MemberProfile
}

export function updateMyProfile(input: MemberProfileUpdateInput): Promise<MemberProfile> {
  return jsonRequest<MemberProfile>(
    '/api/profiles/me',
    { method: 'PUT', body: JSON.stringify(input) },
    'Unable to save your profile.',
  )
}

export function uploadMyProfilePhoto(file: File): Promise<MemberProfile> {
  const formData = new FormData()
  formData.append('file', file)

  // Do NOT set Content-Type -- the browser sets the multipart boundary.
  return request<MemberProfile>(
    '/api/profiles/me/photo',
    { method: 'POST', body: formData },
    'Unable to upload your photo.',
  )
}

export function fetchProfileDirectory(): Promise<ProfileDirectoryEntry[]> {
  return request<ProfileDirectoryEntry[]>(
    '/api/profiles',
    { method: 'GET' },
    'Unable to load the wedding party.',
  )
}
