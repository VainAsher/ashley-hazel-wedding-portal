const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export interface Vendor {
  id: number
  wedding_id: number
  vendor_name: string
  category_id: number | null
  category_name: string | null
  contact_person: string | null
  email: string | null
  phone: string | null
  website: string | null
  contract_signed: boolean
  notes: string | null
  created_at: string | null
}

export interface VendorPayload {
  wedding_id: number
  vendor_name: string
  category_id: number | null
  contact_person: string | null
  email: string | null
  phone: string | null
  website: string | null
  contract_signed: boolean
  notes: string | null
}

export class VendorApiError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'VendorApiError'
    this.status = status
  }
}

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === 'string') {
    return payload
  }

  if (!payload || typeof payload !== 'object') {
    return fallback
  }

  const detail = 'detail' in payload ? (payload as { detail: unknown }).detail : null
  if (typeof detail === 'string') {
    return detail
  }

  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (item && typeof item === 'object' && 'msg' in item) {
          return String((item as { msg: unknown }).msg)
        }
        return String(item)
      })
      .join(', ')
  }

  return fallback
}

async function request<T>(
  path: string,
  options: RequestInit,
  fallbackError: string,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : null),
      ...options.headers,
    },
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    throw new VendorApiError(extractErrorMessage(payload, fallbackError), response.status)
  }

  return payload as T
}

export function fetchVendors(): Promise<Vendor[]> {
  return request<Vendor[]>('/api/vendors', { method: 'GET' }, 'Failed to load vendors')
}

export function createVendor(payload: VendorPayload): Promise<Vendor> {
  return request<Vendor>(
    '/api/vendors',
    { method: 'POST', body: JSON.stringify(payload) },
    'Failed to add vendor',
  )
}

export function updateVendor(id: number, payload: VendorPayload): Promise<Vendor> {
  return request<Vendor>(
    `/api/vendors/${id}`,
    { method: 'PUT', body: JSON.stringify(payload) },
    'Failed to update vendor',
  )
}

export async function deleteVendor(id: number): Promise<void> {
  await request<unknown>(`/api/vendors/${id}`, { method: 'DELETE' }, 'Failed to delete vendor')
}
