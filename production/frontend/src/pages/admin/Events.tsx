import { useMemo, useState, type FormEvent } from 'react'

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  EventsApiError,
  useCreateEvent,
  useDeleteEvent,
  useEvents,
  useUpdateEvent,
  type WeddingEvent,
  type WeddingEventPayload,
} from '@/hooks/useEvents'

type DialogMode = 'create' | 'edit'

interface EventFormState {
  wedding_id: string
  event_name: string
  event_date: string
  event_time: string
  location: string
  description: string
}

function emptyFormState(): EventFormState {
  return {
    wedding_id: '1',
    event_name: '',
    event_date: '',
    event_time: '',
    location: '',
    description: '',
  }
}

function formStateFromEvent(event: WeddingEvent): EventFormState {
  return {
    wedding_id: String(event.wedding_id),
    event_name: event.event_name,
    event_date: event.event_date ?? '',
    event_time: event.event_time ?? '',
    location: event.location ?? '',
    description: event.description ?? '',
  }
}

function optionalText(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function validate(form: EventFormState): string | null {
  if (!Number(form.wedding_id) || Number(form.wedding_id) < 1) {
    return 'Wedding ID is required.'
  }
  if (!form.event_name.trim()) {
    return 'Event name is required.'
  }
  return null
}

function buildPayload(form: EventFormState): WeddingEventPayload {
  return {
    wedding_id: Number(form.wedding_id),
    event_name: form.event_name.trim(),
    event_date: optionalText(form.event_date),
    event_time: optionalText(form.event_time),
    location: optionalText(form.location),
    description: optionalText(form.description),
  }
}

function displayValue(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '-'
  }
  return value
}

export function Events() {
  const { data: events, isLoading, isError, error } = useEvents()

  const createMutation = useCreateEvent()
  const updateMutation = useUpdateEvent()
  const deleteMutation = useDeleteEvent()

  const [dialogMode, setDialogMode] = useState<DialogMode | null>(null)
  const [editingEvent, setEditingEvent] = useState<WeddingEvent | null>(null)
  const [form, setForm] = useState<EventFormState>(emptyFormState)
  const [formError, setFormError] = useState<string | null>(null)

  const [eventToDelete, setEventToDelete] = useState<WeddingEvent | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [feedback, setFeedback] = useState<string | null>(null)

  const eventList = useMemo(() => {
    const list = events ?? []
    return [...list].sort((a, b) => {
      const dateA = a.event_date ?? ''
      const dateB = b.event_date ?? ''
      if (dateA === dateB) {
        return (a.event_time ?? '').localeCompare(b.event_time ?? '')
      }
      if (dateA === '') {
        return 1
      }
      if (dateB === '') {
        return -1
      }
      return dateA.localeCompare(dateB)
    })
  }, [events])
  const eventCount = eventList.length

  const isSaving = createMutation.isPending || updateMutation.isPending

  const dialogTitle = useMemo(
    () => (dialogMode === 'edit' ? 'Edit Event' : 'Add Event'),
    [dialogMode],
  )

  const updateField = <K extends keyof EventFormState>(key: K, value: EventFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const openCreateDialog = () => {
    setFeedback(null)
    setFormError(null)
    setEditingEvent(null)
    setForm(emptyFormState())
    setDialogMode('create')
  }

  const openEditDialog = (event: WeddingEvent) => {
    setFeedback(null)
    setFormError(null)
    setEditingEvent(event)
    setForm(formStateFromEvent(event))
    setDialogMode('edit')
  }

  const closeDialog = () => {
    setDialogMode(null)
    setEditingEvent(null)
    setFormError(null)
  }

  const handleSubmit = async (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault()
    setFormError(null)

    const validationError = validate(form)
    if (validationError) {
      setFormError(validationError)
      return
    }

    const payload = buildPayload(form)

    try {
      if (dialogMode === 'edit' && editingEvent) {
        await updateMutation.mutateAsync({ id: editingEvent.id, payload })
        setFeedback('Event updated successfully.')
      } else {
        await createMutation.mutateAsync(payload)
        setFeedback('Event added successfully.')
      }
      closeDialog()
    } catch (err) {
      const fallback = dialogMode === 'edit' ? 'Failed to update event' : 'Failed to add event'
      setFormError(err instanceof EventsApiError ? err.message : fallback)
    }
  }

  const requestDelete = (event: WeddingEvent) => {
    setFeedback(null)
    setDeleteError(null)
    setEventToDelete(event)
  }

  const cancelDelete = () => {
    setEventToDelete(null)
    setDeleteError(null)
  }

  const confirmDelete = async () => {
    if (!eventToDelete) {
      return
    }

    try {
      await deleteMutation.mutateAsync(eventToDelete.id)
      setFeedback('Event deleted successfully.')
      setEventToDelete(null)
    } catch (err) {
      setDeleteError(err instanceof EventsApiError ? err.message : 'Failed to delete event')
    }
  }

  return (
    <AdminLayout
      title="Events"
      breadcrumb={[{ label: 'Dashboard', href: '/admin' }, { label: 'Events' }]}
    >
      <div className="grid gap-4">
        <section className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 m-0">Events</h2>
            <p className="text-sm text-gray-600 m-0 mt-1">{eventCount} events</p>
          </div>
          <Button type="button" onClick={openCreateDialog}>
            Add Event
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
            Loading events...
          </div>
        )}

        {isError && !isLoading && (
          <Alert variant="destructive">
            {error instanceof Error ? error.message : 'Failed to load events'}
          </Alert>
        )}

        {!isLoading && !isError && eventCount === 0 && (
          <div className="text-sm text-gray-600 border border-gray-200 rounded-md p-4">
            No events found.
          </div>
        )}

        {!isLoading && !isError && eventCount > 0 && (
          <div className="rounded-md border border-gray-200">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event Name</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {eventList.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="font-medium text-gray-900">{event.event_name}</TableCell>
                    <TableCell>{displayValue(event.event_date)}</TableCell>
                    <TableCell>{displayValue(event.event_time)}</TableCell>
                    <TableCell>{displayValue(event.location)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          aria-label={`Edit ${event.event_name}`}
                          onClick={() => openEditDialog(event)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          aria-label={`Delete ${event.event_name}`}
                          onClick={() => requestDelete(event)}
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
                ? 'Update the event details and save your changes.'
                : 'Enter the event details to add it to the schedule.'}
            </DialogDescription>
          </DialogHeader>

          <form noValidate onSubmit={handleSubmit} className="grid gap-4">
            {formError && <Alert variant="destructive">{formError}</Alert>}

            <div className="grid gap-2">
              <Label htmlFor="event-wedding-id">Wedding ID</Label>
              <Input
                id="event-wedding-id"
                type="number"
                min={1}
                value={form.wedding_id}
                onChange={(changeEvent) => updateField('wedding_id', changeEvent.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="event-name">Event Name</Label>
              <Input
                id="event-name"
                value={form.event_name}
                onChange={(changeEvent) => updateField('event_name', changeEvent.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="event-date">Date</Label>
                <Input
                  id="event-date"
                  type="date"
                  value={form.event_date}
                  onChange={(changeEvent) => updateField('event_date', changeEvent.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="event-time">Time</Label>
                <Input
                  id="event-time"
                  type="time"
                  value={form.event_time}
                  onChange={(changeEvent) => updateField('event_time', changeEvent.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="event-location">Location</Label>
              <Input
                id="event-location"
                value={form.location}
                onChange={(changeEvent) => updateField('location', changeEvent.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="event-description">Description</Label>
              <Input
                id="event-description"
                value={form.description}
                onChange={(changeEvent) => updateField('description', changeEvent.target.value)}
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
                    ? 'Save Event'
                    : 'Add Event'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={eventToDelete !== null} onOpenChange={(open) => (!open ? cancelDelete() : undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Event</DialogTitle>
            <DialogDescription>
              {eventToDelete
                ? `Delete ${eventToDelete.event_name}? This action cannot be undone.`
                : 'Delete this event?'}
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
