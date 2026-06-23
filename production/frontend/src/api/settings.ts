const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export interface WeddingSettings {
  wedding_id: number
  wedding_name: string
  wedding_date: string | null
  venue: string | null
  created_at: string | null
  updated_at: string | null
}

export class SettingsApiError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'SettingsApiError'
    this.status = status
  }
}

// TODO: wire to backend API
export function fetchSettings(): Promise<WeddingSettings> {
  void API_BASE_URL
  return Promise.resolve({
    wedding_id: 1,
    wedding_name: '',
    wedding_date: null,
    venue: null,
    created_at: null,
    updated_at: null,
  })
}
