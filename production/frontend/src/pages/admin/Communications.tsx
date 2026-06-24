import { useMemo, useState, type FormEvent } from 'react'

import { AdminLayout } from '@/components/AdminLayout'
import { Alert } from '@/components/ui/alert'
import { Badge, type BadgeProps } from '@/components/ui/badge'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  CommunicationApiError,
  useCommunications,
  useCreateCommunication,
  useDeleteCommunication,
  useSendCommunication,
  useUpdateCommunication,
  type Communication,
  type CommunicationAudience,
  type CommunicationChannel,
  type CommunicationPayload,
  type CommunicationStatus,
} from '@/hooks/useCommunications'

type DialogMode = 'create' | 'edit'
type StatusFilter = 'all' | CommunicationStatus

const CHANNEL_OPTIONS: { value: CommunicationChannel; label: string }[] = [
  { value: 'email', label: 'Email' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'sms', label: 'SMS' },
  { value: 'announcement', label: 'Announcement' },
]

const AUDIENCE_OPTIONS: { value: CommunicationAudience; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'attending', label: 'Attending' },
  { value: 'pending', label: 'Pending' },
  { value: 'declined', label: 'Declined' },
]

const STATUS_OPTIONS: { value: CommunicationStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'sent', label: 'Sent' },
]

const CHANNEL_LABELS: Record<CommunicationChannel, string> = {
  email: 'Email',
  whatsapp: 'WhatsApp',
  sms: 'SMS',
  announcement: 'Announcement',
}

const AUDIENCE_LABELS: Record<CommunicationAudience, string> = {
  all: 'All',
  attending: 'Attending',
  pending: 'Pending',
  declined: 'Declined',
}

const STATUS_VARIANT: Record<CommunicationStatus, BadgeProps['variant']> = {
  draft: 'neutral',
  scheduled: 'warning',
  sent: 'success',
}

const STATUS_LABELS: Record<CommunicationStatus, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  sent: 'Sent',
}

interface CommunicationFormState {
  subject: string
  body: string
  channel: CommunicationChannel
  audience: CommunicationAudience
  status: CommunicationStatus
  scheduled_for: string
}

function emptyFormState(): CommunicationFormState {
  return {
    subject: '',
    body: '',
    channel: 'email',
    audience: 'all',
    status: 'draft',
    scheduled_for: '',
  }
}

function formStateFromCommunication(message: Communication): CommunicationFormState {
  return {
    subject: message.subject,
    body: message.body ?? '',
    channel: message.channel,
    audience: message.audience,
    status: message.status,
    scheduled_for: message.scheduled_for ?? '',
  }
}

function optionalText(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function validate(form: CommunicationFormState): string | null {
  if (!form.subject.trim()) {
    return 'Subject is required.'
  }
  if (form.status === 'scheduled' && !form.scheduled_for.trim()) {
    return 'Scheduled date is required for scheduled messages.'
  }
  return null
}

function buildPayload(form: CommunicationFormState): CommunicationPayload {
  return {
    subject: form.subject.trim(),
    body: optionalText(form.body),
    channel: form.channel,
    audience: form.audience,
    status: form.status,
    scheduled_for: optionalText(form.scheduled_for),
  }
}

function displayValue(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '-'
  }
  return value
}

export function Communications() {
  const { data: communications, isLoading, isError, error } = useCommunications()

  const createMutation = useCreateCommunication()
  const updateMutation = useUpdateCommunication()
  const deleteMutation = useDeleteCommunication()
  const sendMutation = useSendCommunication()

  const [dialogMode, setDialogMode] = useState<DialogMode | null>(null)
  const [editingMessage, setEditingMessage] = useState<Communication | null>(null)
  const [form, setForm] = useState<CommunicationFormState>(emptyFormState)
  const [formError, setFormError] = useState<string | null>(null)

  const [messageToDelete, setMessageToDelete] = useState<Communication | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [feedback, setFeedback] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const messageList = communications ?? []

  const filteredMessages = useMemo(() => {
    if (statusFilter === 'all') {
      return messageList
    }
    return messageList.filter((message) => message.status === statusFilter)
  }, [messageList, statusFilter])

  const messageCount = filteredMessages.length

  const isSaving = createMutation.isPending || updateMutation.isPending

  const dialogTitle = useMemo(
    () => (dialogMode === 'edit' ? 'Edit Message' : 'Add Message'),
    [dialogMode],
  )

  const updateField = <K extends keyof CommunicationFormState>(
    key: K,
    value: CommunicationFormState[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const openCreateDialog = () => {
    setFeedback(null)
    setActionError(null)
    setFormError(null)
    setEditingMessage(null)
    setForm(emptyFormState())
    setDialogMode('create')
  }

  const openEditDialog = (message: Communication) => {
    setFeedback(null)
    setActionError(null)
    setFormError(null)
    setEditingMessage(message)
    setForm(formStateFromCommunication(message))
    setDialogMode('edit')
  }

  const closeDialog = () => {
    setDialogMode(null)
    setEditingMessage(null)
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
      if (dialogMode === 'edit' && editingMessage) {
        await updateMutation.mutateAsync({ id: editingMessage.id, payload })
        setFeedback('Message updated successfully.')
      } else {
        await createMutation.mutateAsync(payload)
        setFeedback('Message created successfully.')
      }
      closeDialog()
    } catch (err) {
      const fallback =
        dialogMode === 'edit' ? 'Failed to update message' : 'Failed to create message'
      setFormError(err instanceof CommunicationApiError ? err.message : fallback)
    }
  }

  const requestDelete = (message: Communication) => {
    setFeedback(null)
    setActionError(null)
    setDeleteError(null)
    setMessageToDelete(message)
  }

  const cancelDelete = () => {
    setMessageToDelete(null)
    setDeleteError(null)
  }

  const confirmDelete = async () => {
    if (!messageToDelete) {
      return
    }

    try {
      await deleteMutation.mutateAsync(messageToDelete.id)
      setFeedback('Message deleted successfully.')
      setMessageToDelete(null)
    } catch (err) {
      setDeleteError(
        err instanceof CommunicationApiError ? err.message : 'Failed to delete message',
      )
    }
  }

  const handleSend = async (message: Communication) => {
    setFeedback(null)
    setActionError(null)

    try {
      await sendMutation.mutateAsync(message.id)
      setFeedback('Message marked as sent.')
    } catch (err) {
      setActionError(
        err instanceof CommunicationApiError ? err.message : 'Failed to send message',
      )
    }
  }

  return (
    <AdminLayout
      title="Communications"
      breadcrumb={[{ label: 'Dashboard', href: '/admin' }, { label: 'Communications' }]}
    >
      <div className="grid gap-4">
        <section className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 m-0">Messages</h2>
            <p className="text-sm text-gray-600 m-0 mt-1">{messageCount} messages</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="grid gap-1">
              <Label htmlFor="status-filter" className="sr-only">
                Filter by status
              </Label>
              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as StatusFilter)}
              >
                <SelectTrigger id="status-filter" aria-label="Filter by status" className="w-40">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="button" onClick={openCreateDialog}>
              Add Message
            </Button>
          </div>
        </section>

        {feedback && (
          <Alert variant="success" role="status" aria-live="polite">
            {feedback}
          </Alert>
        )}

        {actionError && <Alert variant="destructive">{actionError}</Alert>}

        {isLoading && (
          <div
            role="status"
            className="text-sm text-gray-600 border border-gray-200 rounded-md p-4"
          >
            Loading communications...
          </div>
        )}

        {isError && !isLoading && (
          <Alert variant="destructive">
            {error instanceof Error ? error.message : 'Failed to load communications'}
          </Alert>
        )}

        {!isLoading && !isError && messageCount === 0 && (
          <div className="text-sm text-gray-600 border border-gray-200 rounded-md p-4">
            No messages found.
          </div>
        )}

        {!isLoading && !isError && messageCount > 0 && (
          <div className="rounded-md border border-gray-200">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Audience</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Scheduled / Sent</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMessages.map((message) => (
                  <TableRow key={message.id}>
                    <TableCell className="font-medium text-gray-900">{message.subject}</TableCell>
                    <TableCell>
                      <Badge variant="info">{CHANNEL_LABELS[message.channel]}</Badge>
                    </TableCell>
                    <TableCell>{AUDIENCE_LABELS[message.audience]}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[message.status]}>
                        {STATUS_LABELS[message.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {displayValue(message.sent_at ?? message.scheduled_for)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {message.status !== 'sent' && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            aria-label={`Mark ${message.subject} as sent`}
                            disabled={sendMutation.isPending}
                            onClick={() => void handleSend(message)}
                          >
                            Mark sent
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          aria-label={`Edit ${message.subject}`}
                          onClick={() => openEditDialog(message)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          aria-label={`Delete ${message.subject}`}
                          onClick={() => requestDelete(message)}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={dialogMode !== null} onOpenChange={(open) => (!open ? closeDialog() : undefined)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>
              {dialogMode === 'edit'
                ? 'Update the message details and save your changes.'
                : 'Compose a message to send to your guests.'}
            </DialogDescription>
          </DialogHeader>

          <form noValidate onSubmit={handleSubmit} className="grid gap-4">
            {formError && <Alert variant="destructive">{formError}</Alert>}

            <div className="grid gap-2">
              <Label htmlFor="comm-subject">Subject</Label>
              <Input
                id="comm-subject"
                value={form.subject}
                onChange={(event) => updateField('subject', event.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="comm-body">Body</Label>
              <Input
                id="comm-body"
                value={form.body}
                onChange={(event) => updateField('body', event.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="comm-channel">Channel</Label>
                <Select
                  value={form.channel}
                  onValueChange={(value) => updateField('channel', value as CommunicationChannel)}
                >
                  <SelectTrigger id="comm-channel" aria-label="Channel">
                    <SelectValue placeholder="Select channel" />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANNEL_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="comm-audience">Audience</Label>
                <Select
                  value={form.audience}
                  onValueChange={(value) =>
                    updateField('audience', value as CommunicationAudience)
                  }
                >
                  <SelectTrigger id="comm-audience" aria-label="Audience">
                    <SelectValue placeholder="Select audience" />
                  </SelectTrigger>
                  <SelectContent>
                    {AUDIENCE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="comm-status">Status</Label>
              <Select
                value={form.status}
                onValueChange={(value) => updateField('status', value as CommunicationStatus)}
              >
                <SelectTrigger id="comm-status" aria-label="Status">
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
              <Label htmlFor="comm-scheduled">Scheduled for</Label>
              <Input
                id="comm-scheduled"
                type="datetime-local"
                value={form.scheduled_for}
                onChange={(event) => updateField('scheduled_for', event.target.value)}
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
                    ? 'Save Message'
                    : 'Add Message'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog
        open={messageToDelete !== null}
        onOpenChange={(open) => (!open ? cancelDelete() : undefined)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Message</DialogTitle>
            <DialogDescription>
              {messageToDelete
                ? `Delete ${messageToDelete.subject}? This action cannot be undone.`
                : 'Delete this message?'}
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
