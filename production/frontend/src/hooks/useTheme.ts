import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'

import { fetchPortalTheme, type PortalThemeResponse } from '@/api/portal'
import { applyTheme, DEFAULT_THEME, type WeddingTheme } from '@/lib/theme'

export const PORTAL_THEME_QUERY_KEY = ['portal', 'theme'] as const

export function usePortalTheme(): WeddingTheme {
  const { data } = useQuery<PortalThemeResponse>({
    queryKey: PORTAL_THEME_QUERY_KEY,
    queryFn: () => fetchPortalTheme(),
    staleTime: 5 * 60 * 1000,
    // Cosmetic only — never block or error a page over the theme.
    retry: 1,
  })

  return data?.theme ?? DEFAULT_THEME
}

/**
 * Mounted once in App: applies the couple's theme (or the prototype
 * defaults) as CSS custom properties whenever it loads or changes.
 */
export function ThemeApplier() {
  const theme = usePortalTheme()

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  return null
}
