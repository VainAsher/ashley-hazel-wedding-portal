const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export type NotificationKind = 'communication' | 'mention' | 'system'

export interface NotificationItem {
  id: number
  wedding_id: number
  kind: NotificationKind
  title: string
  body: string | null
  link_path: string | null
  created_at: string | null
  read_at: string | null
}

export interface NotificationList {
  items: NotificationItem[]
  unread_count: number
}

export class NotificationApiError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'NotificationApiError'
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

export async function fetchNotifications(apiBaseUrl = API_BASE_URL): Promise<NotificationList> {
  const response = await fetch(`${apiBaseUrl}/api/notifications`, {
    credentials: 'include',
  })

  if (!response.ok) {
    throw new NotificationApiError(
      await readErrorMessage(response, 'Unable to load notifications.'),
      response.status,
    )
  }

  return response.json() as Promise<NotificationList>
}

export async function markNotificationRead(
  id: number,
  apiBaseUrl = API_BASE_URL,
): Promise<NotificationItem> {
  const response = await fetch(`${apiBaseUrl}/api/notifications/${id}/read`, {
    credentials: 'include',
    method: 'POST',
  })

  if (!response.ok) {
    throw new NotificationApiError(
      await readErrorMessage(response, 'Unable to update this notification.'),
      response.status,
    )
  }

  return response.json() as Promise<NotificationItem>
}

export async function markAllNotificationsRead(
  apiBaseUrl = API_BASE_URL,
): Promise<{ updated: number }> {
  const response = await fetch(`${apiBaseUrl}/api/notifications/read-all`, {
    credentials: 'include',
    method: 'POST',
  })

  if (!response.ok) {
    throw new NotificationApiError(
      await readErrorMessage(response, 'Unable to update notifications.'),
      response.status,
    )
  }

  return response.json() as Promise<{ updated: number }>
}
