import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  createBudgetItem,
  deleteBudgetItem,
  fetchBudgetCategories,
  fetchBudgetItems,
  fetchBudgetSummary,
  updateBudgetItem,
  type BudgetCategory,
  type BudgetItem,
  type BudgetItemPayload,
  type BudgetSummary,
} from '@/api/budget'

export type {
  BudgetCategory,
  BudgetItem,
  BudgetItemPayload,
  BudgetSummary,
  BudgetSummaryCategory,
} from '@/api/budget'
export { BudgetApiError } from '@/api/budget'

export const BUDGET_ITEMS_QUERY_KEY = ['budget', 'items'] as const
export const BUDGET_CATEGORIES_QUERY_KEY = ['budget', 'categories'] as const
export const BUDGET_SUMMARY_QUERY_KEY = ['budget', 'summary'] as const

export function useBudgetItems() {
  return useQuery<BudgetItem[]>({
    queryKey: BUDGET_ITEMS_QUERY_KEY,
    queryFn: () => fetchBudgetItems(),
  })
}

export function useBudgetCategories() {
  return useQuery<BudgetCategory[]>({
    queryKey: BUDGET_CATEGORIES_QUERY_KEY,
    queryFn: () => fetchBudgetCategories(),
  })
}

export function useBudgetSummary() {
  return useQuery<BudgetSummary>({
    queryKey: BUDGET_SUMMARY_QUERY_KEY,
    queryFn: () => fetchBudgetSummary(),
  })
}

function useInvalidateBudget() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: BUDGET_ITEMS_QUERY_KEY })
    void queryClient.invalidateQueries({ queryKey: BUDGET_SUMMARY_QUERY_KEY })
  }
}

export function useCreateBudgetItem() {
  const invalidate = useInvalidateBudget()

  return useMutation({
    mutationFn: (payload: BudgetItemPayload) => createBudgetItem(payload),
    onSuccess: invalidate,
  })
}

export function useUpdateBudgetItem() {
  const invalidate = useInvalidateBudget()

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: BudgetItemPayload }) =>
      updateBudgetItem(id, payload),
    onSuccess: invalidate,
  })
}

export function useDeleteBudgetItem() {
  const invalidate = useInvalidateBudget()

  return useMutation({
    mutationFn: (id: number) => deleteBudgetItem(id),
    onSuccess: invalidate,
  })
}
