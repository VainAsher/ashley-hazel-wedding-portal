import { useQuery } from '@tanstack/react-query'

import { fetchTimelineMilestones, type TimelineMilestone } from '@/api/timeline'

export type { TimelineMilestone, MilestoneStatus } from '@/api/timeline'

export const TIMELINE_QUERY_KEY = ['timeline'] as const

export function useTimeline() {
  return useQuery<TimelineMilestone[]>({
    queryKey: TIMELINE_QUERY_KEY,
    queryFn: () => fetchTimelineMilestones(),
  })
}
