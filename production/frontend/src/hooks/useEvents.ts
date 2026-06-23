import { useQuery } from '@tanstack/react-query'

import { fetchEvents, type WeddingEvent } from '@/api/events'

export type { WeddingEvent } from '@/api/events'

export const EVENTS_QUERY_KEY = ['events'] as const

export function useEvents() {
  return useQuery<WeddingEvent[]>({
    queryKey: EVENTS_QUERY_KEY,
    queryFn: () => fetchEvents(),
  })
}
