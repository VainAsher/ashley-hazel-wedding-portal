import { type Page } from '@playwright/test'

/**
 * Reset all page state and context for test isolation
 * This is called automatically by fixtures but can be used manually
 */
export async function cleanupPageState(page: Page): Promise<void> {
  try {
    // Clear all route handlers from previous tests
    // Use a wildcard pattern to match all routes
    await page.unroute('**/*').catch(() => {
      // Silently ignore if unroute fails
    })

    // Clear cookies and local storage
    await page.context().clearCookies()
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    }).catch(() => {
      // Ignore errors if page isn't loaded yet
    })

    // Reset browserErrors tracking
    Reflect.deleteProperty(page, 'browserErrors')
  } catch (error) {
    // Silently ignore cleanup errors
  }
}

/**
 * Initialize error tracking on page for test validation
 * Returns the browserErrors array for custom filtering if needed
 */
export async function initializeErrorTracking(page: Page): Promise<string[]> {
  const browserErrors: string[] = []

  page.on('console', (message) => {
    if (message.type() === 'error') {
      browserErrors.push(message.text())
    }
  })

  page.on('pageerror', (error) => {
    browserErrors.push(error.message)
  })

  // Store on page for afterEach access
  Reflect.set(page, 'browserErrors', browserErrors)

  return browserErrors
}

/**
 * Get tracked browser errors from page
 */
export function getBrowserErrors(page: Page): string[] {
  return (Reflect.get(page, 'browserErrors') as string[] | undefined) ?? []
}

/**
 * Filter out expected/ignorable errors
 */
export function filterIgnorableErrors(
  errors: string[],
  ignoredPatterns: string[] = [],
): string[] {
  const defaultIgnored = [
    'the server responded with a status of 401',
    'the server responded with a status of 400',
    'net::ERR_FAILED',
    'Write permission denied', // Clipboard API not available in headless
  ]

  const allIgnored = [...defaultIgnored, ...ignoredPatterns]

  return errors.filter((message) =>
    !allIgnored.some((ignored) => message.includes(ignored))
  )
}
