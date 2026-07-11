import { useQuery } from '@tanstack/react-query'

import {
  fetchPortalProgress,
  fetchPortalSchedule,
  fetchPortalWedding,
  type PortalProgress,
  type PortalScheduleEvent,
  type PortalWedding,
} from '@/api/portal'

export type { PortalProgress, PortalScheduleEvent, PortalWedding } from '@/api/portal'
export { PortalApiError } from '@/api/portal'

export const PORTAL_WEDDING_QUERY_KEY = ['portal', 'wedding'] as const
export const PORTAL_SCHEDULE_QUERY_KEY = ['portal', 'schedule'] as const
export const PORTAL_PROGRESS_QUERY_KEY = ['portal', 'me', 'progress'] as const

export function usePortalWedding() {
  return useQuery<PortalWedding>({
    queryKey: PORTAL_WEDDING_QUERY_KEY,
    queryFn: () => fetchPortalWedding(),
  })
}

export function usePortalSchedule() {
  return useQuery<PortalScheduleEvent[]>({
    queryKey: PORTAL_SCHEDULE_QUERY_KEY,
    queryFn: () => fetchPortalSchedule(),
  })
}

export function usePortalProgress(enabled = true) {
  return useQuery<PortalProgress>({
    queryKey: PORTAL_PROGRESS_QUERY_KEY,
    queryFn: () => fetchPortalProgress(),
    enabled,
    // The checklist must update when the guest comes back to the dashboard
    // after RSVPing / requesting a song / etc: refetch on every mount and on
    // window focus (the app-wide default disables focus refetches).
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })
}
