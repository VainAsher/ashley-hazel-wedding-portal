import { useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'

import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  type NotificationItem,
} from '@/hooks/useNotifications'
import { formatRelativeTime } from '@/lib/relativeTime'
import { cn } from '@/lib/utils'

const SNIPPET_LENGTH = 80
const POPOVER_ITEM_LIMIT = 7

export function notificationSnippet(body: string | null): string | null {
  if (!body) {
    return null
  }
  const trimmed = body.trim()
  if (trimmed.length <= SNIPPET_LENGTH) {
    return trimmed
  }
  return `${trimmed.slice(0, SNIPPET_LENGTH).trimEnd()}…`
}

interface NotificationsBellProps {
  /** guest = plum header (cream text); admin = white header (gray text). */
  variant?: 'guest' | 'admin'
}

export function NotificationsBell({ variant = 'guest' }: NotificationsBellProps) {
  const { data } = useNotifications()
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()

  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const items = data?.items ?? []
  const unreadCount = data?.unread_count ?? 0
  const recent = items.slice(0, POPOVER_ITEM_LIMIT)

  const handleItemClick = (item: NotificationItem) => {
    if (!item.read_at && !markRead.isPending) {
      markRead.mutate(item.id)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={
          unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'
        }
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(
          'relative inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors',
          variant === 'guest'
            ? 'text-cream hover:bg-cream/10 focus-visible:ring-2 focus-visible:ring-gold'
            : 'text-gray-600 hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-plum',
        )}
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unreadCount > 0 && (
          <span
            data-testid="notifications-badge"
            className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-gold px-1 text-[11px] font-bold leading-none text-plum"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-gray-200 bg-white text-gray-900 shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
            <p className="m-0 text-sm font-semibold">Notifications</p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                className="text-xs font-medium text-plum underline hover:text-plum/80 disabled:opacity-50"
              >
                Mark all read
              </button>
            )}
          </div>

          {recent.length === 0 ? (
            <p className="m-0 px-4 py-6 text-center text-sm text-gray-500">
              No messages yet.
            </p>
          ) : (
            <ul className="m-0 max-h-96 list-none overflow-y-auto p-0">
              {recent.map((item) => {
                const snippet = notificationSnippet(item.body)
                const unread = !item.read_at
                return (
                  <li key={item.id} className="border-b border-gray-100 last:border-b-0">
                    <button
                      type="button"
                      onClick={() => handleItemClick(item)}
                      aria-label={unread ? `Mark ${item.title} read` : item.title}
                      className={cn(
                        'block w-full px-4 py-3 text-left transition-colors hover:bg-gray-50',
                        unread && 'bg-gold/10',
                      )}
                    >
                      <span className="flex items-start gap-2">
                        {unread && (
                          <span
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
          )}
        </div>
      )}
    </div>
  )
}
