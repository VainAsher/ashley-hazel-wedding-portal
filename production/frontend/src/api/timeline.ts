const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export type MilestoneStatus = 'pending' | 'in_progress' | 'done'

export interface TimelineMilestone {
  id: number
  wedding_id: number
  title: string
  due_date: string | null
  status: MilestoneStatus
}

export class TimelineApiError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'TimelineApiError'
    this.status = status
  }
}

export function fetchTimelineMilestones(): Promise<TimelineMilestone[]> {
  // TODO: wire to backend API (GET `${API_BASE_URL}/api/timeline`)
  void API_BASE_URL
  return Promise.resolve([])
}
