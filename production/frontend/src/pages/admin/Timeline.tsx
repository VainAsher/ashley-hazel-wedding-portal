import { useMemo, useState, type FormEvent } from 'react'

import { AdminLayout } from '@/components/AdminLayout'
import { Alert } from '@/components/ui/alert'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  TaskApiError,
  useCreateTask,
  useDeleteTask,
  useTasks,
  useUpdateTask,
  type Task,
  type TaskPayload,
  type TaskPriority,
  type TaskStatus,
} from '@/hooks/useTasks'

const STATUS_COLUMNS: { value: TaskStatus; label: string }[] = [
  { value: 'not_started', label: 'Not started' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'done', label: 'Done' },
]

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'not_started', label: 'Not started' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'done', label: 'Done' },
]

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
]

const PRIORITY_VARIANT: Record<TaskPriority, BadgeProps['variant']> = {
  low: 'neutral',
  medium: 'info',
  high: 'danger',
}

type DialogMode = 'create' | 'edit'

interface TaskFormState {
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  due_date: string
  assigned_to: string
}

function emptyFormState(): TaskFormState {
  return {
    title: '',
    description: '',
    status: 'not_started',
    priority: 'medium',
    due_date: '',
    assigned_to: '',
  }
}

function formStateFromTask(task: Task): TaskFormState {
  return {
    title: task.title,
    description: task.description ?? '',
    status: task.status,
    priority: task.priority,
    due_date: task.due_date ?? '',
    assigned_to: task.assigned_to ?? '',
  }
}

function optionalText(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function validate(form: TaskFormState): string | null {
  if (!form.title.trim()) {
    return 'Task title is required.'
  }
  return null
}

function buildPayload(form: TaskFormState): TaskPayload {
  return {
    title: form.title.trim(),
    description: optionalText(form.description),
    status: form.status,
    priority: form.priority,
    due_date: optionalText(form.due_date),
    assigned_to: optionalText(form.assigned_to),
  }
}

function priorityLabel(priority: TaskPriority): string {
  return PRIORITY_OPTIONS.find((option) => option.value === priority)?.label ?? priority
}

function sortByDueDate(a: Task, b: Task): number {
  if (!a.due_date && !b.due_date) {
    return 0
  }
  if (!a.due_date) {
    return 1
  }
  if (!b.due_date) {
    return -1
  }
  return a.due_date.localeCompare(b.due_date)
}

export function Timeline() {
  const { data: tasks, isLoading, isError, error } = useTasks()
  const createMutation = useCreateTask()
  const updateMutation = useUpdateTask()
  const deleteMutation = useDeleteTask()

  const [dialogMode, setDialogMode] = useState<DialogMode | null>(null)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [form, setForm] = useState<TaskFormState>(emptyFormState)
  const [formError, setFormError] = useState<string | null>(null)

  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [feedback, setFeedback] = useState<string | null>(null)

  const taskList = tasks ?? []
  const taskCount = taskList.length

  const isSaving = createMutation.isPending || updateMutation.isPending

  const dialogTitle = useMemo(
    () => (dialogMode === 'edit' ? 'Edit Task' : 'Add Task'),
    [dialogMode],
  )

  const columns = useMemo(() => {
    return STATUS_COLUMNS.map((column) => ({
      ...column,
      tasks: taskList
        .filter((task) => task.status === column.value)
        .sort(sortByDueDate),
    }))
  }, [taskList])

  const updateField = <K extends keyof TaskFormState>(key: K, value: TaskFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const openCreateDialog = () => {
    setFeedback(null)
    setFormError(null)
    setEditingTask(null)
    setForm(emptyFormState())
    setDialogMode('create')
  }

  const openEditDialog = (task: Task) => {
    setFeedback(null)
    setFormError(null)
    setEditingTask(task)
    setForm(formStateFromTask(task))
    setDialogMode('edit')
  }

  const closeDialog = () => {
    setDialogMode(null)
    setEditingTask(null)
    setFormError(null)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)

    const validationError = validate(form)
    if (validationError) {
      setFormError(validationError)
      return
    }

    const payload = buildPayload(form)

    try {
      if (dialogMode === 'edit' && editingTask) {
        await updateMutation.mutateAsync({ id: editingTask.id, payload })
        setFeedback('Task updated successfully.')
      } else {
        await createMutation.mutateAsync(payload)
        setFeedback('Task added successfully.')
      }
      closeDialog()
    } catch (err) {
      const fallback = dialogMode === 'edit' ? 'Failed to update task' : 'Failed to add task'
      setFormError(err instanceof TaskApiError ? err.message : fallback)
    }
  }

  const requestDelete = (task: Task) => {
    setFeedback(null)
    setDeleteError(null)
    setTaskToDelete(task)
  }

  const cancelDelete = () => {
    setTaskToDelete(null)
    setDeleteError(null)
  }

  const confirmDelete = async () => {
    if (!taskToDelete) {
      return
    }

    try {
      await deleteMutation.mutateAsync(taskToDelete.id)
      setFeedback('Task deleted successfully.')
      setTaskToDelete(null)
    } catch (err) {
      setDeleteError(err instanceof TaskApiError ? err.message : 'Failed to delete task')
    }
  }

  return (
    <AdminLayout
      title="Timeline"
      breadcrumb={[{ label: 'Dashboard', href: '/admin' }, { label: 'Timeline' }]}
    >
      <div className="grid grid-cols-1 gap-4">
        <section className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 m-0">Task board</h2>
            <p className="text-sm text-gray-600 m-0 mt-1">{taskCount} tasks</p>
          </div>
          <Button type="button" onClick={openCreateDialog}>
            Add Task
          </Button>
        </section>

        {feedback && (
          <Alert variant="success" role="status" aria-live="polite">
            {feedback}
          </Alert>
        )}

        {isLoading && (
          <div
            role="status"
            className="text-sm text-gray-600 border border-gray-200 rounded-md p-4"
          >
            Loading tasks...
          </div>
        )}

        {isError && !isLoading && (
          <Alert variant="destructive">
            {error instanceof Error ? error.message : 'Failed to load tasks'}
          </Alert>
        )}

        {!isLoading && !isError && taskCount === 0 && (
          <div className="text-sm text-gray-600 border border-gray-200 rounded-md p-4">
            No tasks found.
          </div>
        )}

        {!isLoading && !isError && taskCount > 0 && (
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {columns.map((column) => (
              <div
                key={column.value}
                className="flex flex-col gap-3"
                aria-label={`${column.label} column`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900 m-0">{column.label}</h3>
                  <Badge variant="neutral" aria-label={`${column.tasks.length} tasks`}>
                    {column.tasks.length}
                  </Badge>
                </div>

                <div className="grid gap-3">
                  {column.tasks.length === 0 ? (
                    <p className="text-sm text-gray-500 m-0 border border-dashed border-gray-200 rounded-md p-3">
                      No tasks.
                    </p>
                  ) : (
                    column.tasks.map((task) => (
                      <Card key={task.id}>
                        <CardContent className="p-3 grid gap-2">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-medium text-gray-900 m-0">{task.title}</p>
                            <Badge variant={PRIORITY_VARIANT[task.priority]}>
                              {priorityLabel(task.priority)}
                            </Badge>
                          </div>

                          {task.description && (
                            <p className="text-sm text-gray-600 m-0">{task.description}</p>
                          )}

                          <p className="text-xs text-gray-500 m-0">
                            Due: {task.due_date ?? 'No due date'}
                          </p>

                          {task.assigned_to && (
                            <p className="text-xs text-gray-500 m-0">
                              Assigned to: {task.assigned_to}
                            </p>
                          )}

                          <div className="flex flex-wrap gap-2 pt-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              aria-label={`Edit ${task.title}`}
                              onClick={() => openEditDialog(task)}
                            >
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              aria-label={`Delete ${task.title}`}
                              onClick={() => requestDelete(task)}
                            >
                              Delete
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            ))}
          </section>
        )}
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={dialogMode !== null} onOpenChange={(open) => (!open ? closeDialog() : undefined)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>
              {dialogMode === 'edit'
                ? 'Update the task details and save your changes.'
                : 'Enter the task details to add it to the planning board.'}
            </DialogDescription>
          </DialogHeader>

          <form noValidate onSubmit={handleSubmit} className="grid gap-4">
            {formError && <Alert variant="destructive">{formError}</Alert>}

            <div className="grid gap-2">
              <Label htmlFor="task-title">Title</Label>
              <Input
                id="task-title"
                value={form.title}
                onChange={(event) => updateField('title', event.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="task-description">Description</Label>
              <Input
                id="task-description"
                value={form.description}
                onChange={(event) => updateField('description', event.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="task-status">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(value) => updateField('status', value as TaskStatus)}
                >
                  <SelectTrigger id="task-status" aria-label="Status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="task-priority">Priority</Label>
                <Select
                  value={form.priority}
                  onValueChange={(value) => updateField('priority', value as TaskPriority)}
                >
                  <SelectTrigger id="task-priority" aria-label="Priority">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="task-due-date">Due date</Label>
              <Input
                id="task-due-date"
                type="date"
                value={form.due_date}
                onChange={(event) => updateField('due_date', event.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="task-assigned-to">Assigned to</Label>
              <Input
                id="task-assigned-to"
                value={form.assigned_to}
                onChange={(event) => updateField('assigned_to', event.target.value)}
              />
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={closeDialog} disabled={isSaving}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving
                  ? dialogMode === 'edit'
                    ? 'Saving...'
                    : 'Adding...'
                  : dialogMode === 'edit'
                    ? 'Save Task'
                    : 'Add Task'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={taskToDelete !== null} onOpenChange={(open) => (!open ? cancelDelete() : undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Task</DialogTitle>
            <DialogDescription>
              {taskToDelete
                ? `Delete ${taskToDelete.title}? This action cannot be undone.`
                : 'Delete this task?'}
            </DialogDescription>
          </DialogHeader>

          {deleteError && <Alert variant="destructive">{deleteError}</Alert>}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={cancelDelete}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void confirmDelete()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}
