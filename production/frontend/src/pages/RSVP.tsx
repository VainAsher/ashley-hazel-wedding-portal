import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'

import { AuthApiError, fetchCurrentUser } from '../api/auth'
import {
  RsvpApiError,
  fetchGuestRsvp,
  saveGuestRsvp,
  type GuestRsvp,
  type GuestRsvpUpdate,
  type MealChoice,
  type RsvpStatus,
} from '../api/rsvp'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Alert } from '../components/ui/alert'

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
  if (error instanceof AuthApiError) {
    if (error.status === 401) {
      return 'Please enter your invite code to RSVP.'
    }
    return error.message
  }

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
    <main className="grid items-start min-h-[calc(100vh-52px)] p-5">
      <section className="border border-[#d6d9df] rounded-md grid gap-[18px] max-w-2xl p-5 w-full">
        <header className="grid gap-1.5">
          <h1 className="text-2xl leading-tight m-0">RSVP</h1>
          {guest && <p className="text-[#47505f] text-base m-0">{guest.name}</p>}
        </header>

        {loading && (
          <div role="status" className="text-[#47505f] text-sm">
            Loading RSVP...
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            {error}
          </Alert>
        )}

        {!loading && guest && (
          <form onSubmit={handleSubmit} className="grid gap-4">
            <fieldset disabled={formDisabled} className="border-0 grid gap-3 m-0 p-0">
              <legend className="text-[#374151] text-sm font-bold p-0">Attendance</legend>
              <label className="flex items-center gap-2">
                <input
                  checked={formData.rsvpStatus === 'accepted'}
                  name="rsvpStatus"
                  onChange={updateField('rsvpStatus')}
                  type="radio"
                  value="accepted"
                />
                Accept
              </label>
              <label className="flex items-center gap-2">
                <input
                  checked={formData.rsvpStatus === 'declined'}
                  name="rsvpStatus"
                  onChange={updateField('rsvpStatus')}
                  type="radio"
                  value="declined"
                />
                Decline
              </label>
              <label className="flex items-center gap-2">
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

            <fieldset disabled={formDisabled} className="border-0 grid gap-3 m-0 p-0">
              <label htmlFor="meal-choice" className="text-sm font-bold text-[#374151]">
                Meal Choice
              </label>
              <select
                id="meal-choice"
                name="mealChoice"
                onChange={updateField('mealChoice')}
                className="flex h-10 w-full rounded-md border border-[#aeb6c2] bg-white px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={formData.mealChoice}
              >
                <option value="">Select meal</option>
                <option value="chicken">Chicken</option>
                <option value="fish">Fish</option>
                <option value="vegetarian">Vegetarian</option>
              </select>

              <label htmlFor="dietary-notes" className="text-sm font-bold text-[#374151]">
                Dietary Notes
              </label>
              <textarea
                id="dietary-notes"
                maxLength={500}
                name="dietaryNotes"
                onChange={updateField('dietaryNotes')}
                rows={4}
                className="flex w-full rounded-md border border-[#aeb6c2] bg-white px-3 py-2 text-base resize-vertical focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={formData.dietaryNotes}
              />

              <label htmlFor="plus-one-name" className="text-sm font-bold text-[#374151]">
                Plus One Name
              </label>
              <Input
                id="plus-one-name"
                name="plusOneName"
                onChange={updateField('plusOneName')}
                type="text"
                value={formData.plusOneName}
              />
            </fieldset>

            {statusMessage && (
              <Alert variant="success">
                {statusMessage}
              </Alert>
            )}

            <Button disabled={formDisabled} type="submit">
              {saved ? 'Saved' : submitting ? 'Saving...' : 'Save RSVP'}
            </Button>
          </form>
        )}
      </section>
    </main>
  )
