const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export interface WeddingEvent {
  id: number
  wedding_id: number
  name: string
  date: string | null
  location: string | null
}

export class EventsApiError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'EventsApiError'
    this.status = status
  }
}

export function fetchEvents(): Promise<WeddingEvent[]> {
  // TODO: wire to backend API (GET `${API_BASE_URL}/api/events`)
  void API_BASE_URL
  return Promise.resolve([])
}
