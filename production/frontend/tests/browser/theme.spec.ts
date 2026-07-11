import { expect, test, type Page, type Route } from '@playwright/test'
import {
  cleanupPageState,
  filterIgnorableErrors,
  getBrowserErrors,
  initializeErrorTracking,
} from './fixtures/page-cleanup'

// Guest-side application of the couple's theme dials: ThemeApplier reads the
// public /api/portal/theme endpoint (the invite page is pre-login, so this
// also proves the AuthLayout flow) and sets CSS custom properties. Fonts ride
// the same flow: non-default choices inject a single Google Fonts stylesheet;
// the default Georgia + Inter theme injects nothing.

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ body: JSON.stringify(body), contentType: 'application/json', status })
}

const FONTS_LINK = 'link#ah-theme-fonts'

function rootStyles(page: Page) {
  return page.evaluate(() => ({
    display: document.documentElement.style.getPropertyValue('--font-display'),
    sans: document.documentElement.style.getPropertyValue('--font-sans'),
    fontSize: document.documentElement.style.fontSize,
  }))
}

test.beforeEach(async ({ page }) => {
  await cleanupPageState(page)
  await initializeErrorTracking(page)

  // Never fetch real font CSS in tests.
  await page.route('https://fonts.googleapis.com/**', (route) =>
    route.fulfill({ body: '', contentType: 'text/css' }),
  )

  await page.route('**/api/auth/me', (route) => json(route, { detail: 'Not authenticated' }, 401))
})

test.afterEach(async ({ page }) => {
  const unexpectedErrors = filterIgnorableErrors(getBrowserErrors(page), [
    'the server responded with a status of 401',
  ])
  expect(unexpectedErrors).toEqual([])
})

test('default theme sets the canonical font stacks and injects NO Google Fonts link', async ({
  page,
}) => {
  // page-cleanup already mocks /api/portal/theme as { theme: null } (defaults).
  await page.goto('/invite')
  await expect(page.getByRole('heading', { name: 'Enter Invite Code' })).toBeVisible()

  await expect.poll(() => rootStyles(page)).toEqual({
    display: 'Georgia, "Times New Roman", serif',
    sans: 'Inter, system-ui, sans-serif',
    fontSize: '',
  })

  await expect(page.locator(FONTS_LINK)).toHaveCount(0)
})

test('non-default theme sets the font CSS vars, scale, and one Google Fonts link', async ({
  page,
}) => {
  await page.route('**/api/portal/theme', (route) =>
    json(route, {
      theme: {
        primary: '#f6c445',
        secondary: '#2b064d',
        tint_opacity: 0.9,
        display_font: 'Cormorant Garamond',
        body_font: 'Karla',
        type_scale: 1.1,
      },
    }),
  )

  await page.goto('/invite')
  await expect(page.getByRole('heading', { name: 'Enter Invite Code' })).toBeVisible()

  await expect.poll(() => rootStyles(page)).toEqual({
    display: '"Cormorant Garamond", Georgia, serif',
    sans: 'Karla, Inter, system-ui, sans-serif',
    fontSize: '110%',
  })

  const link = page.locator(FONTS_LINK)
  await expect(link).toHaveCount(1)
  const href = await link.getAttribute('href')
  expect(href).toContain('https://fonts.googleapis.com/css2?')
  expect(href).toContain('family=Cormorant+Garamond')
  expect(href).toContain('family=Karla')
  expect(href).toContain('display=swap')

  // The headline actually renders in the chosen display stack via the
  // tailwind font-display -> var(--font-display) wiring.
  await expect(page.getByRole('heading', { name: 'Enter Invite Code' })).toHaveCSS(
    'font-family',
    /Cormorant Garamond/,
  )
})

test('a display-only font choice loads just that family', async ({ page }) => {
  await page.route('**/api/portal/theme', (route) =>
    json(route, {
      theme: {
        primary: '#f6c445',
        secondary: '#2b064d',
        tint_opacity: 0.9,
        display_font: 'Great Vibes',
        body_font: 'Inter',
        type_scale: 1.0,
      },
    }),
  )

  await page.goto('/invite')
  await expect(page.getByRole('heading', { name: 'Enter Invite Code' })).toBeVisible()

  const link = page.locator(FONTS_LINK)
  await expect(link).toHaveCount(1)
  const href = await link.getAttribute('href')
  expect(href).toContain('family=Great+Vibes')
  expect(href).not.toContain('family=Inter')
})
