import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  createCommunication,
  deleteCommunication,
  fetchCommunications,
  sendCommunication,
  updateCommunication,
  type Communication,
  type CommunicationPayload,
} from '@/api/communications'

export type {
  Communication,
  CommunicationAudience,
  CommunicationChannel,
  CommunicationPayload,
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

export function useCreateCommunication() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CommunicationPayload) => createCommunication(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: COMMUNICATIONS_QUERY_KEY })
    },
  })
}

export function useUpdateCommunication() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: CommunicationPayload }) =>
      updateCommunication(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: COMMUNICATIONS_QUERY_KEY })
    },
  })
}

export function useDeleteCommunication() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => deleteCommunication(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: COMMUNICATIONS_QUERY_KEY })
    },
  })
}

export function useSendCommunication() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => sendCommunication(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: COMMUNICATIONS_QUERY_KEY })
    },
  })
}
