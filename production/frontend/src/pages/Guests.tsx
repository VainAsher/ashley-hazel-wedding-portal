import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import {
  GuestApiError,
  useCreateGuest,
  useDeleteGuest,
  useGuests,
  useUpdateGuest,
  type Guest,
  type GuestPayload,
  type MealChoice,
  type RsvpStatus,
} from '@/hooks/useGuests'
import { downloadCsv, guestCsvFilename, guestsToCsv } from '@/lib/guestCsv'

const RSVP_OPTIONS: { value: RsvpStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'declined', label: 'Declined' },
  { value: 'tentative', label: 'Tentative' },
]

const MEAL_OPTIONS: { value: MealChoice; label: string }[] = [
  { value: 'chicken', label: 'Chicken' },
  { value: 'fish', label: 'Fish' },
  { value: 'vegetarian', label: 'Vegetarian' },
]

type StatusFilter = 'all' | RsvpStatus

const STATUS_FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  ...RSVP_OPTIONS,
]

const NONE_VALUE = '__none__'

type DialogMode = 'create' | 'edit'

interface GuestFormState {
  wedding_id: string
  name: string
  email: string
  phone: string
  address: string
  relationship: string
  rsvp_status: RsvpStatus
  // May hold a guest-picked menu option name, not just the legacy values.
  meal_choice: string
  dietary_restrictions: string
  plus_one_name: string
  plus_one_rsvp: '' | RsvpStatus
  plus_one_dietary: string
  table_number: string
  seat_number: string
  notes: string
}

function emptyFormState(): GuestFormState {
  return {
    wedding_id: '1',
    name: '',
    email: '',
    phone: '',
    address: '',
    relationship: '',
    rsvp_status: 'pending',
    meal_choice: '',
    dietary_restrictions: '',
    plus_one_name: '',
    plus_one_rsvp: '',
    plus_one_dietary: '',
    table_number: '',
    seat_number: '',
    notes: '',
  }
}

function formStateFromGuest(guest: Guest): GuestFormState {
  return {
    wedding_id: String(guest.wedding_id),
    name: guest.name,
    email: guest.email ?? '',
    phone: guest.phone ?? '',
    address: guest.address ?? '',
    relationship: guest.relationship ?? '',
    rsvp_status: guest.rsvp_status,
    meal_choice: guest.meal_choice ?? '',
    dietary_restrictions: guest.dietary_restrictions ?? '',
    plus_one_name: guest.plus_one_name ?? '',
    plus_one_rsvp: guest.plus_one_rsvp ?? '',
    plus_one_dietary: guest.plus_one_dietary ?? '',
    table_number: guest.table_number === null ? '' : String(guest.table_number),
    seat_number: guest.seat_number === null ? '' : String(guest.seat_number),
    notes: guest.notes ?? '',
  }
}

function optionalText(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function optionalNumber(value: string): number | null {
  if (value.trim() === '') {
    return null
  }
  return Number(value)
}

function validate(form: GuestFormState): string | null {
  if (!Number(form.wedding_id) || Number(form.wedding_id) < 1) {
    return 'Wedding ID is required.'
  }
  if (!form.name.trim()) {
    return 'Guest name is required.'
  }
  if (form.email.trim() && !form.email.includes('@')) {
    return 'Email must contain @.'
  }
  if (form.table_number.trim() && Number(form.table_number) < 1) {
    return 'Table number must be 1 or greater.'
  }
  if (form.seat_number.trim() && Number(form.seat_number) < 1) {
    return 'Seat number must be 1 or greater.'
  }
  return null
}

function buildPayload(form: GuestFormState): GuestPayload {
  return {
    wedding_id: Number(form.wedding_id),
    name: form.name.trim(),
    email: optionalText(form.email),
    phone: optionalText(form.phone),
    address: optionalText(form.address),
    relationship: optionalText(form.relationship),
    rsvp_status: form.rsvp_status,
    meal_choice: form.meal_choice || null,
    dietary_restrictions: optionalText(form.dietary_restrictions),
    plus_one_name: optionalText(form.plus_one_name),
    plus_one_rsvp: form.plus_one_rsvp || null,
    plus_one_dietary: optionalText(form.plus_one_dietary),
    table_number: optionalNumber(form.table_number),
    seat_number: optionalNumber(form.seat_number),
    notes: optionalText(form.notes),
  }
}

function payloadFromGuestWithStatus(guest: Guest, rsvp_status: RsvpStatus): GuestPayload {
  return {
    wedding_id: guest.wedding_id,
    name: guest.name,
    email: guest.email,
    phone: guest.phone,
    address: guest.address,
    relationship: guest.relationship,
    rsvp_status,
    meal_choice: guest.meal_choice,
    dietary_restrictions: guest.dietary_restrictions,
    plus_one_name: guest.plus_one_name,
    plus_one_rsvp: guest.plus_one_rsvp,
    plus_one_dietary: guest.plus_one_dietary,
    table_number: guest.table_number,
    seat_number: guest.seat_number,
    notes: guest.notes,
  }
}

function displayValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '-'
  }
  return String(value)
}

function matchesSearch(guest: Guest, term: string): boolean {
  if (!term) {
    return true
  }
  const haystack = [guest.name, guest.email, guest.phone, guest.relationship]
    .filter((value): value is string => Boolean(value))
    .join(' ')
    .toLowerCase()
  return haystack.includes(term.toLowerCase())
}

function SelectAllCheckbox({
  checked,
  indeterminate,
  onChange,
}: {
  checked: boolean
  indeterminate: boolean
  onChange: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate
    }
  }, [indeterminate])

  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label="Select all guests"
      checked={checked}
      onChange={onChange}
      className="h-4 w-4 rounded border-gray-300 text-plum focus:ring-plum"
    />
  )
}

export function Guests() {
  const { data: guests, isLoading, isError, error } = useGuests()
  const createMutation = useCreateGuest()
  const updateMutation = useUpdateGuest()
  const deleteMutation = useDeleteGuest()

  const [dialogMode, setDialogMode] = useState<DialogMode | null>(null)
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null)
  const [form, setForm] = useState<GuestFormState>(emptyFormState)
  const [formError, setFormError] = useState<string | null>(null)

  const [guestToDelete, setGuestToDelete] = useState<Guest | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [feedback, setFeedback] = useState<string | null>(null)

  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [bulkStatus, setBulkStatus] = useState<RsvpStatus>('accepted')
  const [isBulkUpdating, setIsBulkUpdating] = useState(false)
  const [bulkError, setBulkError] = useState<string | null>(null)

  const guestList = guests ?? []
  const guestCount = guestList.length

  const filteredGuests = useMemo(
    () =>
      guestList.filter(
        (guest) =>
          matchesSearch(guest, searchTerm) &&
          (statusFilter === 'all' || guest.rsvp_status === statusFilter),
      ),
    [guestList, searchTerm, statusFilter],
  )
  const isFiltered = searchTerm.trim() !== '' || statusFilter !== 'all'

  // A stale selection (e.g. "select all" from a previous search) silently
  // bulk-editing guests the couple can no longer see would be surprising, so
  // any filter change clears it.
  useEffect(() => {
    setSelectedIds(new Set())
  }, [searchTerm, statusFilter])

  const isSaving = createMutation.isPending || updateMutation.isPending

  const dialogTitle = useMemo(
    () => (dialogMode === 'edit' ? 'Edit Guest' : 'Add Guest'),
    [dialogMode],
  )

  const updateField = <K extends keyof GuestFormState>(key: K, value: GuestFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const openCreateDialog = () => {
    setFeedback(null)
    setFormError(null)
    setEditingGuest(null)
    setForm(emptyFormState())
    setDialogMode('create')
  }

  const openEditDialog = (guest: Guest) => {
    setFeedback(null)
    setFormError(null)
    setEditingGuest(guest)
    setForm(formStateFromGuest(guest))
    setDialogMode('edit')
  }

  const closeDialog = () => {
    setDialogMode(null)
    setEditingGuest(null)
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
      if (dialogMode === 'edit' && editingGuest) {
        await updateMutation.mutateAsync({ id: editingGuest.id, payload })
        setFeedback('Guest updated successfully.')
      } else {
        await createMutation.mutateAsync(payload)
        setFeedback('Guest added successfully.')
      }
      closeDialog()
    } catch (err) {
      const fallback = dialogMode === 'edit' ? 'Failed to update guest' : 'Failed to add guest'
      setFormError(err instanceof GuestApiError ? err.message : fallback)
    }
  }

  const requestDelete = (guest: Guest) => {
    setFeedback(null)
    setDeleteError(null)
    setGuestToDelete(guest)
  }

  const cancelDelete = () => {
    setGuestToDelete(null)
    setDeleteError(null)
  }

  const exportGuest = (guest: Guest) => {
    downloadCsv(guestCsvFilename(guest), guestsToCsv([guest]))
  }

  const exportAllGuests = () => {
    downloadCsv('guests.csv', guestsToCsv(guestList))
  }

  const confirmDelete = async () => {
    if (!guestToDelete) {
      return
    }

    try {
      await deleteMutation.mutateAsync(guestToDelete.id)
      setFeedback('Guest deleted successfully.')
      setGuestToDelete(null)
    } catch (err) {
      setDeleteError(err instanceof GuestApiError ? err.message : 'Failed to delete guest')
    }
  }

  const toggleSelectGuest = (id: number) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const allVisibleSelected =
    filteredGuests.length > 0 && filteredGuests.every((guest) => selectedIds.has(guest.id))
  const someVisibleSelected = filteredGuests.some((guest) => selectedIds.has(guest.id))

  const toggleSelectAll = () => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (allVisibleSelected) {
        filteredGuests.forEach((guest) => next.delete(guest.id))
      } else {
        filteredGuests.forEach((guest) => next.add(guest.id))
      }
      return next
    })
  }

  const applyBulkStatus = async () => {
    const targets = guestList.filter((guest) => selectedIds.has(guest.id))
    if (targets.length === 0) {
      return
    }

    setBulkError(null)
    setIsBulkUpdating(true)
    try {
      for (const guest of targets) {
        await updateMutation.mutateAsync({
          id: guest.id,
          payload: payloadFromGuestWithStatus(guest, bulkStatus),
        })
      }
      setFeedback(
        `Updated RSVP status for ${targets.length} guest${targets.length === 1 ? '' : 's'}.`,
      )
      setSelectedIds(new Set())
    } catch (err) {
      setBulkError(err instanceof GuestApiError ? err.message : 'Failed to update some guests.')
    } finally {
      setIsBulkUpdating(false)
    }
  }

  return (
    <AdminLayout title="Guest Management" breadcrumb={[{ label: 'Admin', href: '/admin' }, { label: 'Guests' }]}>
      <div className="grid grid-cols-1 gap-4">
        <section className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 m-0">Guests</h2>
            <p className="text-sm text-gray-600 m-0 mt-1">{guestCount} guests</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={exportAllGuests}
              disabled={guestCount === 0}
            >
              Export all guests (CSV)
            </Button>
            <Button type="button" onClick={openCreateDialog}>
              Add Guest
            </Button>
          </div>
        </section>

        <section className="flex flex-wrap items-center gap-3">
          <div className="min-w-[220px] flex-1">
            <Label htmlFor="guest-search" className="sr-only">
              Search guests
            </Label>
            <Input
              id="guest-search"
              type="search"
              placeholder="Search by name, email, phone, or relationship"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="guest-status-filter" className="sr-only">
              Filter by RSVP status
            </Label>
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as StatusFilter)}
            >
              <SelectTrigger id="guest-status-filter" aria-label="Filter by RSVP status" className="w-48">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isFiltered && (
            <p className="text-sm text-gray-600 m-0">
              {filteredGuests.length} of {guestCount} shown
            </p>
          )}
        </section>

        {feedback && (
          <Alert variant="success" role="status" aria-live="polite">
            {feedback}
          </Alert>
        )}

        {isLoading && (
          <div role="status" className="text-sm text-gray-600 border border-gray-200 rounded-md p-4">
            Loading guests...
          </div>
        )}

        {isError && !isLoading && (
          <Alert variant="destructive">
            {error instanceof Error ? error.message : 'Failed to load guests'}
          </Alert>
        )}

        {!isLoading && !isError && guestCount === 0 && (
          <div className="text-sm text-gray-600 border border-gray-200 rounded-md p-4">
            No guests found.
          </div>
        )}

        {!isLoading && !isError && guestCount > 0 && filteredGuests.length === 0 && (
          <div className="text-sm text-gray-600 border border-gray-200 rounded-md p-4">
            No guests match your search or filter.
          </div>
        )}

        {someVisibleSelected && (
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-plum/20 bg-plum/5 px-4 py-3">
            <p className="text-sm font-medium text-gray-900 m-0">{selectedIds.size} selected</p>
            <div className="flex items-center gap-2">
              <Label htmlFor="bulk-rsvp-status" className="sr-only">
                Set RSVP status
              </Label>
              <Select value={bulkStatus} onValueChange={(value) => setBulkStatus(value as RsvpStatus)}>
                <SelectTrigger id="bulk-rsvp-status" aria-label="Set RSVP status" className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RSVP_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" size="sm" onClick={() => void applyBulkStatus()} disabled={isBulkUpdating}>
                {isBulkUpdating ? 'Updating...' : 'Set RSVP status'}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
                Clear selection
              </Button>
            </div>
            {bulkError && <Alert variant="destructive">{bulkError}</Alert>}
          </div>
        )}

        {!isLoading && !isError && filteredGuests.length > 0 && (
          <div className="rounded-md border border-gray-200">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <SelectAllCheckbox
                      checked={allVisibleSelected}
                      indeterminate={someVisibleSelected && !allVisibleSelected}
                      onChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Relationship</TableHead>
                  <TableHead>RSVP Status</TableHead>
                  <TableHead>Meal</TableHead>
                  <TableHead>Dietary</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGuests.map((guest) => (
                  <TableRow key={guest.id} data-state={selectedIds.has(guest.id) ? 'selected' : undefined}>
                    <TableCell>
                      <input
                        type="checkbox"
                        aria-label={`Select ${guest.name}`}
                        checked={selectedIds.has(guest.id)}
                        onChange={() => toggleSelectGuest(guest.id)}
                        className="h-4 w-4 rounded border-gray-300 text-plum focus:ring-plum"
                      />
                    </TableCell>
                    <TableCell className="font-medium text-gray-900">{guest.name}</TableCell>
                    <TableCell>{displayValue(guest.relationship)}</TableCell>
                    <TableCell>{guest.rsvp_status}</TableCell>
                    <TableCell>{displayValue(guest.meal_choice)}</TableCell>
                    <TableCell>{displayValue(guest.dietary_restrictions)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          aria-label={`Edit ${guest.name}`}
                          onClick={() => openEditDialog(guest)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          aria-label={`Export ${guest.name}`}
                          onClick={() => exportGuest(guest)}
                        >
                          Export
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          aria-label={`Delete ${guest.name}`}
                          onClick={() => requestDelete(guest)}
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
                ? 'Update the guest details and save your changes.'
                : 'Enter the guest details to add them to the wedding.'}
            </DialogDescription>
          </DialogHeader>

          <form noValidate onSubmit={handleSubmit} className="grid gap-5">
            {formError && <Alert variant="destructive">{formError}</Alert>}

            <div className="grid gap-4">
              <h3 className="text-sm font-semibold text-gray-900 m-0">Contact</h3>

              <div className="grid gap-2">
                <Label htmlFor="guest-wedding-id">Wedding ID</Label>
                <Input
                  id="guest-wedding-id"
                  type="number"
                  min={1}
                  value={form.wedding_id}
                  onChange={(event) => updateField('wedding_id', event.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="guest-name">Name</Label>
                <Input
                  id="guest-name"
                  value={form.name}
                  onChange={(event) => updateField('name', event.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="guest-relationship">Relationship</Label>
                <Input
                  id="guest-relationship"
                  placeholder="e.g. Bride's cousin, college friend"
                  value={form.relationship}
                  onChange={(event) => updateField('relationship', event.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="guest-email">Email</Label>
                <Input
                  id="guest-email"
                  type="email"
                  value={form.email}
                  onChange={(event) => updateField('email', event.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="guest-phone">Phone</Label>
                <Input
                  id="guest-phone"
                  type="tel"
                  value={form.phone}
                  onChange={(event) => updateField('phone', event.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="guest-address">Postal address</Label>
                <Input
                  id="guest-address"
                  type="text"
                  value={form.address}
                  onChange={(event) => updateField('address', event.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 border-t border-gray-100 pt-4">
              <h3 className="text-sm font-semibold text-gray-900 m-0">RSVP &amp; meal</h3>

              <div className="grid gap-2">
                <Label htmlFor="guest-rsvp">RSVP Status</Label>
                <Select
                  value={form.rsvp_status}
                  onValueChange={(value) => updateField('rsvp_status', value as RsvpStatus)}
                >
                  <SelectTrigger id="guest-rsvp" aria-label="RSVP Status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {RSVP_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="guest-meal">Meal</Label>
                <Select
                  value={form.meal_choice === '' ? NONE_VALUE : form.meal_choice}
                  onValueChange={(value) =>
                    updateField('meal_choice', value === NONE_VALUE ? '' : (value as MealChoice))
                  }
                >
                  <SelectTrigger id="guest-meal" aria-label="Meal">
                    <SelectValue placeholder="Select meal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>None</SelectItem>
                    {MEAL_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="guest-dietary">Dietary</Label>
                <Input
                  id="guest-dietary"
                  value={form.dietary_restrictions}
                  onChange={(event) => updateField('dietary_restrictions', event.target.value)}
                />
              </div>
            </div>

            <details
              key={dialogMode === 'edit' ? editingGuest?.id : 'new'}
              open={Boolean(form.plus_one_name)}
              className="group rounded-md border border-gray-100"
            >
              <summary className="flex cursor-pointer select-none items-center justify-between px-3 py-2 text-sm font-semibold text-gray-900">
                Plus-one details
                <span aria-hidden="true" className="text-gray-400 transition-transform group-open:rotate-180">
                  ⌄
                </span>
              </summary>
              <div className="grid gap-4 px-3 pb-4 pt-1">
                <div className="grid gap-2">
                  <Label htmlFor="guest-plus-one-name">Plus-one name</Label>
                  <Input
                    id="guest-plus-one-name"
                    value={form.plus_one_name}
                    onChange={(event) => updateField('plus_one_name', event.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="guest-plus-one-rsvp">Plus-one RSVP</Label>
                  <Select
                    value={form.plus_one_rsvp === '' ? NONE_VALUE : form.plus_one_rsvp}
                    onValueChange={(value) =>
                      updateField('plus_one_rsvp', value === NONE_VALUE ? '' : (value as RsvpStatus))
                    }
                  >
                    <SelectTrigger id="guest-plus-one-rsvp" aria-label="Plus-one RSVP">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>None</SelectItem>
                      {RSVP_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="guest-plus-one-dietary">Plus-one dietary</Label>
                  <Input
                    id="guest-plus-one-dietary"
                    value={form.plus_one_dietary}
                    onChange={(event) => updateField('plus_one_dietary', event.target.value)}
                  />
                </div>
              </div>
            </details>

            <div className="grid gap-4 border-t border-gray-100 pt-4">
              <h3 className="text-sm font-semibold text-gray-900 m-0">Seating</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="guest-table">Table</Label>
                  <Input
                    id="guest-table"
                    type="number"
                    min={1}
                    value={form.table_number}
                    onChange={(event) => updateField('table_number', event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="guest-seat">Seat</Label>
                  <Input
                    id="guest-seat"
                    type="number"
                    min={1}
                    value={form.seat_number}
                    onChange={(event) => updateField('seat_number', event.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-2 border-t border-gray-100 pt-4">
              <Label htmlFor="guest-notes">Notes</Label>
              <Textarea
                id="guest-notes"
                placeholder="Anything worth remembering about this guest"
                value={form.notes}
                onChange={(event) => updateField('notes', event.target.value)}
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
                    ? 'Save Guest'
                    : 'Add Guest'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={guestToDelete !== null} onOpenChange={(open) => (!open ? cancelDelete() : undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Guest</DialogTitle>
            <DialogDescription>
              {guestToDelete
                ? `Delete ${guestToDelete.name}? This action cannot be undone.`
                : 'Delete this guest?'}
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
