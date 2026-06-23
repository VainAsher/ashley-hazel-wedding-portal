import { useQuery } from '@tanstack/react-query'

import {
  fetchCommunications,
  type Communication,
} from '@/api/communications'

export type {
  Communication,
  CommunicationAudience,
  CommunicationStatus,
} from '@/api/communications'
export { CommunicationApiError } from '@/api/communications'

export const COMMUNICATIONS_QUERY_KEY = ['communications'] as const

export function useCommunications() {
  return useQuery<Communication[]>({
    queryKey: COMMUNICATIONS_QUERY_KEY,
    queryFn: () => fetchCommunications(),
  })
}
