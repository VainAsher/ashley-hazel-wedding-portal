const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export type MenuCourse = 'starter' | 'main' | 'dessert'

export interface MenuOption {
  id: number
  wedding_id: number
  name: string
  description: string | null
  course: MenuCourse | null
  is_vegetarian: boolean
  is_vegan: boolean
  is_gluten_free: boolean
  active: boolean
  created_at: string | null
}

export interface MenuOptionCreatePayload {
  name: string
  description?: string | null
  course?: MenuCourse | null
  is_vegetarian?: boolean
  is_vegan?: boolean
  is_gluten_free?: boolean
}

export interface MenuOptionUpdatePayload {
  name?: string
  description?: string | null
  course?: MenuCourse | null
  is_vegetarian?: boolean
  is_vegan?: boolean
  is_gluten_free?: boolean
  active?: boolean
}

export class MenuApiError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'MenuApiError'
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
  options: RequestInit,
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
    throw new MenuApiError(await readErrorMessage(response, fallbackError), response.status)
  }

  return response.json() as Promise<T>
}

export function fetchMenuOptions(apiBaseUrl = API_BASE_URL): Promise<MenuOption[]> {
  return requestJson<MenuOption[]>(
    '/api/menu',
    { method: 'GET' },
    'Unable to load the menu.',
    apiBaseUrl,
  )
}

export function createMenuOption(
  payload: MenuOptionCreatePayload,
  apiBaseUrl = API_BASE_URL,
): Promise<MenuOption> {
  return requestJson<MenuOption>(
    '/api/menu',
    { method: 'POST', body: JSON.stringify(payload) },
    'Unable to add the menu option.',
    apiBaseUrl,
  )
}

export function updateMenuOption(
  id: number,
  payload: MenuOptionUpdatePayload,
  apiBaseUrl = API_BASE_URL,
): Promise<MenuOption> {
  return requestJson<MenuOption>(
    `/api/menu/${id}`,
    { method: 'PATCH', body: JSON.stringify(payload) },
    'Unable to update the menu option.',
    apiBaseUrl,
  )
}

// Soft delete: the backend flips `active` off so recorded meal choices keep
// pointing at a real option name.
export function deleteMenuOption(
  id: number,
  apiBaseUrl = API_BASE_URL,
): Promise<{ status: string; id: number }> {
  return requestJson<{ status: string; id: number }>(
    `/api/menu/${id}`,
    { method: 'DELETE' },
    'Unable to remove the menu option.',
    apiBaseUrl,
  )
}
