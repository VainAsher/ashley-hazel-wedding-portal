import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'

import {
  RsvpApiError,
  fetchGuestRsvp,
  saveGuestRsvp,
  type GuestRsvp,
  type GuestRsvpUpdate,
  type RsvpStatus,
} from '../api/rsvp'
import { fetchPortalMenu, type PortalMenuOption } from '../api/portal'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Alert } from '../components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import { useAuth } from '../contexts/AuthContext'
import { usePageTitle } from '../hooks/usePageTitle'

interface RsvpFormData {
  rsvpStatus: RsvpStatus
  dietaryNotes: string
  plusOneName: string
  mealChoice: string
  plusOneMealChoice: string
}

const defaultFormData: RsvpFormData = {
  rsvpStatus: 'pending',
  dietaryNotes: '',
  plusOneName: '',
  mealChoice: '',
  plusOneMealChoice: '',
}

function formDataFromGuest(guest: GuestRsvp): RsvpFormData {
  return {
    rsvpStatus: guest.rsvp_status,
    dietaryNotes: guest.dietary_notes ?? '',
    plusOneName: guest.plus_one_name ?? '',
    mealChoice: guest.meal_choice ?? '',
    plusOneMealChoice: guest.plus_one_meal_choice ?? '',
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

function dietaryTags(option: PortalMenuOption): string {
  const tags = [
    option.is_vegetarian && 'vegetarian',
    option.is_vegan && 'vegan',
    option.is_gluten_free && 'gluten-free',
  ].filter(Boolean)
  return tags.join(', ')
}

/** Description + dietary tags of the currently chosen option, if any. */
function MealHint({ options, chosen }: { options: PortalMenuOption[]; chosen: string }) {
  const option = options.find((candidate) => candidate.name === chosen)
  if (!option) {
    return null
  }
  const tags = dietaryTags(option)
  const text = [option.description, tags && `(${tags})`].filter(Boolean).join(' ')
  if (!text) {
    return null
  }
  return <p className="text-xs text-gray-500 m-0">{text}</p>
}

// The actual page content, no GuestLayout wrapper -- used both by the thin
// `RSVP` route wrapper below (scroll mode) and by PagedGuestDeck, which
// mounts all 4 guest pages' content together inside one shared GuestLayout
// (paged mode). See docs/specs/VIEWPORT_PAGING_PHASE1.md.
export function RSVPContent() {
  usePageTitle('RSVP')
  // Current user + wedding phase come from the shared auth context (a single
  // /api/auth/me query for the whole app) rather than a page-level fetch.
  const { user, weddingPhase, loading: authLoading, error: authError } = useAuth()
  const [guest, setGuest] = useState<GuestRsvp | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuOptions, setMenuOptions] = useState<PortalMenuOption[]>([])
  const [formData, setFormData] = useState<RsvpFormData>(defaultFormData)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [closedMessage, setClosedMessage] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) {
      return
    }

    let mounted = true

    async function loadRsvp() {
      setLoading(true)
      setError(null)
      setStatusMessage(null)

      try {
        if (!user) {
          if (mounted) {
            setError(authError ?? 'Please enter your invite code to RSVP.')
          }
          return
        }

        if (!user.guest_id) {
          throw new RsvpApiError('RSVP is only available for guest invites.', 403)
        }

        const phase = weddingPhase ?? 'live'
        if (phase !== 'live') {
          if (mounted) {
            setClosedMessage(phaseMessage(phase))
          }
          return
        }

        // The portal menu tells us whether meal selection is open and, if so,
        // which options to offer. A menu failure must not block the RSVP form
        // itself — fall back to the closed (dietary-only) experience.
        const [loadedGuest, menu] = await Promise.all([
          fetchGuestRsvp(user.guest_id),
          fetchPortalMenu().catch(() => ({ meal_selection_open: false, options: [] })),
        ])
        if (!mounted) {
          return
        }

        setGuest(loadedGuest)
        setMenuOpen(menu.meal_selection_open)
        setMenuOptions(menu.options)
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
  }, [authLoading, user, weddingPhase, authError])

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

    // Meal fields are only sent while selection is open — the backend rejects
    // them otherwise, and omitting them preserves any stored choice.
    if (menuOpen) {
      payload.meal_choice = optionalText(formData.mealChoice)
      payload.plus_one_meal_choice = optionalText(formData.plusOneName)
        ? optionalText(formData.plusOneMealChoice)
        : null
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
                    <CardTitle className="text-lg">
                      {menuOpen ? 'Meals & dietary requirements' : 'Dietary requirements'}
                    </CardTitle>
                    <CardDescription>
                      {menuOpen
                        ? 'The menu is ready — pick a meal for yourself (and your plus one), and tell us about any allergies or dietary requirements.'
                        : 'Menu choices open nearer the day, once the menu is finalised. For now, tell us about any allergies or dietary requirements.'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <fieldset disabled={formDisabled} className="border-0 space-y-4 m-0 p-0">
                      {/* Meal choice — only once the couple opens meal selection */}
                      {menuOpen && (
                        <div className="space-y-2">
                          <Label htmlFor="meal-choice" className="text-gray-700">
                            Your meal
                          </Label>
                          {/* Radix v2 treats value="" as controlled-with-placeholder */}
                          <Select
                            value={formData.mealChoice}
                            onValueChange={(value) =>
                              setFormData((current) => ({ ...current, mealChoice: value }))
                            }
                          >
                            <SelectTrigger id="meal-choice" aria-label="Your meal" disabled={formDisabled}>
                              <SelectValue placeholder="Choose a meal" />
                            </SelectTrigger>
                            <SelectContent>
                              {menuOptions.map((option) => (
                                <SelectItem key={option.id} value={option.name}>
                                  {option.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <MealHint options={menuOptions} chosen={formData.mealChoice} />
                        </div>
                      )}

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

                      {/* Plus-one meal — needs an open menu and a named plus one */}
                      {menuOpen && formData.plusOneName.trim() !== '' && (
                        <div className="space-y-2">
                          <Label htmlFor="plus-one-meal-choice" className="text-gray-700">
                            Plus one meal
                          </Label>
                          <Select
                            value={formData.plusOneMealChoice}
                            onValueChange={(value) =>
                              setFormData((current) => ({ ...current, plusOneMealChoice: value }))
                            }
                          >
                            <SelectTrigger
                              id="plus-one-meal-choice"
                              aria-label="Plus one meal"
                              disabled={formDisabled}
                            >
                              <SelectValue placeholder="Choose a meal" />
                            </SelectTrigger>
                            <SelectContent>
                              {menuOptions.map((option) => (
                                <SelectItem key={option.id} value={option.name}>
                                  {option.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <MealHint options={menuOptions} chosen={formData.plusOneMealChoice} />
                        </div>
                      )}
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
  )
}

