const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export type RsvpResponseStatus = 'pending' | 'accepted' | 'declined' | 'tentative'

export interface RsvpResponse {
  id: number
  wedding_id: number
  guest_name: string
  rsvp_status: RsvpResponseStatus
  party_size: number | null
  responded_at: string | null
}

export class RsvpAdminApiError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'RsvpAdminApiError'
    this.status = status
  }
}

export function fetchRsvpResponses(): Promise<RsvpResponse[]> {
  // TODO: wire to backend API (GET `${API_BASE_URL}/api/rsvp`)
  void API_BASE_URL
  return Promise.resolve([])
}
