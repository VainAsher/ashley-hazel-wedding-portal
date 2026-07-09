import { useEffect } from 'react'

const SITE_TITLE = "Ashley & Hazel's Wedding"

/**
 * Sets the document title for the current route, restoring the site default
 * on unmount so titles never leak between pages.
 */
export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · ${SITE_TITLE}` : SITE_TITLE
    return () => {
      document.title = SITE_TITLE
    }
  }, [title])
}
