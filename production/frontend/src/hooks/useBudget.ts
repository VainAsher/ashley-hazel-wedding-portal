import { useQuery } from '@tanstack/react-query'

import { fetchBudgetItems, type BudgetItem } from '@/api/budget'

export type { BudgetItem } from '@/api/budget'

export const BUDGET_QUERY_KEY = ['budget'] as const

export function useBudget() {
  return useQuery<BudgetItem[]>({
    queryKey: BUDGET_QUERY_KEY,
    queryFn: () => fetchBudgetItems(),
  })
}
