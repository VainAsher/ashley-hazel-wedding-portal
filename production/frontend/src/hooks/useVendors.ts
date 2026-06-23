import { useQuery } from '@tanstack/react-query'

import { fetchVendors, type Vendor } from '@/api/vendors'

export type { Vendor, VendorStatus } from '@/api/vendors'
export { VendorApiError } from '@/api/vendors'

export const VENDORS_QUERY_KEY = ['vendors'] as const

export function useVendors() {
  return useQuery<Vendor[]>({
    queryKey: VENDORS_QUERY_KEY,
    queryFn: () => fetchVendors(),
  })
}
