const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export type MentionScope = 'general' | 'stag' | 'hen'

export interface MentionDirectoryEntry {
  invite_id: number
  display_name: string
}

export class MentionsApiError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'MentionsApiError'
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

export async function fetchMentionsDirectory(
  scope: MentionScope,
  apiBaseUrl = API_BASE_URL,
): Promise<MentionDirectoryEntry[]> {
  const response = await fetch(
    `${apiBaseUrl}/api/mentions/directory?scope=${encodeURIComponent(scope)}`,
    { credentials: 'include' },
  )

  if (!response.ok) {
    throw new MentionsApiError(
      await readErrorMessage(response, 'Unable to load the mention directory.'),
      response.status,
    )
  }

  return response.json() as Promise<MentionDirectoryEntry[]>
}
