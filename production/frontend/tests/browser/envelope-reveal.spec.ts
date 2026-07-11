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
  test('renders the open invitation immediately with no envelope or confetti', async ({
    page,
  }) => {
    // NOTE: the context-level `test.use({ reducedMotion })` option does not
    // reach the page in this Playwright setup; the programmatic API does.
    await page.emulateMedia({ reducedMotion: 'reduce' })
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

  // Sealed: envelope (with the cat wax seal) is shown; the card renders
  // invisibly underneath (it is measured to size the envelope).
  await expect(envelope(page)).toBeVisible()
  await expect(envelope(page).locator('img[src*="cat-seal"]')).toBeVisible()
  await expect(inviteHeading(page)).not.toBeVisible()

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

test('sealed envelope is drawn larger than the card it reveals', async ({ page }) => {
  await mockQuietBackend(page)

  await page.goto('/invite')
  await expect(envelope(page)).toBeVisible()

  // Give the measuring effect a beat to apply the derived size.
  await page.waitForTimeout(400)
  const envelopeBox = await page.getByTestId('envelope-body').boundingBox()

  await envelope(page).click()
  await expect(inviteHeading(page)).toBeVisible()
  // Wait for the enter animation to settle so the card's box is final.
  await expect(page.getByTestId('confetti-canvas')).toHaveCount(0, { timeout: 5000 })
  const cardBox = await page.locator('[data-envelope-card]').boundingBox()

  expect(envelopeBox).not.toBeNull()
  expect(cardBox).not.toBeNull()
  expect(envelopeBox!.width).toBeGreaterThanOrEqual(cardBox!.width)
  expect(envelopeBox!.height).toBeGreaterThanOrEqual(cardBox!.height)
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

test('replay affordance reseals the envelope, which stays sealed until tapped', async ({
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
  await expect(inviteHeading(page)).not.toBeVisible()

  // No auto-open: left untouched, the envelope stays sealed.
  await page.waitForTimeout(3000)
  await expect(envelope(page)).toBeVisible()
  await expect(inviteHeading(page)).not.toBeVisible()

  // Only a tap opens it.
  await envelope(page).click()
  await expect(inviteHeading(page)).toBeVisible()
})
