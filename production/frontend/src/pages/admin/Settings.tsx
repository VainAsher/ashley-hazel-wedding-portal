import { useEffect, useState, type FormEvent } from 'react'

import { AdminLayout } from '@/components/AdminLayout'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  SettingsApiError,
  useSettings,
  useUpdateSettings,
  type WeddingPhase,
  type WeddingSettings,
  type WeddingSettingsPayload,
} from '@/hooks/useSettings'

const PHASE_OPTIONS: { value: WeddingPhase; label: string; description: string }[] = [
  { value: 'planning', label: 'Planning', description: 'Guest portal dormant — RSVP not yet open.' },
  { value: 'live', label: 'Live', description: 'Guests can log in and submit their RSVP.' },
  { value: 'event', label: 'Event', description: 'Day-of mode — RSVP responses are frozen.' },
  { value: 'archived', label: 'Archived', description: 'Wedding complete — everything is read-only.' },
]

interface SettingsFormState {
  couple_names: string
  wedding_date: string
  ceremony_time: string
  ceremony_location: string
  reception_location: string
  phase: WeddingPhase
}

function emptyFormState(): SettingsFormState {
  return {
    couple_names: '',
    wedding_date: '',
    ceremony_time: '',
    ceremony_location: '',
    reception_location: '',
    phase: 'live',
  }
}

function formStateFromSettings(settings: WeddingSettings): SettingsFormState {
  return {
    couple_names: settings.couple_names ?? '',
    wedding_date: settings.wedding_date ?? '',
    // Trim seconds so the value fits an <input type="time"> (HH:MM).
    ceremony_time: settings.ceremony_time ? settings.ceremony_time.slice(0, 5) : '',
    ceremony_location: settings.ceremony_location ?? '',
    reception_location: settings.reception_location ?? '',
    phase: settings.phase ?? 'live',
  }
}

function optionalText(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function validate(form: SettingsFormState): string | null {
  if (!form.couple_names.trim()) {
    return 'Couple names are required.'
  }
  if (!form.wedding_date.trim()) {
    return 'Wedding date is required.'
  }
  return null
}

function buildPayload(form: SettingsFormState): WeddingSettingsPayload {
  return {
    couple_names: form.couple_names.trim(),
    wedding_date: form.wedding_date,
    ceremony_time: optionalText(form.ceremony_time),
    ceremony_location: optionalText(form.ceremony_location),
    reception_location: optionalText(form.reception_location),
    phase: form.phase,
  }
}

export function Settings() {
  const { data: settings, isLoading, isError, error } = useSettings()
  const updateMutation = useUpdateSettings()

  const [form, setForm] = useState<SettingsFormState>(emptyFormState)
  const [formError, setFormError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  useEffect(() => {
    if (settings) {
      setForm(formStateFromSettings(settings))
    }
  }, [settings])

  const isSaving = updateMutation.isPending

  const updateField = <K extends keyof SettingsFormState>(
    key: K,
    value: SettingsFormState[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)
    setFeedback(null)

    const validationError = validate(form)
    if (validationError) {
      setFormError(validationError)
      return
    }

    try {
      await updateMutation.mutateAsync(buildPayload(form))
      setFeedback('Settings saved successfully.')
    } catch (err) {
      setFormError(err instanceof SettingsApiError ? err.message : 'Failed to save settings')
    }
  }

  return (
    <AdminLayout
      title="Settings"
      breadcrumb={[{ label: 'Dashboard', href: '/admin' }, { label: 'Settings' }]}
    >
      <div className="grid gap-4">
        <section>
          <h2 className="text-xl font-semibold text-gray-900 m-0">Wedding Settings</h2>
          <p className="text-sm text-gray-600 m-0 mt-1">
            Manage the core details of the wedding.
          </p>
        </section>

        {feedback && (
          <Alert variant="success" role="status" aria-live="polite">
            {feedback}
          </Alert>
        )}

        {isLoading && (
          <div role="status" className="text-sm text-gray-600 border border-gray-200 rounded-md p-4">
            Loading settings...
          </div>
        )}

        {isError && !isLoading && (
          <Alert variant="destructive">
            {error instanceof Error ? error.message : 'Failed to load settings'}
          </Alert>
        )}

        {!isLoading && !isError && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Details</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                noValidate
                className="grid gap-4"
                onSubmit={handleSubmit}
                aria-label="Wedding settings form"
              >
                {formError && <Alert variant="destructive">{formError}</Alert>}

                <div className="grid gap-2">
                  <Label htmlFor="settings-couple-names">Couple Names</Label>
                  <Input
                    id="settings-couple-names"
                    value={form.couple_names}
                    onChange={(event) => updateField('couple_names', event.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="settings-wedding-date">Wedding Date</Label>
                  <Input
                    id="settings-wedding-date"
                    type="date"
                    value={form.wedding_date}
                    onChange={(event) => updateField('wedding_date', event.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="settings-ceremony-time">Ceremony Time</Label>
                  <Input
                    id="settings-ceremony-time"
                    type="time"
                    value={form.ceremony_time}
                    onChange={(event) => updateField('ceremony_time', event.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="settings-ceremony-location">Ceremony Location</Label>
                  <Input
                    id="settings-ceremony-location"
                    value={form.ceremony_location}
                    onChange={(event) => updateField('ceremony_location', event.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="settings-reception-location">Reception Location</Label>
                  <Input
                    id="settings-reception-location"
                    value={form.reception_location}
                    onChange={(event) => updateField('reception_location', event.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="settings-phase">Wedding Phase</Label>
                  <Select
                    value={form.phase}
                    onValueChange={(value) => updateField('phase', value as WeddingPhase)}
                  >
                    <SelectTrigger id="settings-phase" aria-label="Wedding Phase">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PHASE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 m-0">
                    {PHASE_OPTIONS.find((o) => o.value === form.phase)?.description}
                  </p>
                </div>

                <div>
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  )
}
