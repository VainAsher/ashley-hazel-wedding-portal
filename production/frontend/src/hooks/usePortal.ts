import { useQuery } from '@tanstack/react-query'

import {
  fetchPortalSchedule,
  fetchPortalWedding,
  type PortalScheduleEvent,
  type PortalWedding,
} from '@/api/portal'

export type { PortalScheduleEvent, PortalWedding } from '@/api/portal'
export { PortalApiError } from '@/api/portal'

export const PORTAL_WEDDING_QUERY_KEY = ['portal', 'wedding'] as const
export const PORTAL_SCHEDULE_QUERY_KEY = ['portal', 'schedule'] as const

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
