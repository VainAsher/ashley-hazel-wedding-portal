import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  createBlessing,
  deleteBlessing,
  fetchAllBlessings,
  fetchBlessings,
  moderateBlessing,
  type Blessing,
  type BlessingAdmin,
  type BlessingCreate,
} from '@/api/blessings'

export type { Blessing, BlessingAdmin, BlessingCreate } from '@/api/blessings'
export { BlessingsApiError } from '@/api/blessings'

export const BLESSINGS_QUERY_KEY = ['blessings'] as const
export const ALL_BLESSINGS_QUERY_KEY = ['blessings', 'all'] as const

export function useBlessings() {
  return useQuery<Blessing[]>({
    queryKey: BLESSINGS_QUERY_KEY,
    queryFn: () => fetchBlessings(),
  })
}

export function useCreateBlessing() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: BlessingCreate) => createBlessing(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: BLESSINGS_QUERY_KEY })
    },
  })
}

export function useAllBlessings() {
  return useQuery<BlessingAdmin[]>({
    queryKey: ALL_BLESSINGS_QUERY_KEY,
    queryFn: () => fetchAllBlessings(),
  })
}

export function useModerateBlessing() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, hidden }: { id: number; hidden: boolean }) =>
      moderateBlessing(id, hidden),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ALL_BLESSINGS_QUERY_KEY })
    },
  })
}

export function useDeleteBlessing() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => deleteBlessing(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ALL_BLESSINGS_QUERY_KEY })
    },
  })
}
