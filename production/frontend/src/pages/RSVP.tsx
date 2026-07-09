import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'

import { AuthApiError, fetchCurrentUser } from '../api/auth'
import {
  RsvpApiError,
  fetchGuestRsvp,
  saveGuestRsvp,
  type GuestRsvp,
  type GuestRsvpUpdate,
  type RsvpStatus,
} from '../api/rsvp'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Alert } from '../components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { GuestLayout } from '../components/GuestLayout'
import { usePageTitle } from '../hooks/usePageTitle'

interface RsvpFormData {
  rsvpStatus: RsvpStatus
  dietaryNotes: string
  plusOneName: string
}

const defaultFormData: RsvpFormData = {
  rsvpStatus: 'pending',
  dietaryNotes: '',
  plusOneName: '',
}

function formDataFromGuest(guest: GuestRsvp): RsvpFormData {
  return {
    rsvpStatus: guest.rsvp_status,
    dietaryNotes: guest.dietary_notes ?? '',
    plusOneName: guest.plus_one_name ?? '',
  }
}

function phaseMessage(phase: string): string {
  switch (phase) {
    case 'planning':
      return 'RSVP is not open yet — please check back soon.'
    case 'event':
      return 'RSVP responses are now closed. See you at the celebration!'
    case 'archived':
      return 'This wedding has been archived and RSVP is closed.'
    default:
      return 'RSVP is currently closed.'
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
  usePageTitle('RSVP')
  const [guest, setGuest] = useState<GuestRsvp | null>(null)
  const [formData, setFormData] = useState<RsvpFormData>(defaultFormData)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [closedMessage, setClosedMessage] = useState<string | null>(null)

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

        const phase = user.wedding_phase ?? 'live'
        if (phase !== 'live') {
          if (mounted) {
            setClosedMessage(phaseMessage(phase))
          }
          return
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
    <GuestLayout>
      <div className="max-w-2xl mx-auto w-full">
        {loading && (
          <Card>
            <CardContent className="pt-6">
              <div role="status" className="text-gray-600 text-sm">
                Loading RSVP...
              </div>
            </CardContent>
          </Card>
        )}

        {error && (
          <Alert variant="destructive" className="mb-6">
            {error}
          </Alert>
        )}

        {!loading && closedMessage && (
          <Card>
            <CardContent className="pt-6">
              <div role="status" className="text-gray-700 text-sm">
                {closedMessage}
              </div>
            </CardContent>
          </Card>
        )}

        {!loading && guest && (
          <>
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>RSVP</CardTitle>
                <CardDescription>{guest.name}</CardDescription>
              </CardHeader>
            </Card>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Attendance Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Attendance</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <fieldset disabled={formDisabled} className="border-0 space-y-3 m-0 p-0">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        checked={formData.rsvpStatus === 'accepted'}
                        name="rsvpStatus"
                        onChange={updateField('rsvpStatus')}
                        type="radio"
                        value="accepted"
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-medium">Accept</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        checked={formData.rsvpStatus === 'declined'}
                        name="rsvpStatus"
                        onChange={updateField('rsvpStatus')}
                        type="radio"
                        value="declined"
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-medium">Decline</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        checked={formData.rsvpStatus === 'tentative'}
                        name="rsvpStatus"
                        onChange={updateField('rsvpStatus')}
                        type="radio"
                        value="tentative"
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-medium">Tentative</span>
                    </label>
                  </fieldset>
                </CardContent>
              </Card>

              {/* Dietary & plus one - Only show if attending */}
              {formData.rsvpStatus === 'accepted' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Dietary requirements</CardTitle>
                    <CardDescription>
                      Menu choices open nearer the day, once the menu is finalised. For now,
                      tell us about any allergies or dietary requirements.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <fieldset disabled={formDisabled} className="border-0 space-y-4 m-0 p-0">
                      {/* Dietary Notes */}
                      <div className="space-y-2">
                        <label htmlFor="dietary-notes" className="text-sm font-medium text-gray-700">
                          Dietary requirements
                        </label>
                        <textarea
                          id="dietary-notes"
                          maxLength={500}
                          name="dietaryNotes"
                          onChange={updateField('dietaryNotes')}
                          rows={4}
                          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-base resize-vertical focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
                          value={formData.dietaryNotes}
                        />
                      </div>

                      {/* Plus One Name */}
                      <div className="space-y-2">
                        <label htmlFor="plus-one-name" className="text-sm font-medium text-gray-700">
                          Plus One Name
                        </label>
                        <Input
                          id="plus-one-name"
                          name="plusOneName"
                          onChange={updateField('plusOneName')}
                          type="text"
                          value={formData.plusOneName}
                          placeholder="Enter name of your plus one"
                        />
                      </div>
                    </fieldset>
                  </CardContent>
                </Card>
              )}

              {/* Status Message */}
              {statusMessage && (
                <Alert variant="success">
                  {statusMessage}
                </Alert>
              )}

              {/* Submit Button */}
              <Button disabled={formDisabled} type="submit" size="lg" className="w-full">
                {saved ? 'Saved' : submitting ? 'Saving...' : 'Save RSVP'}
              </Button>
            </form>
          </>
        )}
      </div>
    </GuestLayout>
  )
}
