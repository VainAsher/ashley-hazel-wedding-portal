const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export type VendorStatus = 'prospect' | 'contacted' | 'booked' | 'cancelled'

export interface Vendor {
  id: number
  wedding_id: number
  name: string
  category: string
  contact: string | null
  status: VendorStatus
  created_at: string | null
  updated_at: string | null
}

export class VendorApiError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'VendorApiError'
    this.status = status
  }
}

// TODO: wire to backend API
export function fetchVendors(): Promise<Vendor[]> {
  void API_BASE_URL
  return Promise.resolve([])
}
