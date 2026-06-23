import { useQuery } from '@tanstack/react-query'

import { fetchSettings, type WeddingSettings } from '@/api/settings'

export type { WeddingSettings } from '@/api/settings'
export { SettingsApiError } from '@/api/settings'

export const SETTINGS_QUERY_KEY = ['settings'] as const

export function useSettings() {
  return useQuery<WeddingSettings>({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: () => fetchSettings(),
  })
}
