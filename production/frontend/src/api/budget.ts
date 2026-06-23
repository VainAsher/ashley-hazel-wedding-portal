const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export interface BudgetCategory {
  id: number
  category_name: string
  description: string | null
}

export interface BudgetItem {
  id: number
  wedding_id: number
  vendor_id: number | null
  vendor_name: string | null
  category_id: number | null
  category_name: string | null
  description: string | null
  estimated_cost: number | null
  actual_cost: number | null
  paid: boolean
  payment_date: string | null
  notes: string | null
  created_at: string | null
}

export interface BudgetItemPayload {
  wedding_id: number
  vendor_id: number | null
  category_id: number | null
  description: string | null
  estimated_cost: number | null
  actual_cost: number | null
  paid: boolean
  payment_date: string | null
  notes: string | null
}

export interface BudgetSummaryCategory {
  category_id: number
  category_name: string
  estimated: number
  actual: number
  paid: number
}

export interface BudgetSummary {
  total_estimated: number
  total_actual: number
  total_paid: number
  remaining: number
  by_category: BudgetSummaryCategory[]
}

export class BudgetApiError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'BudgetApiError'
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
    throw new BudgetApiError(extractErrorMessage(payload, fallbackError), response.status)
  }

  return payload as T
}

export function fetchBudgetCategories(): Promise<BudgetCategory[]> {
  return request<BudgetCategory[]>(
    '/api/budget/categories',
    { method: 'GET' },
    'Failed to load budget categories',
  )
}

export function fetchBudgetItems(): Promise<BudgetItem[]> {
  return request<BudgetItem[]>(
    '/api/budget/items',
    { method: 'GET' },
    'Failed to load budget items',
  )
}

export function fetchBudgetSummary(): Promise<BudgetSummary> {
  return request<BudgetSummary>(
    '/api/budget/summary',
    { method: 'GET' },
    'Failed to load budget summary',
  )
}

export function createBudgetItem(payload: BudgetItemPayload): Promise<BudgetItem> {
  return request<BudgetItem>(
    '/api/budget/items',
    { method: 'POST', body: JSON.stringify(payload) },
    'Failed to add budget item',
  )
}

export function updateBudgetItem(id: number, payload: BudgetItemPayload): Promise<BudgetItem> {
  return request<BudgetItem>(
    `/api/budget/items/${id}`,
    { method: 'PUT', body: JSON.stringify(payload) },
    'Failed to update budget item',
  )
}

export async function deleteBudgetItem(id: number): Promise<void> {
  await request<unknown>(
    `/api/budget/items/${id}`,
    { method: 'DELETE' },
    'Failed to delete budget item',
  )
}
