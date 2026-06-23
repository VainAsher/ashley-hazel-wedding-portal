import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  createVendor,
  deleteVendor,
  fetchVendors,
  updateVendor,
  type Vendor,
  type VendorPayload,
} from '@/api/vendors'

export type { Vendor, VendorPayload } from '@/api/vendors'
export { VendorApiError } from '@/api/vendors'

export const VENDORS_QUERY_KEY = ['vendors'] as const

export function useVendors() {
  return useQuery<Vendor[]>({
    queryKey: VENDORS_QUERY_KEY,
    queryFn: () => fetchVendors(),
  })
}

export function useCreateVendor() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: VendorPayload) => createVendor(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: VENDORS_QUERY_KEY })
    },
  })
}

export function useUpdateVendor() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: VendorPayload }) =>
      updateVendor(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: VENDORS_QUERY_KEY })
    },
  })
}

export function useDeleteVendor() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => deleteVendor(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: VENDORS_QUERY_KEY })
    },
  })
}
