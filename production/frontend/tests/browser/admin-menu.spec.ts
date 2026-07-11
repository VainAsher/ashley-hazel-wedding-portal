import { expect, test, type Page, type Route } from '@playwright/test'
import { cleanupPageState, initializeErrorTracking, filterIgnorableErrors, getBrowserErrors } from './fixtures/page-cleanup'

interface MenuOption {
  id: number
  wedding_id: number
  name: string
  description: string | null
  course: string | null
  is_vegetarian: boolean
  is_vegan: boolean
  is_gluten_free: boolean
  active: boolean
  created_at: string | null
}

function menuOption(partial: Partial<MenuOption> & Pick<MenuOption, 'id' | 'name'>): MenuOption {
  return {
    wedding_id: 1,
    description: null,
    course: null,
    is_vegetarian: false,
    is_vegan: false,
    is_gluten_free: false,
    active: true,
    created_at: null,
    ...partial,
  }
}

const initialOptions: MenuOption[] = [
  menuOption({
    id: 1,
    name: 'Herb Roast Chicken',
    description: 'With seasonal vegetables',
  }),
  menuOption({
    id: 2,
    name: 'Wild Mushroom Wellington',
    is_vegetarian: true,
    is_vegan: true,
  }),
  menuOption({ id: 3, name: 'Retired Beef', active: false }),
]

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ body: JSON.stringify(body), contentType: 'application/json', status })
}

interface RecordedRequests {
  posts: unknown[]
  patches: { id: number; payload: unknown }[]
  deletes: number[]
  settingsPuts: unknown[]
}

async function installMenuApi(
  page: Page,
  requests: RecordedRequests,
  options: { mealSelectionOpen?: boolean } = {},
) {
  let menu = initialOptions.map((option) => ({ ...option }))
  let nextId = 100
  let settings = {
    id: 1,
    couple_names: 'Ashley & Hazel',
    wedding_date: '2026-09-12',
    ceremony_time: null,
    ceremony_location: null,
    reception_location: null,
    phase: 'live',
    theme: null,
    meal_selection_open: options.mealSelectionOpen ?? false,
  }

  await page.route('**/api/settings/wedding', async (route) => {
    const method = route.request().method()
    if (method === 'PUT') {
      const payload = route.request().postDataJSON() as Record<string, unknown>
      requests.settingsPuts.push(payload)
      settings = { ...settings, ...payload }
      await json(route, settings)
      return
    }
    await json(route, settings)
  })

  await page.route('**/api/menu', async (route) => {
    const method = route.request().method()
    if (method === 'POST') {
      const payload = route.request().postDataJSON() as Record<string, unknown>
      requests.posts.push(payload)
      const created = menuOption({
        id: nextId++,
        name: String(payload.name),
        description: (payload.description as string | null) ?? null,
        is_vegetarian: Boolean(payload.is_vegetarian),
        is_vegan: Boolean(payload.is_vegan),
        is_gluten_free: Boolean(payload.is_gluten_free),
      })
      menu = [...menu, created]
      await json(route, created, 201)
      return
    }
    await json(route, menu)
  })

  await page.route(/\/api\/menu\/(\d+)$/, async (route) => {
    const method = route.request().method()
    const id = Number(route.request().url().match(/\/api\/menu\/(\d+)$/)?.[1])
    const existing = menu.find((option) => option.id === id)
    if (!existing) {
      await json(route, { detail: 'Menu option not found' }, 404)
      return
    }

    if (method === 'PATCH') {
      const payload = route.request().postDataJSON() as Partial<MenuOption>
      requests.patches.push({ id, payload })
      const updated = { ...existing, ...payload }
      menu = menu.map((option) => (option.id === id ? updated : option))
      await json(route, updated)
      return
    }

    if (method === 'DELETE') {
      requests.deletes.push(id)
      menu = menu.map((option) => (option.id === id ? { ...option, active: false } : option))
      await json(route, { status: 'deleted', id })
      return
    }

    await json(route, existing)
  })
}

function makeRequests(): RecordedRequests {
  return { posts: [], patches: [], deletes: [], settingsPuts: [] }
}

test.beforeEach(async ({ page }) => {
  await cleanupPageState(page)
  await initializeErrorTracking(page)

  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      status: 200,
      body: JSON.stringify({
        id: 1,
        name: 'Test Coordinator',
        role: 'coordinator',
        wedding_id: 1,
        invite_id: 1,
        guest_id: null,
      }),
    })
  })
})

test.afterEach(async ({ page }) => {
  const browserErrors = getBrowserErrors(page)
  const unexpectedErrors = filterIgnorableErrors(browserErrors, [])
  expect(unexpectedErrors).toEqual([])
})

function menuCard(page: Page) {
  return page.getByLabel('Menu builder')
}

test('renders the menu options with dietary chips and hidden state', async ({ page }) => {
  await installMenuApi(page, makeRequests())

  await page.goto('/admin/settings')

  const card = menuCard(page)
  await expect(card.getByText('Herb Roast Chicken')).toBeVisible()
  await expect(card.getByText('With seasonal vegetables')).toBeVisible()

  // Dietary chips sit inside the Wellington's list row (the add form has
  // checkbox labels with the same words, so scope to the row).
  const wellington = card.getByRole('listitem').filter({ hasText: 'Wild Mushroom Wellington' })
  await expect(wellington.getByText('Vegetarian', { exact: true })).toBeVisible()
  await expect(wellington.getByText('Vegan', { exact: true })).toBeVisible()

  // Inactive options are listed for the coordinator, marked Hidden.
  await expect(card.getByText('Hidden', { exact: true })).toBeVisible()

  // The switch reflects the closed state from settings.
  await expect(card.getByLabel('Meal selection open')).not.toBeChecked()
})

test('adds a menu option with dietary flags', async ({ page }) => {
  const requests = makeRequests()
  await installMenuApi(page, requests)

  await page.goto('/admin/settings')

  const card = menuCard(page)
  await card.getByLabel('Name', { exact: true }).fill('Grilled Sea Bass')
  await card.getByLabel('Description', { exact: true }).fill('Lemon butter, samphire')
  await card.getByLabel('Gluten-free', { exact: true }).check()
  await card.getByRole('button', { name: 'Add option' }).click()

  await expect(page.getByRole('status').filter({ hasText: 'Menu option added.' })).toBeVisible()
  await expect(card.getByText('Grilled Sea Bass')).toBeVisible()

  expect(requests.posts).toEqual([
    {
      name: 'Grilled Sea Bass',
      description: 'Lemon butter, samphire',
      is_vegetarian: false,
      is_vegan: false,
      is_gluten_free: true,
    },
  ])
})

test('edits an existing option', async ({ page }) => {
  const requests = makeRequests()
  await installMenuApi(page, requests)

  await page.goto('/admin/settings')

  const card = menuCard(page)
  await card.getByRole('button', { name: 'Edit Herb Roast Chicken' }).click()

  const editForm = card.getByRole('form', { name: 'Edit Herb Roast Chicken' })
  await expect(editForm.getByLabel('Name', { exact: true })).toHaveValue('Herb Roast Chicken')
  await editForm.getByLabel('Name', { exact: true }).fill('Lemon Roast Chicken')
  await editForm.getByLabel('Vegetarian', { exact: true }).check()
  await editForm.getByRole('button', { name: 'Save option' }).click()

  await expect(page.getByRole('status').filter({ hasText: 'Menu option updated.' })).toBeVisible()
  await expect(card.getByText('Lemon Roast Chicken')).toBeVisible()

  expect(requests.patches).toEqual([
    {
      id: 1,
      payload: {
        name: 'Lemon Roast Chicken',
        description: 'With seasonal vegetables',
        is_vegetarian: true,
        is_vegan: false,
        is_gluten_free: false,
      },
    },
  ])
})

test('toggles an option in and out of the guest menu', async ({ page }) => {
  const requests = makeRequests()
  await installMenuApi(page, requests)

  await page.goto('/admin/settings')

  const card = menuCard(page)
  await card.getByRole('button', { name: 'Hide Herb Roast Chicken' }).click()

  await expect(page.getByRole('status').filter({ hasText: 'Option hidden from guests.' })).toBeVisible()
  await expect(card.getByRole('button', { name: 'Show Herb Roast Chicken' })).toBeVisible()
  expect(requests.patches).toEqual([{ id: 1, payload: { active: false } }])

  await card.getByRole('button', { name: 'Show Retired Beef' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Option visible to guests.' })).toBeVisible()
  expect(requests.patches).toEqual([
    { id: 1, payload: { active: false } },
    { id: 3, payload: { active: true } },
  ])
})

test('deletes an option (soft delete keeps it listed as hidden)', async ({ page }) => {
  const requests = makeRequests()
  await installMenuApi(page, requests)

  await page.goto('/admin/settings')

  const card = menuCard(page)
  await card.getByRole('button', { name: 'Delete Wild Mushroom Wellington' }).click()

  await expect(
    page.getByRole('status').filter({ hasText: 'Menu option removed from the guest menu.' }),
  ).toBeVisible()
  expect(requests.deletes).toEqual([2])
  // Soft-deleted options stay in the coordinator list, marked Hidden.
  await expect(card.getByText('Wild Mushroom Wellington')).toBeVisible()
  await expect(card.getByRole('button', { name: 'Show Wild Mushroom Wellington' })).toBeVisible()
})

test('opens and closes meal selection via the switch', async ({ page }) => {
  const requests = makeRequests()
  await installMenuApi(page, requests)

  await page.goto('/admin/settings')

  const card = menuCard(page)
  await card.getByLabel('Meal selection open').check()

  await expect(
    page.getByRole('status').filter({ hasText: 'Meal selection is now open' }),
  ).toBeVisible()
  await expect(card.getByLabel('Meal selection open')).toBeChecked()
  expect(requests.settingsPuts).toEqual([{ meal_selection_open: true }])

  await card.getByLabel('Meal selection open').uncheck()
  await expect(
    page.getByRole('status').filter({ hasText: 'Meal selection closed' }),
  ).toBeVisible()
  expect(requests.settingsPuts).toEqual([
    { meal_selection_open: true },
    { meal_selection_open: false },
  ])
})
