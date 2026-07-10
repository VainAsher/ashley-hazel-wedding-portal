import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  createFeedback,
  fetchFeedback,
  updateFeedback,
  type FeedbackCreate,
  type FeedbackItem,
  type FeedbackStatus,
} from '@/api/feedback'

export type {
  FeedbackCreate,
  FeedbackItem,
  FeedbackStatus,
  FeedbackType,
} from '@/api/feedback'
export { FeedbackApiError } from '@/api/feedback'

export const FEEDBACK_QUERY_KEY = ['feedback'] as const

export function useCreateFeedback() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: FeedbackCreate) => createFeedback(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: FEEDBACK_QUERY_KEY })
    },
  })
}

export function useFeedbackQueue() {
  return useQuery<FeedbackItem[]>({
    queryKey: FEEDBACK_QUERY_KEY,
    queryFn: () => fetchFeedback(),
  })
}

export function useUpdateFeedback() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: FeedbackStatus }) =>
      updateFeedback(id, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: FEEDBACK_QUERY_KEY })
    },
  })
}
