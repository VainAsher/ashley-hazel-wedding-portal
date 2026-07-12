import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  createPartyMessage,
  fetchPartyAccess,
  fetchPartySummary,
  moderatePartyMessage,
  setPartyReveal,
  updatePartyInfo,
  type PartyAccess,
  type PartyName,
  type PartySummary,
} from '@/api/party'

export type {
  PartyAccess,
  PartyInfo,
  PartyMember,
  PartyMessage,
  PartyName,
  PartyRevealBanner,
  PartySummary,
} from '@/api/party'
export { PartyApiError } from '@/api/party'

export const PARTY_ACCESS_QUERY_KEY = ['party', 'access'] as const
export const partySummaryQueryKey = (party: PartyName) => ['party', party, 'summary'] as const

export function usePartyAccess() {
  return useQuery<PartyAccess>({
    queryKey: PARTY_ACCESS_QUERY_KEY,
    queryFn: () => fetchPartyAccess(),
  })
}

export function usePartySummary(party: PartyName) {
  return useQuery<PartySummary>({
    queryKey: partySummaryQueryKey(party),
    queryFn: () => fetchPartySummary(party),
  })
}

export function useCreatePartyMessage(party: PartyName) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (message: string) => createPartyMessage(party, message),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: partySummaryQueryKey(party) })
    },
  })
}

export function useModeratePartyMessage(party: PartyName) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      messageId,
      payload,
    }: {
      messageId: number
      payload: { hidden?: boolean; pinned?: boolean }
    }) => moderatePartyMessage(party, messageId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: partySummaryQueryKey(party) })
    },
  })
}

export function useUpdatePartyInfo(party: PartyName) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (details: string | null) => updatePartyInfo(party, details),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: partySummaryQueryKey(party) })
    },
  })
}

export function useSetPartyReveal(party: PartyName) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ inviteId, revealed }: { inviteId: number; revealed: boolean }) =>
      setPartyReveal(party, inviteId, revealed),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: partySummaryQueryKey(party) })
    },
  })
}
