import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationList,
} from '@/api/notifications'

export type {
  NotificationItem,
  NotificationKind,
  NotificationList,
} from '@/api/notifications'
export { NotificationApiError } from '@/api/notifications'

export const NOTIFICATIONS_QUERY_KEY = ['notifications'] as const

export function useNotifications() {
  return useQuery<NotificationList>({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: () => fetchNotifications(),
    // The bell keeps itself current: refetch on window focus (TanStack Query
    // default) plus a slow poll for members who leave the tab open.
    refetchInterval: 60_000,
  })
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => markNotificationRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY })
    },
  })
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY })
    },
  })
}
