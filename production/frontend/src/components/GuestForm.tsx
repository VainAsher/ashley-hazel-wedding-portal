import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'

import type { Guest } from './GuestList'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

type RsvpStatus = 'pending' | 'accepted' | 'declined' | 'tentative'
type GuestFormMode = 'create' | 'edit'

interface GuestFormProps {
  apiBaseUrl?: string
  defaultWeddingId?: number
  guest?: Guest | null
  mode?: GuestFormMode
  onCancel?: () => void
  onSuccess?: (guest: Guest) => void
}

interface GuestFormState {
  wedding_id: string
  name: string
  email: string
  phone: string
  relationship: string
  rsvp_status: RsvpStatus
  dietary_restrictions: string
  plus_one_name: string
  plus_one_rsvp: '' | RsvpStatus
  plus_one_dietary: string
  table_number: string
  seat_number: string
  notes: string
}

function initialFormState(defaultWeddingId: number): GuestFormState {
  return {
    wedding_id: String(defaultWeddingId),
    name: '',
    email: '',
    phone: '',
    relationship: '',
    rsvp_status: 'pending',
    dietary_restrictions: '',
    plus_one_name: '',
    plus_one_rsvp: '',
    plus_one_dietary: '',
    table_number: '',
    seat_number: '',
    notes: '',
  }
}

function formStateFromGuest(guest: Guest | null | undefined, defaultWeddingId: number) {
  if (!guest) {
    return initialFormState(defaultWeddingId)
  }

  return {
    wedding_id: String(guest.wedding_id),
    name: guest.name,
    email: guest.email ?? '',
    phone: guest.phone ?? '',
    relationship: guest.relationship ?? '',
    rsvp_status: guest.rsvp_status,
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

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === 'string') {
    return payload
  }

  if (!payload || typeof payload !== 'object') {
    return fallback
  }

  const detail = 'detail' in payload ? payload.detail : null
  if (typeof detail === 'string') {
    return detail
  }

  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (item && typeof item === 'object' && 'msg' in item) {
          return String(item.msg)
        }
        return String(item)
      })
      .join(', ')
  }

  return fallback
}

function buildGuestPayload(formData: GuestFormState) {
  return {
    wedding_id: Number(formData.wedding_id),
    name: formData.name.trim(),
    email: optionalText(formData.email),
    phone: optionalText(formData.phone),
    relationship: optionalText(formData.relationship),
    rsvp_status: formData.rsvp_status,
    dietary_restrictions: optionalText(formData.dietary_restrictions),
    plus_one_name: optionalText(formData.plus_one_name),
    plus_one_rsvp: formData.plus_one_rsvp || null,
    plus_one_dietary: optionalText(formData.plus_one_dietary),
    table_number: optionalNumber(formData.table_number),
    seat_number: optionalNumber(formData.seat_number),
    notes: optionalText(formData.notes),
  }
}

export function GuestForm({
  apiBaseUrl = API_BASE_URL,
  defaultWeddingId = 1,
  guest,
  mode = 'create',
  onCancel,
  onSuccess,
}: GuestFormProps) {
  const isEditing = mode === 'edit'
  const [formData, setFormData] = useState<GuestFormState>(() =>
    formStateFromGuest(isEditing ? guest : null, defaultWeddingId),
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    setFormData(formStateFromGuest(isEditing ? guest : null, defaultWeddingId))
    setError(null)
    setSuccess(null)
  }, [defaultWeddingId, guest, isEditing])

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target
    setFormData((current) => ({ ...current, [name]: value }))
  }

  const validate = (): string | null => {
    if (!Number(formData.wedding_id) || Number(formData.wedding_id) < 1) {
      return 'Wedding ID is required.'
    }

    if (!formData.name.trim()) {
      return 'Guest name is required.'
    }

    if (formData.email.trim() && !formData.email.includes('@')) {
      return 'Email must contain @.'
    }

    if (formData.table_number.trim() && Number(formData.table_number) < 1) {
      return 'Table number must be 1 or greater.'
    }

    if (formData.seat_number.trim() && Number(formData.seat_number) < 1) {
      return 'Seat number must be 1 or greater.'
    }

    return null
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    if (isEditing && !guest) {
      setError('Select a guest to edit.')
      return
    }

    setLoading(true)

    try {
      const response = await fetch(
        isEditing ? `${apiBaseUrl}/api/guests/${guest?.id}` : `${apiBaseUrl}/api/guests`,
        {
          method: isEditing ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildGuestPayload(formData)),
        },
      )

      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(
          extractErrorMessage(
            payload,
            isEditing ? 'Failed to update guest' : 'Failed to add guest',
          ),
        )
      }

      const savedGuest = payload as Guest
      setFormData(
        isEditing
          ? formStateFromGuest(savedGuest, defaultWeddingId)
          : initialFormState(defaultWeddingId),
      )
      setSuccess(isEditing ? 'Guest updated successfully.' : 'Guest added successfully.')
      onSuccess?.(savedGuest)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : isEditing
            ? 'Failed to update guest'
            : 'Failed to add guest',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit} style={formStyle}>
      {success && <div style={successStyle}>{success}</div>}
      {error && (
        <div role="alert" style={errorStyle}>
          {error}
        </div>
      )}

      <div style={gridStyle}>
        <label style={labelStyle}>
          Wedding ID
          <input
            min="1"
            name="wedding_id"
            onChange={handleChange}
            required
            style={inputStyle}
            type="number"
            value={formData.wedding_id}
          />
        </label>

        <label style={labelStyle}>
          Name
          <input
            maxLength={255}
            name="name"
            onChange={handleChange}
            required
            style={inputStyle}
            value={formData.name}
          />
        </label>

        <label style={labelStyle}>
          Email
          <input
            maxLength={255}
            name="email"
            onChange={handleChange}
            style={inputStyle}
            type="email"
            value={formData.email}
          />
        </label>

        <label style={labelStyle}>
          Phone
          <input
            maxLength={20}
            name="phone"
            onChange={handleChange}
            style={inputStyle}
            value={formData.phone}
          />
        </label>

        <label style={labelStyle}>
          Relationship
          <input
            maxLength={100}
            name="relationship"
            onChange={handleChange}
            style={inputStyle}
            value={formData.relationship}
          />
        </label>

        <label style={labelStyle}>
          RSVP
          <select
            aria-label="RSVP"
            name="rsvp_status"
            onChange={handleChange}
            style={inputStyle}
            value={formData.rsvp_status}
          >
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="declined">Declined</option>
            <option value="tentative">Tentative</option>
          </select>
        </label>

        <label style={labelStyle}>
          Plus One
          <input
            maxLength={255}
            name="plus_one_name"
            onChange={handleChange}
            style={inputStyle}
            value={formData.plus_one_name}
          />
        </label>

        <label style={labelStyle}>
          Plus One RSVP
          <select
            aria-label="Plus One RSVP"
            name="plus_one_rsvp"
            onChange={handleChange}
            style={inputStyle}
            value={formData.plus_one_rsvp}
          >
            <option value="">None</option>
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="declined">Declined</option>
            <option value="tentative">Tentative</option>
          </select>
        </label>

        <label style={labelStyle}>
          Table
          <input
            min="1"
            name="table_number"
            onChange={handleChange}
            style={inputStyle}
            type="number"
            value={formData.table_number}
          />
        </label>

        <label style={labelStyle}>
          Seat
          <input
            min="1"
            name="seat_number"
            onChange={handleChange}
            style={inputStyle}
            type="number"
            value={formData.seat_number}
          />
        </label>
      </div>

      <label style={labelStyle}>
        Dietary Restrictions
        <textarea
          name="dietary_restrictions"
          onChange={handleChange}
          rows={3}
          style={textareaStyle}
          value={formData.dietary_restrictions}
        />
      </label>

      <label style={labelStyle}>
        Plus One Dietary
        <textarea
          name="plus_one_dietary"
          onChange={handleChange}
          rows={3}
          style={textareaStyle}
          value={formData.plus_one_dietary}
        />
      </label>

      <label style={labelStyle}>
        Notes
        <textarea
          name="notes"
          onChange={handleChange}
          rows={3}
          style={textareaStyle}
          value={formData.notes}
        />
      </label>

      <div style={buttonGroupStyle}>
        <button disabled={loading} style={buttonStyle} type="submit">
          {loading ? (isEditing ? 'Saving...' : 'Adding...') : isEditing ? 'Save Guest' : 'Add Guest'}
        </button>
        {onCancel && (
          <button disabled={loading} onClick={onCancel} style={secondaryButtonStyle} type="button">
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}

const formStyle = {
  border: '1px solid #d6d9df',
  borderRadius: '6px',
  display: 'grid',
  gap: '14px',
  padding: '16px',
}

const gridStyle = {
  display: 'grid',
  gap: '12px',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
}

const labelStyle = {
  color: '#1f2933',
  display: 'grid',
  fontSize: '13px',
  fontWeight: 700,
  gap: '6px',
}

const inputStyle = {
  border: '1px solid #c8cdd5',
  borderRadius: '4px',
  boxSizing: 'border-box' as const,
  font: 'inherit',
  fontWeight: 400,
  padding: '9px 10px',
  width: '100%',
}

const textareaStyle = {
  ...inputStyle,
  minHeight: '78px',
  resize: 'vertical' as const,
}

const buttonGroupStyle = {
  display: 'flex',
  flexWrap: 'wrap' as const,
  gap: '10px',
}

const buttonStyle = {
  background: '#1f6f5b',
  border: '1px solid #1f6f5b',
  borderRadius: '4px',
  color: '#fff',
  cursor: 'pointer',
  font: 'inherit',
  fontWeight: 700,
  padding: '10px 14px',
}

const secondaryButtonStyle = {
  ...buttonStyle,
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
