import { useQuery } from '@tanstack/react-query'

import { fetchRsvpResponses, type RsvpResponse } from '@/api/rsvpAdmin'

export type { RsvpResponse, RsvpResponseStatus } from '@/api/rsvpAdmin'

export const RSVP_ADMIN_QUERY_KEY = ['rsvp-admin'] as const

export function useRsvpAdmin() {
  return useQuery<RsvpResponse[]>({
    queryKey: RSVP_ADMIN_QUERY_KEY,
    queryFn: () => fetchRsvpResponses(),
  })
}
