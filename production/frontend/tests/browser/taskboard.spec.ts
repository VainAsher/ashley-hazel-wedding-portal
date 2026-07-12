import { expect, test, type Page, type Route } from '@playwright/test'
import { cleanupPageState, initializeErrorTracking, filterIgnorableErrors, getBrowserErrors } from './fixtures/page-cleanup'

/**
 * Kanban V2 (docs/specs/KANBAN_V2.md): drag & drop, inline edits, filters,
 * and chip semantics on the extracted <TaskBoard>. A busy, realistic board
 * (9 tasks across all four columns, varied priorities/due dates) so these
 * specs exercise real layout, not a toy one.
 */

type TaskStatus = 'not_started' | 'in_progress' | 'done' | 'blocked'
type TaskPriority = 'low' | 'medium' | 'high'
type TaskContext = 'wedding' | 'stag' | 'hen'

interface Task {
  id: number
  wedding_id: number
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  context: TaskContext
  position: number
  due_date: string | null
  assigned_to: string | null
  category: string | null
}

function isoDaysFromToday(offsetDays: number): string {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function task(overrides: Partial<Task> & { id: number; title: string }): Task {
  return {
    wedding_id: 1,
    description: null,
    status: 'not_started',
    priority: 'medium',
    context: 'wedding',
    position: 0,
    due_date: null,
    assigned_to: null,
    category: null,
    ...overrides,
  }
}

function seedTasks(): Task[] {
  return [
    task({
      id: 9001,
      title: 'Order invitations',
      status: 'not_started',
      priority: 'medium',
      position: 0,
      due_date: isoDaysFromToday(-2), // overdue
    }),
    task({
      id: 9002,
      title: 'Confirm catering',
      status: 'not_started',
      priority: 'low',
      position: 1,
      due_date: isoDaysFromToday(20), // neutral
    }),
    task({
      id: 9003,
      title: 'Choose flowers',
      status: 'not_started',
      priority: 'high',
      position: 2,
      due_date: null,
    }),
    task({
      id: 9004,
      title: 'Book the venue',
      status: 'in_progress',
      priority: 'high',
      position: 0,
      due_date: isoDaysFromToday(3), // due-soon
      assigned_to: 'Hazel',
    }),
    task({
      id: 9005,
      title: 'Book photographer',
      status: 'in_progress',
      priority: 'medium',
      position: 1,
      due_date: isoDaysFromToday(1), // due-soon
      assigned_to: 'Ashley',
    }),
    task({
      id: 9006,
      title: 'Send save-the-dates',
      status: 'blocked',
      priority: 'high',
      position: 0,
      due_date: isoDaysFromToday(-5), // overdue
    }),
    task({
      id: 9007,
      title: 'Pick wedding cake',
      status: 'blocked',
      priority: 'low',
      position: 1,
      due_date: isoDaysFromToday(10), // neutral
    }),
    task({
      id: 9008,
      title: 'Finalize guest list',
      status: 'done',
      priority: 'medium',
      position: 0,
      due_date: isoDaysFromToday(-30),
    }),
    task({
      id: 9009,
      title: 'Book DJ',
      status: 'done',
      priority: 'high',
      position: 1,
      due_date: null,
      assigned_to: 'Ashley',
    }),
  ]
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ body: JSON.stringify(body), contentType: 'application/json', status })
}

interface TaskApiHandle {
  moveRequests: { id: number; body: { status: TaskStatus; position: number } }[]
  patchRequests: { id: number; body: Partial<Task> }[]
  tasks: Task[]
}

async function installTaskApi(page: Page): Promise<TaskApiHandle> {
  const handle: TaskApiHandle = {
    moveRequests: [],
    patchRequests: [],
    tasks: seedTasks(),
  }

  await page.route(/\/api\/tasks\/\d+\/move$/, async (route) => {
    const request = route.request()
    const taskId = Number(new URL(request.url()).pathname.match(/\/api\/tasks\/(\d+)\/move$/)?.[1])
    const body = request.postDataJSON() as { status: TaskStatus; position: number }
    handle.moveRequests.push({ id: taskId, body })

    const existing = handle.tasks.find((t) => t.id === taskId)
    if (!existing) {
      await json(route, { detail: 'Task not found' }, 404)
      return
    }

    // Mirror the server's resequence: pull the card out of its old column,
    // insert at the requested index in the destination, renumber both.
    const destination = handle.tasks
      .filter((t) => t.status === body.status && t.id !== taskId)
      .sort((a, b) => a.position - b.position)
    const clamped = Math.min(Math.max(body.position, 0), destination.length)
    destination.splice(clamped, 0, existing)
    destination.forEach((t, index) => {
      t.status = body.status
      t.position = index
    })
    await json(route, existing)
  })

  await page.route(/\/api\/tasks(?:\/\d+)?(?:\?.*)?$/, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method()
    const detailMatch = url.pathname.match(/\/api\/tasks\/(\d+)$/)

    if (url.pathname.endsWith('/api/tasks') && method === 'GET') {
      await json(route, handle.tasks)
      return
    }

    if (url.pathname.endsWith('/api/tasks') && method === 'POST') {
      const payload = request.postDataJSON() as Partial<Task>
      const created = task({
        id: 9100 + handle.tasks.length,
        title: 'New task',
        ...payload,
      } as Partial<Task> & { id: number; title: string })
      handle.tasks.push(created)
      await json(route, created, 201)
      return
    }

    if (detailMatch && method === 'PATCH') {
      const taskId = Number(detailMatch[1])
      const payload = request.postDataJSON() as Partial<Task>
      handle.patchRequests.push({ id: taskId, body: payload })
      const existing = handle.tasks.find((t) => t.id === taskId)
      if (!existing) {
        await json(route, { detail: 'Task not found' }, 404)
        return
      }
      Object.assign(existing, payload)
      await json(route, existing)
      return
    }

    if (detailMatch && method === 'DELETE') {
      const taskId = Number(detailMatch[1])
      handle.tasks = handle.tasks.filter((t) => t.id !== taskId)
      await json(route, { status: 'deleted', id: taskId })
      return
    }

    await json(route, { detail: 'Not found' }, 404)
  })

  return handle
}

let apiHandle: TaskApiHandle

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

  apiHandle = await installTaskApi(page)
})

test.afterEach(async ({ page }) => {
  const browserErrors = getBrowserErrors(page)
  const unexpectedErrors = filterIgnorableErrors(browserErrors, [])
  expect(unexpectedErrors).toEqual([])
})

function mainRegion(page: Page) {
  return page.getByRole('main')
}

function formDialog(page: Page) {
  return page.getByRole('dialog')
}

function column(page: Page, label: string) {
  return mainRegion(page).getByLabel(`${label} column`)
}

function dragHandle(page: Page, title: string) {
  return page.getByRole('button', { name: `Reorder ${title}`, exact: false })
}

test('keyboard DnD moves a card between columns and persists', async ({ page }) => {
  await page.goto('/admin/timeline')
  await expect(column(page, 'Not started').getByText('Choose flowers')).toBeVisible()

  const handle = dragHandle(page, 'Choose flowers')
  await handle.focus()
  await page.keyboard.press('Space') // lift
  await page.keyboard.press('ArrowRight') // hop toward the next column
  await page.keyboard.press('Space') // drop

  await expect
    .poll(() => apiHandle.moveRequests.map((request) => request.id))
    .toContain(9003)

  const move = apiHandle.moveRequests.find((request) => request.id === 9003)
  expect(move?.body.status).toBe('in_progress')

  // Persisted: reload (the mocked GET now reflects the moved card) and the
  // card should still be listed under its new column.
  await page.reload()
  await expect(column(page, 'In progress').getByText('Choose flowers')).toBeVisible()
  await expect(column(page, 'Not started').getByText('Choose flowers')).not.toBeVisible()
})

test('keyboard DnD reorders within a column', async ({ page }) => {
  await page.goto('/admin/timeline')

  const handle = dragHandle(page, 'Confirm catering')
  await handle.focus()
  await page.keyboard.press('Space')
  await page.keyboard.press('ArrowUp') // step above "Order invitations"
  await page.keyboard.press('Space')

  await expect.poll(() => apiHandle.moveRequests.map((request) => request.id)).toContain(9002)
  const move = apiHandle.moveRequests.find((request) => request.id === 9002)
  expect(move?.body.status).toBe('not_started')
  expect(move?.body.position).toBe(0)
})

test('inline priority change fires a PATCH without opening the dialog', async ({ page }) => {
  await page.goto('/admin/timeline')

  await column(page, 'Blocked')
    .getByRole('combobox', { name: 'Priority for Pick wedding cake' })
    .click()
  await page.getByRole('option', { name: 'High' }).click()

  await expect.poll(() => apiHandle.patchRequests.map((request) => request.id)).toContain(9007)
  const patch = apiHandle.patchRequests.find((request) => request.id === 9007)
  expect(patch?.body.priority).toBe('high')
  await expect(formDialog(page)).not.toBeVisible()
})

test('per-column add task pre-selects that column status', async ({ page }) => {
  await page.goto('/admin/timeline')

  await column(page, 'Blocked').getByRole('button', { name: 'Add task' }).click()
  await expect(formDialog(page).getByRole('heading', { name: 'Add Task' })).toBeVisible()
  await expect(formDialog(page).getByLabel('Status')).toHaveText('Blocked')
})

test('search filters cards by title and disables drag', async ({ page }) => {
  await page.goto('/admin/timeline')

  await mainRegion(page).getByLabel('Search tasks').fill('cake')

  await expect(column(page, 'Blocked').getByText('Pick wedding cake')).toBeVisible()
  await expect(column(page, 'Not started').getByText('Order invitations')).not.toBeVisible()
  await expect(mainRegion(page).getByText(/Drag is off while filtering/)).toBeVisible()
})

test('priority filter chips narrow the board and counts reflect it', async ({ page }) => {
  await page.goto('/admin/timeline')

  await mainRegion(page).getByRole('button', { name: 'High', exact: true }).click()

  await expect(column(page, 'Not started').getByText('Choose flowers')).toBeVisible()
  await expect(column(page, 'Not started').getByText('Confirm catering')).not.toBeVisible()
  // "1 of 3": the Not started column has 3 tasks total, 1 of them High.
  await expect(column(page, 'Not started').getByLabel('1 tasks')).toHaveText('1 of 3')
})

test('due-date chips render overdue red and due-soon amber', async ({ page }) => {
  await page.goto('/admin/timeline')

  const overdueChip = column(page, 'Not started').getByText(/Overdue/)
  await expect(overdueChip).toBeVisible()

  const dueSoonChip = column(page, 'In progress')
    .locator('[data-testid="task-card-9004"]')
    .getByLabel(/^Due /)
  await expect(dueSoonChip).toBeVisible()
  await expect(dueSoonChip).not.toContainText('Overdue')
})

test('the ← → move buttons work as the accessible/mobile fallback', async ({ page }) => {
  await page.goto('/admin/timeline')

  await expect(column(page, 'Blocked').getByText('Send save-the-dates')).toBeVisible()

  await mainRegion(page)
    .getByRole('button', { name: 'Move Send save-the-dates to next column' })
    .click()

  await expect.poll(() => apiHandle.moveRequests.map((request) => request.id)).toContain(9006)
  const move = apiHandle.moveRequests.find((request) => request.id === 9006)
  expect(move?.body.status).toBe('done')

  await expect(column(page, 'Done').getByText('Send save-the-dates')).toBeVisible()
  await expect(column(page, 'Blocked').getByText('Send save-the-dates')).not.toBeVisible()
})

test('the drag hint is dismissable and stays dismissed', async ({ page }) => {
  await page.goto('/admin/timeline')

  const hint = page.getByRole('note', { name: 'Drag and drop hint' })
  await expect(hint).toBeVisible()
  await hint.getByRole('button', { name: 'Dismiss drag and drop hint' }).click()
  await expect(hint).not.toBeVisible()

  await page.reload()
  await expect(page.getByRole('note', { name: 'Drag and drop hint' })).not.toBeVisible()
})
