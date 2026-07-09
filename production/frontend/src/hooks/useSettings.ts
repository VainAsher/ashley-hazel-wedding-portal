import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  fetchSettings,
  updateSettings,
  type WeddingSettings,
  type WeddingSettingsPayload,
} from '@/api/settings'

import { PORTAL_THEME_QUERY_KEY } from '@/hooks/useTheme'

export type {
  WeddingSettings,
  WeddingSettingsPayload,
  WeddingPhase,
  WeddingThemeSettings,
} from '@/api/settings'
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
      // Theme changes apply live everywhere ThemeApplier is mounted.
      void queryClient.invalidateQueries({ queryKey: PORTAL_THEME_QUERY_KEY })
    },
  })
}
