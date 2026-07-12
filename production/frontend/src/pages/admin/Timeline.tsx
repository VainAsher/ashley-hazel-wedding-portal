import { useState, type FormEvent } from 'react'

import { AdminLayout } from '@/components/AdminLayout'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
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
import { TaskBoard } from '@/components/taskboard/TaskBoard'
import { BOARD_COLUMNS, PRIORITY_OPTIONS } from '@/components/taskboard/constants'
import {
  TaskApiError,
  useCreateTask,
  useDeleteTask,
  useMoveTask,
  useTasks,
  useUpdateTask,
  type Task,
  type TaskPayload,
  type TaskPriority,
  type TaskStatus,
} from '@/hooks/useTasks'

type DialogMode = 'create' | 'edit'

interface TaskFormState {
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  due_date: string
  assigned_to: string
}

function emptyFormState(status: TaskStatus = 'not_started'): TaskFormState {
  return {
    title: '',
    description: '',
    status,
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
    // The admin Timeline always writes the wedding board (Kanban V2 /
    // docs/specs/KANBAN_V2.md) — explicit rather than relying on the
    // server's default, now that party boards (D2) also share this payload
    // shape and must set their own context.
    context: 'wedding',
  }
}

function payloadFromTask(task: Task, overrides: Partial<TaskPayload> = {}): TaskPayload {
  return {
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    due_date: task.due_date,
    assigned_to: task.assigned_to,
    ...overrides,
  }
}

/**
 * Kanban V2 (docs/specs/KANBAN_V2.md): this page is now a thin shell — all
 * board rendering + drag & drop lives in <TaskBoard>, extracted so the same
 * component can later power Stag & Hen planning (Wave 3 item 14 D2). The
 * admin Timeline always feeds it the 'wedding' context.
 */
export function Timeline() {
  const { data: tasks, isLoading, isError, error } = useTasks()
  const createMutation = useCreateTask()
  const updateMutation = useUpdateTask()
  const deleteMutation = useDeleteTask()
  const moveMutation = useMoveTask()

  const [dialogMode, setDialogMode] = useState<DialogMode | null>(null)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [form, setForm] = useState<TaskFormState>(() => emptyFormState())
  const [formError, setFormError] = useState<string | null>(null)

  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [feedback, setFeedback] = useState<string | null>(null)
  const [boardError, setBoardError] = useState<string | null>(null)

  const taskList = tasks ?? []
  const taskCount = taskList.length

  const isSaving = createMutation.isPending || updateMutation.isPending

  const dialogTitle = dialogMode === 'edit' ? 'Edit Task' : 'Add Task'

  const updateField = <K extends keyof TaskFormState>(key: K, value: TaskFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const openCreateDialog = (status: TaskStatus = 'not_started') => {
    setFeedback(null)
    setFormError(null)
    setEditingTask(null)
    setForm(emptyFormState(status))
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

  const handleMove = (taskId: number, target: { status: TaskStatus; position: number }) => {
    setBoardError(null)
    moveMutation.mutate(
      { id: taskId, payload: target },
      {
        onError: (err) => {
          setBoardError(err instanceof TaskApiError ? err.message : 'Failed to move task')
        },
      },
    )
  }

  const handlePriorityChange = (task: Task, priority: TaskPriority) => {
    setBoardError(null)
    updateMutation.mutate(
      { id: task.id, payload: payloadFromTask(task, { priority }) },
      {
        onError: (err) => {
          setBoardError(err instanceof TaskApiError ? err.message : 'Failed to update priority')
        },
      },
    )
  }

  const handleAssigneeChange = (task: Task, assignee: string | null) => {
    setBoardError(null)
    updateMutation.mutate(
      { id: task.id, payload: payloadFromTask(task, { assigned_to: assignee }) },
      {
        onError: (err) => {
          setBoardError(err instanceof TaskApiError ? err.message : 'Failed to update assignee')
        },
      },
    )
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
          <Button type="button" onClick={() => openCreateDialog()}>
            Add Task
          </Button>
        </section>

        {feedback && (
          <Alert variant="success" role="status" aria-live="polite">
            {feedback}
          </Alert>
        )}

        {boardError && <Alert variant="destructive">{boardError}</Alert>}

        {!isLoading && !isError && taskCount === 0 && (
          <div className="text-sm text-gray-600 border border-gray-200 rounded-md p-4">
            No tasks found.
          </div>
        )}

        {(isLoading || isError || taskCount > 0) && (
          <TaskBoard
            tasks={taskList}
            isLoading={isLoading}
            isError={isError}
            errorMessage={error instanceof Error ? error.message : 'Failed to load tasks'}
            onCreateTask={openCreateDialog}
            onEditTask={openEditDialog}
            onDeleteTask={requestDelete}
            onMove={handleMove}
            onPriorityChange={handlePriorityChange}
            onAssigneeChange={handleAssigneeChange}
          />
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
                    {BOARD_COLUMNS.map((option) => (
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
