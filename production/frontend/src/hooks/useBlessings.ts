import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  createBlessing,
  fetchBlessings,
  type Blessing,
  type BlessingCreate,
} from '@/api/blessings'

export type { Blessing, BlessingCreate } from '@/api/blessings'
export { BlessingsApiError } from '@/api/blessings'

export const BLESSINGS_QUERY_KEY = ['blessings'] as const

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
