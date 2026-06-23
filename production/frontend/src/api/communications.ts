const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export type CommunicationAudience = 'all' | 'accepted' | 'pending' | 'declined'
export type CommunicationStatus = 'draft' | 'scheduled' | 'sent' | 'failed'

export interface Communication {
  id: number
  wedding_id: number
  subject: string
  audience: CommunicationAudience
  status: CommunicationStatus
  sent_at: string | null
  created_at: string | null
  updated_at: string | null
}

export class CommunicationApiError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'CommunicationApiError'
    this.status = status
  }
}

// TODO: wire to backend API
export function fetchCommunications(): Promise<Communication[]> {
  void API_BASE_URL
  return Promise.resolve([])
}
