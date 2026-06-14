import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'

import {
  RsvpApiError,
  fetchCurrentUser,
  fetchGuestRsvp,
  saveGuestRsvp,
  type GuestRsvp,
  type GuestRsvpUpdate,
  type MealChoice,
  type RsvpStatus,
} from '../api/rsvp'

interface RsvpFormData {
  rsvpStatus: RsvpStatus
  mealChoice: '' | MealChoice
  dietaryNotes: string
  plusOneName: string
}

const defaultFormData: RsvpFormData = {
  rsvpStatus: 'pending',
  mealChoice: '',
  dietaryNotes: '',
  plusOneName: '',
}

function formDataFromGuest(guest: GuestRsvp): RsvpFormData {
  return {
    rsvpStatus: guest.rsvp_status,
    mealChoice: guest.meal_choice ?? '',
    dietaryNotes: guest.dietary_notes ?? '',
    plusOneName: guest.plus_one_name ?? '',
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof RsvpApiError) {
    if (error.status === 401) {
      return 'Please enter your invite code to RSVP.'
    }
    return error.message
  }

  return 'Unable to reach the server. Try again.'
}

function optionalText(value: string): string | null {
  const trimmed = value.trim()
  return trimmed || null
}

export function RSVP() {
  const [guest, setGuest] = useState<GuestRsvp | null>(null)
  const [formData, setFormData] = useState<RsvpFormData>(defaultFormData)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function loadRsvp() {
      setLoading(true)
      setError(null)
      setStatusMessage(null)

      try {
        const user = await fetchCurrentUser()
        if (!user.guest_id) {
          throw new RsvpApiError('RSVP is only available for guest invites.', 403)
        }

        const loadedGuest = await fetchGuestRsvp(user.guest_id)
        if (!mounted) {
          return
        }

        setGuest(loadedGuest)
        setFormData(formDataFromGuest(loadedGuest))
      } catch (err) {
        if (mounted) {
          setError(errorMessage(err))
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    void loadRsvp()

    return () => {
      mounted = false
    }
  }, [])

  const updateField =
    <Key extends keyof RsvpFormData>(key: Key) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setFormData((current) => ({
        ...current,
        [key]: event.target.value as RsvpFormData[Key],
      }))
    }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!guest) {
      return
    }

    const payload: GuestRsvpUpdate = {
      rsvp_status: formData.rsvpStatus,
      meal_choice: formData.mealChoice || null,
      dietary_notes: optionalText(formData.dietaryNotes),
      plus_one_name: optionalText(formData.plusOneName),
    }

    setSubmitting(true)
    setError(null)
    setStatusMessage(null)

    try {
      const updatedGuest = await saveGuestRsvp(guest.id, payload)
      setGuest(updatedGuest)
      setFormData(formDataFromGuest(updatedGuest))
      setSaved(true)
      setStatusMessage('RSVP saved.')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const formDisabled = submitting || saved

  return (
    <main style={pageStyle}>
      <section style={panelStyle}>
        <header style={headerStyle}>
          <h1 style={titleStyle}>RSVP</h1>
          {guest && <p style={guestNameStyle}>{guest.name}</p>}
        </header>

        {loading && (
          <div role="status" style={statusStyle}>
            Loading RSVP...
          </div>
        )}

        {error && (
          <div role="alert" style={errorStyle}>
            {error}
          </div>
        )}

        {!loading && guest && (
          <form onSubmit={handleSubmit} style={formStyle}>
            <fieldset disabled={formDisabled} style={fieldsetStyle}>
              <legend style={legendStyle}>Attendance</legend>
              <label style={radioLabelStyle}>
                <input
                  checked={formData.rsvpStatus === 'accepted'}
                  name="rsvpStatus"
                  onChange={updateField('rsvpStatus')}
                  type="radio"
                  value="accepted"
                />
                Accept
              </label>
              <label style={radioLabelStyle}>
                <input
                  checked={formData.rsvpStatus === 'declined'}
                  name="rsvpStatus"
                  onChange={updateField('rsvpStatus')}
                  type="radio"
                  value="declined"
                />
                Decline
              </label>
              <label style={radioLabelStyle}>
                <input
                  checked={formData.rsvpStatus === 'tentative'}
                  name="rsvpStatus"
                  onChange={updateField('rsvpStatus')}
                  type="radio"
                  value="tentative"
                />
                Tentative
              </label>
            </fieldset>

            <fieldset disabled={formDisabled} style={fieldsetStyle}>
              <label htmlFor="meal-choice" style={labelStyle}>
                Meal Choice
              </label>
              <select
                id="meal-choice"
                name="mealChoice"
                onChange={updateField('mealChoice')}
                style={inputStyle}
                value={formData.mealChoice}
              >
                <option value="">Select meal</option>
                <option value="chicken">Chicken</option>
                <option value="fish">Fish</option>
                <option value="vegetarian">Vegetarian</option>
              </select>

              <label htmlFor="dietary-notes" style={labelStyle}>
                Dietary Notes
              </label>
              <textarea
                id="dietary-notes"
                maxLength={500}
                name="dietaryNotes"
                onChange={updateField('dietaryNotes')}
                rows={4}
                style={textAreaStyle}
                value={formData.dietaryNotes}
              />

              <label htmlFor="plus-one-name" style={labelStyle}>
                Plus One Name
              </label>
              <input
                id="plus-one-name"
                name="plusOneName"
                onChange={updateField('plusOneName')}
                style={inputStyle}
                type="text"
                value={formData.plusOneName}
              />
            </fieldset>

            {statusMessage && (
              <div role="status" style={successStyle}>
                {statusMessage}
              </div>
            )}

            <button disabled={formDisabled} style={primaryButtonStyle} type="submit">
              {saved ? 'Saved' : submitting ? 'Saving...' : 'Save RSVP'}
            </button>
          </form>
        )}
      </section>
    </main>
  )
}

const pageStyle = {
  alignItems: 'start',
  display: 'grid',
  minHeight: 'calc(100vh - 52px)',
  padding: '20px',
}

const panelStyle = {
  border: '1px solid #d6d9df',
  borderRadius: '6px',
  display: 'grid',
  gap: '18px',
  maxWidth: '640px',
  padding: '20px',
  width: '100%',
}

const headerStyle = {
  display: 'grid',
  gap: '6px',
}

const titleStyle = {
  fontSize: '28px',
  lineHeight: 1.2,
  margin: 0,
}

const guestNameStyle = {
  color: '#47505f',
  fontSize: '16px',
  margin: 0,
}

const formStyle = {
  display: 'grid',
  gap: '16px',
}

const fieldsetStyle = {
  border: '0',
  display: 'grid',
  gap: '12px',
  margin: 0,
  padding: 0,
}

const legendStyle = {
  color: '#374151',
  fontSize: '14px',
  fontWeight: 700,
  padding: 0,
}

const radioLabelStyle = {
  alignItems: 'center',
  display: 'flex',
  gap: '8px',
}

const labelStyle = {
  color: '#374151',
  fontSize: '14px',
  fontWeight: 700,
}

const inputStyle = {
  border: '1px solid #aeb6c2',
  borderRadius: '4px',
  fontSize: '16px',
  padding: '10px',
}

const textAreaStyle = {
  ...inputStyle,
  resize: 'vertical' as const,
}

const primaryButtonStyle = {
  background: '#1f6f5b',
  border: '1px solid #1f6f5b',
  borderRadius: '4px',
  color: '#ffffff',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: 700,
  minHeight: '42px',
  padding: '10px 14px',
}

const statusStyle = {
  color: '#47505f',
  fontSize: '14px',
}

const successStyle = {
  background: '#ecfdf5',
  border: '1px solid #bbf7d0',
  borderRadius: '4px',
  color: '#166534',
  fontSize: '14px',
  padding: '10px',
}

const errorStyle = {
  background: '#fef2f2',
  border: '1px solid #fecaca',
  borderRadius: '4px',
  color: '#991b1b',
  fontSize: '14px',
  padding: '10px',
}
