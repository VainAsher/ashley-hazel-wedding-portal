import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useParams } from 'react-router-dom'

import { GuestLayout } from '@/components/GuestLayout'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { usePageTitle } from '@/hooks/usePageTitle'
import {
  PartyApiError,
  useCreatePartyMessage,
  useModeratePartyMessage,
  usePartySummary,
  useSetPartyReveal,
  useUpdatePartyInfo,
  type PartyMessage,
  type PartyName,
} from '@/hooks/useParty'
import {
  TaskApiError,
  useCreateTask,
  useDeleteTask,
  useMoveTask,
  useTasks,
  useUpdateTask,
  type Task,
  type TaskContext,
  type TaskPayload,
  type TaskPriority,
  type TaskStatus,
} from '@/hooks/useTasks'

const PARTY_TITLE: Record<PartyName, string> = {
  stag: 'Stag Do',
  hen: 'Hen Do',
}

function formatDate(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// ---------------------------------------------------------------------------
// Planning board (Wave 3 item 14 D2): mounts the same <TaskBoard> that
// powers the admin Timeline (docs/specs/KANBAN_V2.md), scoped to this
// party's own context ('stag' | 'hen') rather than 'wedding'. The
// create/edit/delete/move/priority/assignee wiring below mirrors
// pages/admin/Timeline.tsx exactly — see that file for the pattern this
// replicates. Every party member (not just the Best Man/Maid of Honour) can
// manage the board: it's a shared planning tool for the group, and the
// backend's `has_party_access` rule (same one gating the message board)
// already scopes it to this party's members.
// ---------------------------------------------------------------------------

type TaskDialogMode = 'create' | 'edit'

interface TaskFormState {
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  due_date: string
  assigned_to: string
}

function emptyTaskFormState(status: TaskStatus = 'not_started'): TaskFormState {
  return {
    title: '',
    description: '',
    status,
    priority: 'medium',
    due_date: '',
    assigned_to: '',
  }
}

function taskFormStateFromTask(task: Task): TaskFormState {
  return {
    title: task.title,
    description: task.description ?? '',
    status: task.status,
    priority: task.priority,
    due_date: task.due_date ?? '',
    assigned_to: task.assigned_to ?? '',
  }
}

function optionalTaskText(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function validateTaskForm(form: TaskFormState): string | null {
  if (!form.title.trim()) {
    return 'Task title is required.'
  }
  return null
}

function buildTaskPayload(form: TaskFormState, context: TaskContext): TaskPayload {
  return {
    title: form.title.trim(),
    description: optionalTaskText(form.description),
    status: form.status,
    priority: form.priority,
    due_date: optionalTaskText(form.due_date),
    assigned_to: optionalTaskText(form.assigned_to),
    // Without this, the server defaults new tasks to 'wedding' context
    // regardless of which board created them — wrong for a party board, and
    // (post D2 authorization rewrite) rejected outright for a party member
    // with no coordinator role.
    context,
  }
}

function taskPayloadFromTask(task: Task, overrides: Partial<TaskPayload> = {}): TaskPayload {
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

function PlanningBoard({ party }: { party: PartyName }) {
  const context = party as TaskContext
  const { data: tasks, isLoading, isError, error } = useTasks(context)
  const createMutation = useCreateTask(context)
  const updateMutation = useUpdateTask(context)
  const deleteMutation = useDeleteTask(context)
  const moveMutation = useMoveTask(context)

  const [dialogMode, setDialogMode] = useState<TaskDialogMode | null>(null)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [form, setForm] = useState<TaskFormState>(() => emptyTaskFormState())
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
    setForm(emptyTaskFormState(status))
    setDialogMode('create')
  }

  const openEditDialog = (task: Task) => {
    setFeedback(null)
    setFormError(null)
    setEditingTask(task)
    setForm(taskFormStateFromTask(task))
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

    const validationError = validateTaskForm(form)
    if (validationError) {
      setFormError(validationError)
      return
    }

    const payload = buildTaskPayload(form, context)

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
      { id: task.id, payload: taskPayloadFromTask(task, { priority }) },
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
      { id: task.id, payload: taskPayloadFromTask(task, { assigned_to: assignee }) },
      {
        onError: (err) => {
          setBoardError(err instanceof TaskApiError ? err.message : 'Failed to update assignee')
        },
      },
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Planning board</CardTitle>
            <CardDescription>{taskCount} tasks</CardDescription>
          </div>
          <Button type="button" onClick={() => openCreateDialog()}>
            Add Task
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        {feedback && (
          <Alert variant="success" role="status" aria-live="polite">
            {feedback}
          </Alert>
        )}

        {boardError && <Alert variant="destructive">{boardError}</Alert>}

        {!isLoading && !isError && taskCount === 0 && (
          <div className="text-sm text-gray-600 border border-gray-200 rounded-md p-4">
            No tasks yet — add one below to start planning.
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
      </CardContent>

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

          <form noValidate onSubmit={(e) => void handleSubmit(e)} className="grid gap-4">
            {formError && <Alert variant="destructive">{formError}</Alert>}

            <div className="grid gap-2">
              <Label htmlFor={`party-task-title-${party}`}>Title</Label>
              <Input
                id={`party-task-title-${party}`}
                value={form.title}
                onChange={(event) => updateField('title', event.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor={`party-task-description-${party}`}>Description</Label>
              <Input
                id={`party-task-description-${party}`}
                value={form.description}
                onChange={(event) => updateField('description', event.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor={`party-task-status-${party}`}>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(value) => updateField('status', value as TaskStatus)}
                >
                  <SelectTrigger id={`party-task-status-${party}`} aria-label="Status">
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
                <Label htmlFor={`party-task-priority-${party}`}>Priority</Label>
                <Select
                  value={form.priority}
                  onValueChange={(value) => updateField('priority', value as TaskPriority)}
                >
                  <SelectTrigger id={`party-task-priority-${party}`} aria-label="Priority">
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
              <Label htmlFor={`party-task-due-date-${party}`}>Due date</Label>
              <Input
                id={`party-task-due-date-${party}`}
                type="date"
                value={form.due_date}
                onChange={(event) => updateField('due_date', event.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor={`party-task-assigned-to-${party}`}>Assigned to</Label>
              <Input
                id={`party-task-assigned-to-${party}`}
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
    </Card>
  )
}

function RevealBanner({ party }: { party: PartyName }) {
  const { data: summary } = usePartySummary(party)
  const revealMutation = useSetPartyReveal(party)
  const [error, setError] = useState<string | null>(null)

  const banner = summary?.reveal_banner
  if (!banner) {
    return null
  }

  const toggle = async () => {
    setError(null)
    try {
      await revealMutation.mutateAsync({
        inviteId: banner.subject_invite_id,
        revealed: !banner.revealed,
      })
    } catch (err) {
      setError(err instanceof PartyApiError ? err.message : 'Unable to update the reveal.')
    }
  }

  return (
    <Card className="border-gold/60 bg-gold/5">
      <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
        <p className="m-0 text-sm text-gray-700">
          {banner.revealed
            ? `${banner.subject_name} can now see this ${PARTY_TITLE[party]}.`
            : `${banner.subject_name} hasn't seen this yet — reveal it to them?`}
        </p>
        <div className="flex items-center gap-3">
          {error && <Alert variant="destructive">{error}</Alert>}
          <Button
            type="button"
            variant={banner.revealed ? 'outline' : 'default'}
            size="sm"
            disabled={revealMutation.isPending}
            onClick={() => void toggle()}
          >
            {revealMutation.isPending
              ? 'Saving...'
              : banner.revealed
                ? 'Hide again'
                : 'Reveal it to them'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function DetailsCard({ party, isPartyAdmin }: { party: PartyName; isPartyAdmin: boolean }) {
  const { data: summary } = usePartySummary(party)
  const updateMutation = useUpdatePartyInfo(party)
  const [editing, setEditing] = useState(false)
  const [details, setDetails] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setDetails(summary?.info.details ?? '')
  }, [summary?.info.details])

  const save = async () => {
    setError(null)
    try {
      await updateMutation.mutateAsync(details.trim() || null)
      setEditing(false)
    } catch (err) {
      setError(err instanceof PartyApiError ? err.message : 'Unable to save details.')
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>{PARTY_TITLE[party]} Details</CardTitle>
          <CardDescription>The plan so far.</CardDescription>
        </div>
        {isPartyAdmin && !editing && (
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {error && <Alert variant="destructive">{error}</Alert>}
        {editing ? (
          <div className="grid gap-3">
            <Label htmlFor="party-details-textarea" className="sr-only">
              Party details
            </Label>
            <textarea
              id="party-details-textarea"
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              rows={4}
              placeholder="Date, venue, the plan..."
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-base resize-vertical"
            />
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                disabled={updateMutation.isPending}
                onClick={() => void save()}
              >
                {updateMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : summary?.info.details ? (
          <p className="text-sm text-gray-700 m-0 whitespace-pre-wrap">{summary.info.details}</p>
        ) : (
          <p className="text-sm text-gray-500 m-0 italic">No details yet.</p>
        )}
      </CardContent>
    </Card>
  )
}

function MembersCard({ party }: { party: PartyName }) {
  const { data: summary } = usePartySummary(party)
  const members = summary?.members ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Who&apos;s in</CardTitle>
      </CardHeader>
      <CardContent>
        {members.length === 0 ? (
          <p className="text-sm text-gray-500 m-0 italic">No one flagged in yet.</p>
        ) : (
          <ul className="m-0 grid gap-2 pl-0" style={{ listStyle: 'none' }}>
            {members.map((member) => (
              <li key={member.invite_id} className="flex items-center gap-2 text-sm">
                <span className="text-gray-900">{member.name}</span>
                {member.party_admin && (
                  <Badge variant="success">{member.party_title || 'Party Admin'}</Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function MessageRow({
  message,
  isPartyAdmin,
  onModerate,
  moderating,
}: {
  message: PartyMessage
  isPartyAdmin: boolean
  onModerate: (message: PartyMessage, patch: { hidden?: boolean; pinned?: boolean }) => void
  moderating: boolean
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            {message.author_name}
            {message.pinned && <Badge variant="success">Pinned</Badge>}
            {message.hidden && <Badge variant="warning">Hidden</Badge>}
          </CardTitle>
          <CardDescription>{formatDate(message.created_at)}</CardDescription>
        </div>
        {isPartyAdmin && (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={moderating}
              aria-label={`${message.pinned ? 'Unpin' : 'Pin'} message from ${message.author_name}`}
              onClick={() => onModerate(message, { pinned: !message.pinned })}
            >
              {message.pinned ? 'Unpin' : 'Pin'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={moderating}
              aria-label={`${message.hidden ? 'Unhide' : 'Hide'} message from ${message.author_name}`}
              onClick={() => onModerate(message, { hidden: !message.hidden })}
            >
              {message.hidden ? 'Unhide' : 'Hide'}
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-700 m-0 whitespace-pre-wrap">{message.message}</p>
      </CardContent>
    </Card>
  )
}

function MessageBoard({ party, isPartyAdmin }: { party: PartyName; isPartyAdmin: boolean }) {
  const { data: summary, isLoading, isError, error } = usePartySummary(party)
  const createMutation = useCreatePartyMessage(party)
  const moderateMutation = useModeratePartyMessage(party)

  const [message, setMessage] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const messages = summary?.messages ?? []

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitError(null)

    const trimmed = message.trim()
    if (!trimmed) {
      setSubmitError('Please write something before posting.')
      return
    }

    try {
      await createMutation.mutateAsync(trimmed)
      setMessage('')
    } catch (err) {
      setSubmitError(err instanceof PartyApiError ? err.message : 'Unable to post your message.')
    }
  }

  const handleModerate = async (
    target: PartyMessage,
    patch: { hidden?: boolean; pinned?: boolean },
  ) => {
    setActionError(null)
    try {
      await moderateMutation.mutateAsync({ messageId: target.id, payload: patch })
    } catch (err) {
      setActionError(err instanceof PartyApiError ? err.message : 'Unable to update this message.')
    }
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Message board</CardTitle>
        </CardHeader>
        <CardContent>
          <form noValidate onSubmit={(e) => void handleSubmit(e)} className="grid gap-3">
            {submitError && <Alert variant="destructive">{submitError}</Alert>}
            <Label htmlFor="party-message-textarea" className="sr-only">
              Message
            </Label>
            <textarea
              id="party-message-textarea"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Say something to the group..."
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-base resize-vertical"
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Posting...' : 'Post message'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {actionError && <Alert variant="destructive">{actionError}</Alert>}

      {isLoading && (
        <div role="status" className="text-sm text-gray-600 border border-gray-200 rounded-md p-4">
          Loading messages...
        </div>
      )}

      {isError && !isLoading && (
        <Alert variant="destructive">
          {error instanceof Error ? error.message : 'Unable to load messages.'}
        </Alert>
      )}

      {!isLoading && !isError && messages.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center text-sm text-gray-600">
            No messages yet — be the first to say something.
          </CardContent>
        </Card>
      )}

      {!isLoading &&
        !isError &&
        messages.map((item) => (
          <MessageRow
            key={item.id}
            message={item}
            isPartyAdmin={isPartyAdmin}
            onModerate={(target, patch) => void handleModerate(target, patch)}
            moderating={moderateMutation.isPending}
          />
        ))}
    </div>
  )
}

export function Party() {
  const params = useParams<{ party: string }>()
  const party = params.party === 'stag' || params.party === 'hen' ? params.party : null

  usePageTitle(party ? PARTY_TITLE[party] : 'Party')

  const { data: summary, isLoading, isError, error } = usePartySummary(party ?? 'stag')

  if (!party) {
    return <Navigate replace to="/dashboard" />
  }

  return (
    <GuestLayout>
      <div className="max-w-3xl mx-auto w-full grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{PARTY_TITLE[party]}</CardTitle>
            <CardDescription>A private space, just for the {PARTY_TITLE[party]} crew.</CardDescription>
          </CardHeader>
        </Card>

        {isLoading && (
          <div role="status" className="text-sm text-gray-600 border border-gray-200 rounded-md p-4">
            Loading...
          </div>
        )}

        {isError && !isLoading && (
          <Alert variant="destructive">
            {error instanceof Error ? error.message : 'Unable to load this party.'}
          </Alert>
        )}

        {!isLoading && !isError && summary && (
          <>
            <RevealBanner party={party} />
            <DetailsCard party={party} isPartyAdmin={summary.is_party_admin} />
            <MembersCard party={party} />
            <PlanningBoard party={party} />
            <MessageBoard party={party} isPartyAdmin={summary.is_party_admin} />
          </>
        )}
      </div>
    </GuestLayout>
  )
}
