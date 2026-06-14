const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export type AuthRole = 'couple' | 'coordinator' | 'guest'

export interface AuthUser {
  id: number
  name: string
  role: AuthRole
  wedding_id: number
  invite_id: number
  guest_id: number | null
}

export interface LoginResponse {
  user: AuthUser
}

export class AuthApiError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'AuthApiError'
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

export async function loginWithInviteCode(
  inviteCode: string,
  apiBaseUrl = API_BASE_URL,
): Promise<LoginResponse> {
  const response = await fetch(`${apiBaseUrl}/api/auth/login`, {
    body: JSON.stringify({ invite_code: inviteCode }),
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })

  if (!response.ok) {
    throw new AuthApiError(
      await readErrorMessage(response, 'Unable to verify invite code.'),
      response.status,
    )
  }

  return response.json() as Promise<LoginResponse>
}

export async function fetchCurrentUser(
  apiBaseUrl = API_BASE_URL,
): Promise<AuthUser> {
  const response = await fetch(`${apiBaseUrl}/api/auth/me`, {
    credentials: 'include',
  })

  if (!response.ok) {
    throw new AuthApiError(
      await readErrorMessage(response, 'Unable to fetch current user.'),
      response.status,
    )
  }

  const data = await response.json() as AuthUser
  return data
}

export async function logout(apiBaseUrl = API_BASE_URL): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/api/auth/logout`, {
    credentials: 'include',
    method: 'POST',
  })

  if (!response.ok) {
    throw new AuthApiError(
      await readErrorMessage(response, 'Unable to logout.'),
      response.status,
    )
  }
}
