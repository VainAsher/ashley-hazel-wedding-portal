import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  fetchSettings,
  updateSettings,
  type WeddingSettings,
  type WeddingSettingsPayload,
} from '@/api/settings'

export type { WeddingSettings, WeddingSettingsPayload } from '@/api/settings'
export { SettingsApiError } from '@/api/settings'

export const SETTINGS_QUERY_KEY = ['settings'] as const

export function useSettings() {
  return useQuery<WeddingSettings>({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: () => fetchSettings(),
  })
}

export function useUpdateSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: WeddingSettingsPayload) => updateSettings(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY })
    },
  })
}
