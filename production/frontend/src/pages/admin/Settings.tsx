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
  type WeddingThemeSettings,
} from '@/hooks/useSettings'
import { buildTint, DEFAULT_THEME } from '@/lib/theme'

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

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/

function isValidHex(value: string): boolean {
  return HEX_PATTERN.test(value)
}

interface ColourDialProps {
  id: string
  label: string
  hint: string
  value: string
  onChange: (value: string) => void
}

function ColourDial({ id, label, hint, value, onChange }: ColourDialProps) {
  const valid = isValidHex(value)

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-3">
        <input
          type="color"
          aria-label={`${label} picker`}
          className="h-10 w-14 cursor-pointer rounded-md border border-input bg-white p-1"
          value={valid ? value : '#000000'}
          onChange={(event) => onChange(event.target.value)}
        />
        <Input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value.trim())}
          className="w-32 font-mono"
          maxLength={7}
          placeholder="#f6c445"
        />
      </div>
      <p className="text-xs text-gray-500 m-0">{hint}</p>
      {!valid && (
        <p className="text-xs text-red-600 m-0">Use a six-digit hex colour, e.g. #f6c445</p>
      )}
    </div>
  )
}

function ThemeCard({ settings }: { settings: WeddingSettings }) {
  const updateMutation = useUpdateSettings()
  const [theme, setTheme] = useState<WeddingThemeSettings>(settings.theme ?? DEFAULT_THEME)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    setTheme(settings.theme ?? DEFAULT_THEME)
  }, [settings.theme])

  const isSaving = updateMutation.isPending
  const hexesValid = isValidHex(theme.primary) && isValidHex(theme.secondary)
  const tintPercent = Math.round(theme.tint_opacity * 100)

  const previewTint = hexesValid
    ? buildTint(theme.secondary, theme.tint_opacity)
    : buildTint(DEFAULT_THEME.secondary, theme.tint_opacity)

  const save = async (payload: WeddingThemeSettings | null) => {
    setFeedback(null)
    setSaveError(null)
    try {
      await updateMutation.mutateAsync({ theme: payload })
      setFeedback(payload ? 'Theme saved — the guest site now uses it.' : 'Theme reset to the default look.')
      if (!payload) {
        setTheme(DEFAULT_THEME)
      }
    } catch (err) {
      setSaveError(err instanceof SettingsApiError ? err.message : 'Failed to save theme')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Guest Site Theme</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4" aria-label="Guest site theme controls">
          {feedback && (
            <Alert variant="success" role="status" aria-live="polite">
              {feedback}
            </Alert>
          )}
          {saveError && <Alert variant="destructive">{saveError}</Alert>}

          <div className="grid gap-4 sm:grid-cols-2">
            <ColourDial
              id="theme-primary"
              label="Accent colour"
              hint="Buttons, highlights, and the active menu tab."
              value={theme.primary}
              onChange={(value) => setTheme((t) => ({ ...t, primary: value }))}
            />
            <ColourDial
              id="theme-secondary"
              label="Deep colour"
              hint="Headings, button text, and the photo tint."
              value={theme.secondary}
              onChange={(value) => setTheme((t) => ({ ...t, secondary: value }))}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="theme-tint">Photo tint strength ({tintPercent}%)</Label>
            <input
              id="theme-tint"
              type="range"
              min={30}
              max={100}
              step={1}
              value={tintPercent}
              onChange={(event) =>
                setTheme((t) => ({ ...t, tint_opacity: Number(event.target.value) / 100 }))
              }
              className="w-full accent-plum"
            />
            <p className="text-xs text-gray-500 m-0">
              Lower = your photos show through more; higher = calmer, easier to read.
            </p>
          </div>

          {/* Live preview */}
          <div className="grid gap-2">
            <span className="text-sm font-medium">Preview</span>
            <div
              aria-hidden="true"
              className="flex items-center justify-between gap-4 rounded-2xl px-5 py-6 bg-cover bg-center"
              style={{
                backgroundImage: `${previewTint}, url(/backgrounds/bg-02-registry-office.jpg)`,
              }}
            >
              <p className="m-0 font-display text-xl" style={{ color: '#fff6df' }}>
                Ashley &amp; Hazel
              </p>
              <span
                className="rounded-full px-4 py-2 text-sm font-semibold"
                style={{
                  backgroundColor: hexesValid ? theme.primary : DEFAULT_THEME.primary,
                  color: hexesValid ? theme.secondary : DEFAULT_THEME.secondary,
                }}
              >
                Sample button
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              disabled={isSaving || !hexesValid}
              onClick={() => save(theme)}
            >
              {isSaving ? 'Saving...' : 'Save theme'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isSaving}
              onClick={() => save(null)}
            >
              Reset to default
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
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

        {!isLoading && !isError && settings && <ThemeCard settings={settings} />}
      </div>
    </AdminLayout>
  )
}
