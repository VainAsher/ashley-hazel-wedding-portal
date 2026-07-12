import { expect, test, type Page, type Route } from '@playwright/test'
import { cleanupPageState, initializeErrorTracking, filterIgnorableErrors, getBrowserErrors } from './fixtures/page-cleanup'

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
  position: number | null
  due_date: string | null
  assigned_to: string | null
  category: string | null
}

// Relative to "today" (whenever the suite runs) so the due-soon chip
// assertion below stays valid regardless of when CI executes. Built from
// local date components (not toISOString, which is UTC and can roll the
// calendar day depending on the runner's timezone offset).
function isoDaysFromToday(offsetDays: number): string {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Mirrors src/components/taskboard/dueDate.ts's formatDueDate so the
// assertion doesn't hardcode a date string that drifts out of sync.
function expectedDueChipText(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const initialTask: Task = {
  id: 7001,
  wedding_id: 1,
  title: 'Book the venue',
  description: 'Confirm the ceremony venue',
  status: 'in_progress',
  priority: 'high',
  context: 'wedding',
  position: 0,
  due_date: isoDaysFromToday(3),
  assigned_to: 'Hazel',
  category: null,
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ body: JSON.stringify(body), contentType: 'application/json', status })
}

async function installTaskApi(page: Page) {
  let nextId = 8000
  let tasks = [{ ...initialTask }]

  // The trailing (?:\?.*)? tolerates Kanban V2's `?context=` query param on
  // the list endpoint; `/move` has its own path (not matched here — specs
  // that exercise drag & drop mock it separately).
  await page.route(/\/api\/tasks(?:\/\d+)?(?:\?.*)?$/, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method()
    const detailMatch = url.pathname.match(/\/api\/tasks\/(\d+)$/)

    if (url.pathname.endsWith('/api/tasks') && method === 'GET') {
      await json(route, tasks)
      return
    }

    if (url.pathname.endsWith('/api/tasks') && method === 'POST') {
      const payload = request.postDataJSON() as Partial<Task>
      const task: Task = {
        ...initialTask,
        ...payload,
        id: nextId,
      } as Task
      nextId += 1
      tasks = [...tasks, task]
      await json(route, task, 201)
      return
    }

    if (detailMatch && method === 'PATCH') {
      const taskId = Number(detailMatch[1])
      const payload = request.postDataJSON() as Partial<Task>
      const existing = tasks.find((task) => task.id === taskId)
      if (!existing) {
        await json(route, { detail: 'Task not found' }, 404)
        return
      }
      const updated = { ...existing, ...payload, id: taskId }
      tasks = tasks.map((task) => (task.id === taskId ? updated : task))
      await json(route, updated)
      return
    }

    if (detailMatch && method === 'DELETE') {
      const taskId = Number(detailMatch[1])
      tasks = tasks.filter((task) => task.id !== taskId)
      await json(route, { status: 'deleted', id: taskId })
      return
    }

    await json(route, { detail: 'Not found' }, 404)
  })
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

  await installTaskApi(page)
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

async function selectOption(page: Page, triggerLabel: string, optionName: string) {
  await formDialog(page).getByLabel(triggerLabel).click()
  await page.getByRole('option', { name: optionName }).click()
}

test('renders task count and status columns with grouped task', async ({ page }) => {
  await page.goto('/admin/timeline')

  await expect(mainRegion(page).getByText('1 tasks')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Not started' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'In progress' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Blocked' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Done' })).toBeVisible()

  // Task is grouped under In progress and shows its due-date chip.
  const column = mainRegion(page).getByLabel('In progress column')
  await expect(column.getByText('Book the venue')).toBeVisible()
  await expect(column.getByLabel(`Due ${expectedDueChipText(initialTask.due_date!)}`)).toBeVisible()
})

test('validates required task title before submit', async ({ page }) => {
  await page.goto('/admin/timeline')
  await mainRegion(page).getByRole('button', { name: 'Add Task', exact: true }).click()
  await expect(formDialog(page).getByRole('heading', { name: 'Add Task' })).toBeVisible()

  await formDialog(page).getByRole('button', { name: 'Add Task' }).click()

  await expect(formDialog(page).getByRole('alert')).toHaveText('Task title is required.')
})

test('creates, edits, and deletes a task', async ({ page }) => {
  await page.goto('/admin/timeline')

  // Create
  await mainRegion(page).getByRole('button', { name: 'Add Task', exact: true }).click()
  await formDialog(page).getByLabel('Title').fill('Order flowers')
  await selectOption(page, 'Status', 'Not started')
  await selectOption(page, 'Priority', 'Low')
  await formDialog(page).getByLabel('Due date').fill('2026-03-10')
  await formDialog(page).getByRole('button', { name: 'Add Task' }).click()

  // Scoped by text: dnd-kit mounts its own (empty) #DndLiveRegion with
  // role="status" for screen-reader drag announcements, so a bare
  // getByRole('status') now matches two elements.
  await expect(
    page.getByRole('status').filter({ hasText: 'Task added successfully.' }),
  ).toBeVisible()
  const notStarted = mainRegion(page).getByLabel('Not started column')
  await expect(notStarted.getByText('Order flowers')).toBeVisible()

  // Edit + Delete are tucked behind the card's kebab menu (Kanban V2: keeps
  // cards scannable). Move to Done via the edit dialog.
  await mainRegion(page).getByRole('button', { name: 'More actions for Order flowers' }).click()
  await page.getByRole('menuitem', { name: 'Edit Order flowers' }).click()
  await expect(formDialog(page).getByRole('heading', { name: 'Edit Task' })).toBeVisible()
  await selectOption(page, 'Status', 'Done')
  await formDialog(page).getByRole('button', { name: 'Save Task' }).click()

  await expect(
    page.getByRole('status').filter({ hasText: 'Task updated successfully.' }),
  ).toBeVisible()
  const done = mainRegion(page).getByLabel('Done column')
  await expect(done.getByText('Order flowers')).toBeVisible()

  // Delete
  await mainRegion(page).getByRole('button', { name: 'More actions for Order flowers' }).click()
  await page.getByRole('menuitem', { name: 'Delete Order flowers' }).click()
  await expect(formDialog(page).getByText('Delete Order flowers?')).toBeVisible()
  await formDialog(page).getByRole('button', { name: 'Delete', exact: true }).click()

  await expect(
    page.getByRole('status').filter({ hasText: 'Task deleted successfully.' }),
  ).toBeVisible()
  await expect(mainRegion(page).getByText('Order flowers')).not.toBeVisible()
})

test('shows empty state when there are no tasks', async ({ page }) => {
  await page.goto('/admin/timeline')

  await mainRegion(page).getByRole('button', { name: 'More actions for Book the venue' }).click()
  await page.getByRole('menuitem', { name: 'Delete Book the venue' }).click()
  await formDialog(page).getByRole('button', { name: 'Delete', exact: true }).click()

  await expect(
    page.getByRole('status').filter({ hasText: 'Task deleted successfully.' }),
  ).toBeVisible()
  await expect(mainRegion(page).getByText('No tasks found.')).toBeVisible()
})
