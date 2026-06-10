import { expect, test } from '@playwright/test'

interface Guest {
  id: number
  email: string | null
  relationship: string | null
}

const liveApiBaseUrl = process.env.LIVE_API_URL ?? process.env.VITE_API_BASE_URL

test.describe('live guest management browser flow', () => {
  test.skip(
    process.env.LIVE_E2E !== '1' || !liveApiBaseUrl,
    'Set LIVE_E2E=1 and LIVE_API_URL or VITE_API_BASE_URL to run against a live API.',
  )

  test('adds, views, edits, deletes, and verifies database persistence', async ({
    page,
    request,
  }, testInfo) => {
    const suffix = `${Date.now()}-${testInfo.project.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
    const name = `Live E2E ${suffix}`
    const email = `live-e2e-${suffix}@example.com`
    let createdId: number | null = null

    try {
      await page.goto('/guests')
      await page.getByRole('button', { name: 'Add Guest' }).click()
      await page.getByLabel('Name').fill(name)
      await page.getByLabel('Email').fill(email)
      await page.getByLabel('Phone').fill('555-0177')
      await page.getByLabel('Relationship').fill('browser live')
      await page.getByLabel('RSVP', { exact: true }).selectOption('accepted')
      await page.getByRole('button', { name: 'Add Guest' }).click()

      await expect(page.getByRole('status')).toHaveText('Guest added successfully.')

      const listResponse = await request.get(`${liveApiBaseUrl}/api/guests`)
      expect(listResponse.ok()).toBeTruthy()
      const createdGuest = ((await listResponse.json()) as Guest[]).find(
        (guest) => guest.email === email,
      )
      expect(createdGuest).toBeTruthy()
      createdId = createdGuest?.id ?? null
      await expect(page.getByRole('cell', { name, exact: true })).toBeVisible()

      await page.getByRole('button', { name: `View ${name}` }).click()
      const details = page.locator('section[aria-labelledby="guest-details-title"]')
      await expect(page.getByRole('heading', { name: 'Guest Details' })).toBeVisible()
      await expect(details.getByText(email)).toBeVisible()

      await page.getByRole('button', { name: `Edit ${name}` }).click()
      await page.getByLabel('Relationship').fill('database verified')
      await page.getByRole('button', { name: 'Save Guest' }).click()
      await expect(page.getByRole('status')).toHaveText('Guest updated successfully.')

      const detailResponse = await request.get(`${liveApiBaseUrl}/api/guests/${createdId}`)
      expect(detailResponse.ok()).toBeTruthy()
      const updatedGuest = (await detailResponse.json()) as Guest
      expect(updatedGuest.relationship).toBe('database verified')

      page.once('dialog', async (dialog) => {
        await dialog.accept()
      })
      await page.getByRole('button', { name: `Delete ${name}` }).click()
      await expect(page.getByRole('status')).toHaveText('Guest deleted successfully.')

      const deletedResponse = await request.get(`${liveApiBaseUrl}/api/guests/${createdId}`)
      expect(deletedResponse.status()).toBe(404)
      createdId = null
    } finally {
      if (createdId !== null) {
        await request.delete(`${liveApiBaseUrl}/api/guests/${createdId}`).catch(() => undefined)
      }
    }
  })
})
