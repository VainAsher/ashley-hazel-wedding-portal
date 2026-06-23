import { useRef, useState } from 'react'

import { GuestForm } from '../components/GuestForm'
import { GuestList, type Guest, type GuestListHandle } from '../components/GuestList'
import { Button } from '../components/ui/button'
import { Alert } from '../components/ui/alert'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

type FormMode = 'create' | 'edit' | null

function formatValue(value: string | number | null): string {
  if (value === null || value === '') {
    return '-'
  }

  return String(value)
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  const payload = await response.json().catch(() => null)
  if (payload && typeof payload === 'object' && 'detail' in payload) {
    const detail = payload.detail
    if (typeof detail === 'string') {
      return detail
    }
  }

  return fallback
}

export function Guests() {
  const listRef = useRef<GuestListHandle>(null)
  const [formMode, setFormMode] = useState<FormMode>(null)
  const [guestCount, setGuestCount] = useState(0)
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const refreshGuests = () => {
    void listRef.current?.refresh()
  }

  const clearMessages = () => {
    setFeedback(null)
    setActionError(null)
  }

  const handleAddGuest = () => {
    clearMessages()
    setSelectedGuest(null)
    setFormMode((current) => (current === 'create' ? null : 'create'))
  }

  const handleCancelForm = () => {
    clearMessages()
    setFormMode(null)
  }

  const handleSelectGuest = (guest: Guest) => {
    clearMessages()
    setSelectedGuest(guest)
    setFormMode(null)
  }

  const handleEditGuest = (guest: Guest) => {
    clearMessages()
    setSelectedGuest(guest)
    setFormMode('edit')
  }

  const handleGuestSaved = (guest: Guest) => {
    setSelectedGuest(guest)
    setFeedback(formMode === 'edit' ? 'Guest updated successfully.' : 'Guest added successfully.')
    setActionError(null)
    setFormMode(null)
    refreshGuests()
  }

  const handleDeleteGuest = async (guest: Guest) => {
    clearMessages()
    const confirmed = window.confirm(`Delete ${guest.name}?`)
    if (!confirmed) {
      return
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/guests/${guest.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, 'Failed to delete guest'))
      }

      if (selectedGuest?.id === guest.id) {
        setSelectedGuest(null)
      }
      setFeedback('Guest deleted successfully.')
      refreshGuests()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete guest')
    }
  }

  return (
    <main className="grid gap-[18px] p-5">
      <section className="flex flex-wrap items-center gap-3.5 justify-between">
        <div>
          <h1 className="text-[#1f2933] text-2xl leading-tight m-0">Guest Management</h1>
          <p className="text-[#586272] text-sm m-1 mt-1">{guestCount} guests</p>
        </div>

        <Button
          onClick={handleAddGuest}
          variant={formMode === 'create' ? 'outline' : 'default'}
          type="button"
        >
          {formMode === 'create' ? 'Cancel' : 'Add Guest'}
        </Button>
      </section>

      {feedback && (
        <Alert variant="success" aria-live="polite" role="status">
          {feedback}
        </Alert>
      )}
      {actionError && (
        <Alert variant="destructive">
          {actionError}
        </Alert>
      )}

      {formMode && (
        <section className="min-w-0">
          <h2 className="text-[#1f2933] text-xl leading-[1.25] m-0 mb-3">{formMode === 'edit' ? 'Edit Guest' : 'Add Guest'}</h2>
          <GuestForm
            guest={selectedGuest}
            mode={formMode === 'edit' ? 'edit' : 'create'}
            onCancel={handleCancelForm}
            onSuccess={handleGuestSaved}
          />
        </section>
      )}

      {selectedGuest && formMode !== 'edit' && (
        <section aria-labelledby="guest-details-title" className="border border-[#d6d9df] rounded-md p-4">
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <h2 id="guest-details-title" className="text-[#1f2933] text-xl leading-[1.25] m-0 mb-3">
              Guest Details
            </h2>
            <Button
              onClick={() => handleEditGuest(selectedGuest)}
              variant="outline"
              type="button"
            >
              Edit Guest
            </Button>
          </div>
          <dl className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(180px,1fr))] m-0">
            <div>
              <dt className="text-[#586272] text-xs font-bold m-0 uppercase">Name</dt>
              <dd className="text-[#1f2933] m-1 mt-1">{selectedGuest.name}</dd>
            </div>
            <div>
              <dt className="text-[#586272] text-xs font-bold m-0 uppercase">Email</dt>
              <dd className="text-[#1f2933] m-1 mt-1">{formatValue(selectedGuest.email)}</dd>
            </div>
            <div>
              <dt className="text-[#586272] text-xs font-bold m-0 uppercase">Phone</dt>
              <dd className="text-[#1f2933] m-1 mt-1">{formatValue(selectedGuest.phone)}</dd>
            </div>
            <div>
              <dt className="text-[#586272] text-xs font-bold m-0 uppercase">Relationship</dt>
              <dd className="text-[#1f2933] m-1 mt-1">{formatValue(selectedGuest.relationship)}</dd>
            </div>
            <div>
              <dt className="text-[#586272] text-xs font-bold m-0 uppercase">RSVP</dt>
              <dd className="text-[#1f2933] m-1 mt-1">{selectedGuest.rsvp_status}</dd>
            </div>
            <div>
              <dt className="text-[#586272] text-xs font-bold m-0 uppercase">Table</dt>
              <dd className="text-[#1f2933] m-1 mt-1">{formatValue(selectedGuest.table_number)}</dd>
            </div>
            <div>
              <dt className="text-[#586272] text-xs font-bold m-0 uppercase">Seat</dt>
              <dd className="text-[#1f2933] m-1 mt-1">{formatValue(selectedGuest.seat_number)}</dd>
            </div>
            <div>
              <dt className="text-[#586272] text-xs font-bold m-0 uppercase">Notes</dt>
              <dd className="text-[#1f2933] m-1 mt-1">{formatValue(selectedGuest.notes)}</dd>
            </div>
          </dl>
        </section>
      )}

      <section className="min-w-0">
        <GuestList
          ref={listRef}
          onCountChange={setGuestCount}
          onDeleteGuest={(guest) => {
            void handleDeleteGuest(guest)
          }}
          onEditGuest={handleEditGuest}
          onSelectGuest={handleSelectGuest}
          selectedGuestId={selectedGuest?.id}
        />
      </section>
    </main>
  )
