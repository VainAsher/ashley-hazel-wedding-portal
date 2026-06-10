import { useRef, useState } from 'react'

import { GuestForm } from '../components/GuestForm'
import { GuestList, type Guest, type GuestListHandle } from '../components/GuestList'

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
    <main style={pageStyle}>
      <section style={headerStyle}>
        <div>
          <h1 style={titleStyle}>Guest Management</h1>
          <p style={metaStyle}>{guestCount} guests</p>
        </div>

        <button
          onClick={handleAddGuest}
          style={formMode === 'create' ? secondaryButtonStyle : primaryButtonStyle}
          type="button"
        >
          {formMode === 'create' ? 'Cancel' : 'Add Guest'}
        </button>
      </section>

      {feedback && (
        <div aria-live="polite" role="status" style={successStyle}>
          {feedback}
        </div>
      )}
      {actionError && (
        <div role="alert" style={errorStyle}>
          {actionError}
        </div>
      )}

      {formMode && (
        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>{formMode === 'edit' ? 'Edit Guest' : 'Add Guest'}</h2>
          <GuestForm
            guest={selectedGuest}
            mode={formMode === 'edit' ? 'edit' : 'create'}
            onCancel={handleCancelForm}
            onSuccess={handleGuestSaved}
          />
        </section>
      )}

      {selectedGuest && formMode !== 'edit' && (
        <section aria-labelledby="guest-details-title" style={detailsStyle}>
          <div style={detailsHeaderStyle}>
            <h2 id="guest-details-title" style={sectionTitleStyle}>
              Guest Details
            </h2>
            <button
              onClick={() => handleEditGuest(selectedGuest)}
              style={secondaryButtonStyle}
              type="button"
            >
              Edit Guest
            </button>
          </div>
          <dl style={detailGridStyle}>
            <div>
              <dt style={detailLabelStyle}>Name</dt>
              <dd style={detailValueStyle}>{selectedGuest.name}</dd>
            </div>
            <div>
              <dt style={detailLabelStyle}>Email</dt>
              <dd style={detailValueStyle}>{formatValue(selectedGuest.email)}</dd>
            </div>
            <div>
              <dt style={detailLabelStyle}>Phone</dt>
              <dd style={detailValueStyle}>{formatValue(selectedGuest.phone)}</dd>
            </div>
            <div>
              <dt style={detailLabelStyle}>Relationship</dt>
              <dd style={detailValueStyle}>{formatValue(selectedGuest.relationship)}</dd>
            </div>
            <div>
              <dt style={detailLabelStyle}>RSVP</dt>
              <dd style={detailValueStyle}>{selectedGuest.rsvp_status}</dd>
            </div>
            <div>
              <dt style={detailLabelStyle}>Table</dt>
              <dd style={detailValueStyle}>{formatValue(selectedGuest.table_number)}</dd>
            </div>
            <div>
              <dt style={detailLabelStyle}>Seat</dt>
              <dd style={detailValueStyle}>{formatValue(selectedGuest.seat_number)}</dd>
            </div>
            <div>
              <dt style={detailLabelStyle}>Notes</dt>
              <dd style={detailValueStyle}>{formatValue(selectedGuest.notes)}</dd>
            </div>
          </dl>
        </section>
      )}

      <section style={sectionStyle}>
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
}

const pageStyle = {
  display: 'grid',
  gap: '18px',
  padding: '20px',
}

const headerStyle = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap' as const,
  gap: '14px',
  justifyContent: 'space-between',
}

const titleStyle = {
  color: '#1f2933',
  fontSize: '28px',
  lineHeight: 1.2,
  margin: 0,
}

const metaStyle = {
  color: '#586272',
  fontSize: '14px',
  margin: '4px 0 0',
}

const sectionStyle = {
  minWidth: 0,
}

const sectionTitleStyle = {
  color: '#1f2933',
  fontSize: '20px',
  lineHeight: 1.25,
  margin: '0 0 12px',
}

const primaryButtonStyle = {
  background: '#1f6f5b',
  border: '1px solid #1f6f5b',
  borderRadius: '4px',
  color: '#fff',
  cursor: 'pointer',
  font: 'inherit',
  fontWeight: 700,
  padding: '10px 14px',
  whiteSpace: 'nowrap' as const,
}

const secondaryButtonStyle = {
  ...primaryButtonStyle,
  background: '#fff',
  color: '#1f6f5b',
}

const successStyle = {
  background: '#edf8f3',
  border: '1px solid #3c8f72',
  borderRadius: '4px',
  color: '#1f6f5b',
  padding: '10px 12px',
}

const errorStyle = {
  background: '#fff5f5',
  border: '1px solid #d64545',
  borderRadius: '4px',
  color: '#9f1d1d',
  padding: '10px 12px',
}

const detailsStyle = {
  border: '1px solid #d6d9df',
  borderRadius: '6px',
  padding: '16px',
}

const detailsHeaderStyle = {
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap' as const,
  gap: '12px',
  justifyContent: 'space-between',
}

const detailGridStyle = {
  display: 'grid',
  gap: '12px',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  margin: 0,
}

const detailLabelStyle = {
  color: '#586272',
  fontSize: '12px',
  fontWeight: 700,
  margin: 0,
  textTransform: 'uppercase' as const,
}

const detailValueStyle = {
  color: '#1f2933',
  margin: '4px 0 0',
}
