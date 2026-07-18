import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  fetchSettings,
  updateSettings,
  uploadPageBackground,
  type WeddingSettings,
  type WeddingSettingsPayload,
} from '@/api/settings'

import { PORTAL_THEME_QUERY_KEY } from '@/hooks/useTheme'

export type {
  WeddingSettings,
  WeddingSettingsPayload,
  WeddingPhase,
  WeddingThemeSettings,
  PartyVisibilityMode,
  LayoutMode,
  PageBackground,
  PageBackgroundKey,
  PageBackgroundSource,
  BackgroundUploadResponse,
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

// Drops the file and returns its URL — no query to invalidate, the card
// consumes the URL directly into its own working state.
export function useUploadPageBackground() {
  return useMutation({
    mutationFn: (file: File) => uploadPageBackground(file),
  })
}
