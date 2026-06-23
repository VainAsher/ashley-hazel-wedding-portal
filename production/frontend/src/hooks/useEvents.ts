import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  createEvent,
  deleteEvent,
  fetchEvents,
  updateEvent,
  type WeddingEvent,
  type WeddingEventPayload,
} from '@/api/events'

export type { WeddingEvent, WeddingEventPayload } from '@/api/events'
export { EventsApiError } from '@/api/events'

export const EVENTS_QUERY_KEY = ['events'] as const

export function useEvents() {
  return useQuery<WeddingEvent[]>({
    queryKey: EVENTS_QUERY_KEY,
    queryFn: () => fetchEvents(),
  })
}

export function useCreateEvent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: WeddingEventPayload) => createEvent(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: EVENTS_QUERY_KEY })
    },
  })
}

export function useUpdateEvent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: WeddingEventPayload }) =>
      updateEvent(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: EVENTS_QUERY_KEY })
    },
  })
}

export function useDeleteEvent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => deleteEvent(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: EVENTS_QUERY_KEY })
    },
  })
}
