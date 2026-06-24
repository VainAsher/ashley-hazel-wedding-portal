const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export interface Blessing {
  id: number
  author_name: string
  message: string
  created_at: string
}

export interface BlessingCreate {
  author_name?: string | null
  message: string
}

export interface BlessingAdmin {
  id: number
  author_name: string
  message: string
  hidden: boolean
  created_at: string
}

export class BlessingsApiError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'BlessingsApiError'
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

export async function fetchBlessings(apiBaseUrl = API_BASE_URL): Promise<Blessing[]> {
  const response = await fetch(`${apiBaseUrl}/api/blessings`, {
    credentials: 'include',
  })

  if (!response.ok) {
    throw new BlessingsApiError(
      await readErrorMessage(response, 'Unable to load blessings.'),
      response.status,
    )
  }

  return response.json() as Promise<Blessing[]>
}

export async function createBlessing(
  payload: BlessingCreate,
  apiBaseUrl = API_BASE_URL,
): Promise<Blessing> {
  const response = await fetch(`${apiBaseUrl}/api/blessings`, {
    body: JSON.stringify(payload),
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })

  if (!response.ok) {
    throw new BlessingsApiError(
      await readErrorMessage(response, 'Unable to post your blessing.'),
      response.status,
    )
  }

  return response.json() as Promise<Blessing>
}

export async function fetchAllBlessings(apiBaseUrl = API_BASE_URL): Promise<BlessingAdmin[]> {
  const response = await fetch(`${apiBaseUrl}/api/blessings/all`, {
    credentials: 'include',
  })

  if (!response.ok) {
    throw new BlessingsApiError(
      await readErrorMessage(response, 'Unable to load blessings.'),
      response.status,
    )
  }

  return response.json() as Promise<BlessingAdmin[]>
}

export async function moderateBlessing(
  id: number,
  hidden: boolean,
  apiBaseUrl = API_BASE_URL,
): Promise<BlessingAdmin> {
  const response = await fetch(`${apiBaseUrl}/api/blessings/${id}`, {
    body: JSON.stringify({ hidden }),
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    method: 'PATCH',
  })

  if (!response.ok) {
    throw new BlessingsApiError(
      await readErrorMessage(response, 'Unable to update this blessing.'),
      response.status,
    )
  }

  return response.json() as Promise<BlessingAdmin>
}

export async function deleteBlessing(
  id: number,
  apiBaseUrl = API_BASE_URL,
): Promise<{ status: string; id: number }> {
  const response = await fetch(`${apiBaseUrl}/api/blessings/${id}`, {
    credentials: 'include',
    method: 'DELETE',
  })

  if (!response.ok) {
    throw new BlessingsApiError(
      await readErrorMessage(response, 'Unable to delete this blessing.'),
      response.status,
    )
  }

  return response.json() as Promise<{ status: string; id: number }>
}
