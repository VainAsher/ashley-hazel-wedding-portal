import { expect, test, type Page, type Route } from '@playwright/test'

/**
 * Save-The-Date envelope reveal (Wave 1 item 5).
 *
 * These specs deliberately do NOT use cleanupPageState(): that shared helper
 * pre-seeds the `ah-envelope-opened` sessionStorage flag so every other spec
 * skips the envelope. Here we manage the flag ourselves so we can exercise
 * both the sealed and open states.
 */

const SESSION_KEY = 'ah-envelope-opened'

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    body: JSON.stringify(body),
    contentType: 'application/json',
    status,
  })
}

async function mockQuietBackend(page: Page) {
  await page.route('**/api/portal/theme', (route) => json(route, { theme: null }))
  await page.route('**/api/auth/me', (route) =>
    json(route, { detail: 'Not authenticated' }, 401),
  )
}

const envelope = (page: Page) =>
  page.getByRole('button', { name: 'Open your invitation' })
const replayButton = (page: Page) =>
  page.getByRole('button', { name: 'Replay the envelope opening' })
const inviteHeading = (page: Page) =>
  page.getByRole('heading', { name: 'Enter Invite Code' })

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })

  test('renders the open invitation immediately with no envelope or confetti', async ({
    page,
  }) => {
    await mockQuietBackend(page)

    await page.goto('/invite')

    await expect(inviteHeading(page)).toBeVisible()
    await expect(page.getByLabel('Invite Code')).toBeVisible()
    await expect(envelope(page)).toHaveCount(0)
    await expect(page.getByTestId('confetti-canvas')).toHaveCount(0)
  })
})

test('first visit shows the sealed envelope; clicking it reveals a usable invite form', async ({
  page,
}) => {
  await mockQuietBackend(page)
  await page.route('**/api/auth/login', (route) =>
    json(route, { detail: 'Invalid invite code' }, 401),
  )

  await page.goto('/invite')

  // Sealed: envelope (with the cat wax seal) is shown, the card is not.
  await expect(envelope(page)).toBeVisible()
  await expect(envelope(page).locator('img[src*="cat-seal"]')).toBeVisible()
  await expect(inviteHeading(page)).toHaveCount(0)

  await envelope(page).click()

  // Open: card rises in with a confetti sprinkle, then the form is usable.
  await expect(page.getByTestId('confetti-canvas')).toBeVisible()
  await expect(inviteHeading(page)).toBeVisible()
  await expect(envelope(page)).toHaveCount(0)

  await page.getByLabel('Invite Code').fill('bad-code')
  await page.getByRole('button', { name: 'Enter the celebration' }).click()
  await expect(page.getByRole('alert')).toHaveText('Code not found')

  // Confetti is one-shot: the canvas unmounts once the burst finishes.
  await expect(page.getByTestId('confetti-canvas')).toHaveCount(0, { timeout: 5000 })
})

test('second visit in the same session skips the envelope', async ({ page }) => {
  await mockQuietBackend(page)

  await page.goto('/invite')
  await envelope(page).click()
  await expect(inviteHeading(page)).toBeVisible()

  // Same browser session: navigating back goes straight to the open card.
  await page.goto('/invite')

  await expect(inviteHeading(page)).toBeVisible()
  await expect(envelope(page)).toHaveCount(0)
})

test('replay affordance reseals the envelope and it auto-opens untouched', async ({
  page,
}) => {
  await mockQuietBackend(page)
  await page.addInitScript(
    (key) => window.sessionStorage.setItem(key, '1'),
    SESSION_KEY,
  )

  await page.goto('/invite')

  // Seeded session: straight to the card, with the replay affordance shown.
  await expect(inviteHeading(page)).toBeVisible()
  await expect(replayButton(page)).toBeVisible()

  await replayButton(page).click()
  await expect(envelope(page)).toBeVisible()
  await expect(inviteHeading(page)).toHaveCount(0)

  // Left untouched, the envelope opens itself after ~2.5s.
  await expect(inviteHeading(page)).toBeVisible({ timeout: 6000 })
  await expect(envelope(page)).toHaveCount(0)
})
