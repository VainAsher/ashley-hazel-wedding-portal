const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export type FeedbackType = 'bug' | 'idea'
export type FeedbackStatus = 'new' | 'triaged' | 'done'

export interface FeedbackItem {
  id: number
  wedding_id: number
  submitted_by: string
  type: FeedbackType
  message: string
  page: string | null
  role: string | null
  viewport: string | null
  status: FeedbackStatus
  created_at: string
}

export interface FeedbackCreate {
  type: FeedbackType
  message: string
  page?: string | null
  role?: string | null
  viewport?: string | null
}

export class FeedbackApiError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'FeedbackApiError'
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

export async function createFeedback(
  payload: FeedbackCreate,
  apiBaseUrl = API_BASE_URL,
): Promise<FeedbackItem> {
  const response = await fetch(`${apiBaseUrl}/api/feedback`, {
    body: JSON.stringify(payload),
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })

  if (!response.ok) {
    throw new FeedbackApiError(
      await readErrorMessage(response, 'Unable to send your feedback.'),
      response.status,
    )
  }

  return response.json() as Promise<FeedbackItem>
}

export async function fetchFeedback(apiBaseUrl = API_BASE_URL): Promise<FeedbackItem[]> {
  const response = await fetch(`${apiBaseUrl}/api/feedback`, {
    credentials: 'include',
  })

  if (!response.ok) {
    throw new FeedbackApiError(
      await readErrorMessage(response, 'Unable to load feedback.'),
      response.status,
    )
  }

  return response.json() as Promise<FeedbackItem[]>
}

export async function updateFeedback(
  id: number,
  status: FeedbackStatus,
  apiBaseUrl = API_BASE_URL,
): Promise<FeedbackItem> {
  const response = await fetch(`${apiBaseUrl}/api/feedback/${id}`, {
    body: JSON.stringify({ status }),
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    method: 'PATCH',
  })

  if (!response.ok) {
    throw new FeedbackApiError(
      await readErrorMessage(response, 'Unable to update this feedback.'),
      response.status,
    )
  }

  return response.json() as Promise<FeedbackItem>
}
