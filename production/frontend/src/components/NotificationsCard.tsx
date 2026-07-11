import { Mail } from 'lucide-react'

import { notificationSnippet } from '@/components/NotificationsBell'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  useMarkNotificationRead,
  useNotifications,
  type NotificationItem,
} from '@/hooks/useNotifications'
import { formatRelativeTime } from '@/lib/relativeTime'
import { cn } from '@/lib/utils'

const CARD_ITEM_LIMIT = 3

/**
 * Guest Dashboard "Messages" card: the dashboard is the delivery surface for
 * in-app communications. Renders nothing until the member has notifications,
 * then shows the three most recent; clicking an unread one marks it read.
 * Self-contained (own data fetch) so it mounts with a single line.
 */
export function NotificationsCard() {
  const { data } = useNotifications()
  const markRead = useMarkNotificationRead()

  const items = data?.items ?? []
  if (items.length === 0) {
    return null
  }

  const recent = items.slice(0, CARD_ITEM_LIMIT)

  const handleClick = (item: NotificationItem) => {
    if (!item.read_at && !markRead.isPending) {
      markRead.mutate(item.id)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Mail className="h-5 w-5 text-plum" aria-hidden="true" />
          Messages
        </CardTitle>
        <CardDescription>Notes from Ashley, Hazel and the coordinators.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="m-0 grid list-none gap-1 p-0">
          {recent.map((item) => {
            const snippet = notificationSnippet(item.body)
            const unread = !item.read_at
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => handleClick(item)}
                  aria-label={unread ? `Mark ${item.title} read` : item.title}
                  className={cn(
                    'block w-full rounded-md px-3 py-2.5 text-left transition-colors hover:bg-gray-50',
                    unread && 'bg-gold/10',
                  )}
                >
                  <span className="flex items-start gap-2">
                    {unread && (
                      <span
                        data-testid="unread-dot"
                        className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-gold ring-1 ring-plum/30"
                        aria-hidden="true"
                      />
                    )}
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          'block truncate text-sm text-gray-900',
                          unread ? 'font-semibold' : 'font-medium',
                        )}
                      >
                        {item.title}
                      </span>
                      {snippet && (
                        <span className="mt-0.5 block text-xs leading-snug text-gray-600">
                          {snippet}
                        </span>
                      )}
                      <span className="mt-0.5 block text-[11px] text-gray-400">
                        {formatRelativeTime(item.created_at)}
                      </span>
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
