const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export interface BudgetItem {
  id: number
  wedding_id: number
  item: string
  category: string | null
  planned: number
  spent: number
}

export class BudgetApiError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'BudgetApiError'
    this.status = status
  }
}

export function fetchBudgetItems(): Promise<BudgetItem[]> {
  // TODO: wire to backend API (GET `${API_BASE_URL}/api/budget`)
  void API_BASE_URL
  return Promise.resolve([])
}
