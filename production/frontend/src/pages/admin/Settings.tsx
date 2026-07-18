import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'

import { AdminLayout } from '@/components/AdminLayout'
import { MenuManager } from '@/components/admin/MenuManager'
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
import { useApprovedGallery } from '@/hooks/useGallery'
import {
  SettingsApiError,
  useSettings,
  useUpdateSettings,
  useUploadPageBackground,
  type LayoutMode,
  type PageBackground,
  type PageBackgroundKey,
  type PageBackgroundSource,
  type PartyVisibilityMode,
  type WeddingPhase,
  type WeddingSettings,
  type WeddingSettingsPayload,
  type WeddingThemeSettings,
} from '@/hooks/useSettings'
import {
  buildTint,
  DEFAULT_PAGE_BACKGROUNDS,
  DEFAULT_THEME,
  ensureFontPreviewStylesheet,
  findBodyFont,
  findDisplayFont,
  STOCK_BACKGROUNDS,
  THEME_BODY_FONTS,
  THEME_DISPLAY_FONTS,
  type FontOption,
} from '@/lib/theme'

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

interface FontDialProps {
  id: string
  label: string
  hint: string
  options: FontOption[]
  value: string
  onChange: (value: string) => void
}

function FontDial({ id, label, hint, options, value, onChange }: FontDialProps) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              style={{ fontFamily: option.stack }}
            >
              {option.value}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-gray-500 m-0">{hint}</p>
    </div>
  )
}

const TYPE_SCALE_OPTIONS: { value: number; label: string }[] = [
  { value: 0.9, label: 'Cosy' },
  { value: 1.0, label: 'Standard' },
  { value: 1.1, label: 'Roomy' },
]

// Older saved themes predate the typography keys — fill them with defaults.
function themeWithDefaults(theme: WeddingThemeSettings | null): WeddingThemeSettings {
  return { ...DEFAULT_THEME, ...(theme ?? {}) }
}

function ThemeCard({ settings }: { settings: WeddingSettings }) {
  const updateMutation = useUpdateSettings()
  const [theme, setTheme] = useState<WeddingThemeSettings>(() =>
    themeWithDefaults(settings.theme),
  )
  const [feedback, setFeedback] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    setTheme(themeWithDefaults(settings.theme))
  }, [settings.theme])

  // Load the allowlisted faces so the pickers and preview render for real.
  useEffect(() => {
    ensureFontPreviewStylesheet()
  }, [])

  const isSaving = updateMutation.isPending
  const hexesValid = isValidHex(theme.primary) && isValidHex(theme.secondary)
  const tintPercent = Math.round(theme.tint_opacity * 100)
  const displayStack = findDisplayFont(theme.display_font).stack
  const bodyStack = findBodyFont(theme.body_font).stack
  const typeScale = theme.type_scale ?? 1.0

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
      setSaveError(err instanceof SettingsApiError ? err.message : 'Unable to save theme.')
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

          <div className="grid gap-4 sm:grid-cols-2">
            <FontDial
              id="theme-display-font"
              label="Headings font"
              hint="Your names, page titles, and section headings."
              options={THEME_DISPLAY_FONTS}
              value={theme.display_font ?? DEFAULT_THEME.display_font}
              onChange={(value) => setTheme((t) => ({ ...t, display_font: value }))}
            />
            <FontDial
              id="theme-body-font"
              label="Text font"
              hint="Everything else — details, forms, and buttons."
              options={THEME_BODY_FONTS}
              value={theme.body_font ?? DEFAULT_THEME.body_font}
              onChange={(value) => setTheme((t) => ({ ...t, body_font: value }))}
            />
          </div>

          <div className="grid gap-2">
            <span className="text-sm font-medium">Type scale</span>
            <div
              role="group"
              aria-label="Type scale"
              className="inline-flex w-fit overflow-hidden rounded-md border border-input"
            >
              {TYPE_SCALE_OPTIONS.map((option) => {
                const active = typeScale === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setTheme((t) => ({ ...t, type_scale: option.value }))}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-plum text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-gray-500 m-0">
              How large text sits across the whole guest site.
            </p>
          </div>

          {/* Live preview */}
          <div className="grid gap-2">
            <span className="text-sm font-medium">Preview</span>
            <div
              aria-hidden="true"
              data-testid="theme-preview"
              className="grid gap-3 rounded-2xl px-5 py-6 bg-cover bg-center"
              style={{
                backgroundImage: `${previewTint}, url(/backgrounds/bg-02-registry-office.jpg)`,
                fontSize: `calc(1rem * ${typeScale})`,
              }}
            >
              <div className="flex items-center justify-between gap-4">
                <p
                  className="m-0"
                  data-testid="theme-preview-heading"
                  style={{ color: '#fff6df', fontFamily: displayStack, fontSize: '1.25em' }}
                >
                  Ashley &amp; Hazel
                </p>
                <span
                  className="rounded-full px-4 py-2 font-semibold"
                  style={{
                    backgroundColor: hexesValid ? theme.primary : DEFAULT_THEME.primary,
                    color: hexesValid ? theme.secondary : DEFAULT_THEME.secondary,
                    fontFamily: bodyStack,
                    fontSize: '0.875em',
                  }}
                >
                  Sample button
                </span>
              </div>
              <p
                className="m-0"
                data-testid="theme-preview-body"
                style={{ color: '#fff6df', fontFamily: bodyStack, fontSize: '0.875em' }}
              >
                You are warmly invited to celebrate with us.
              </p>
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

const PARTY_VISIBILITY_OPTIONS: { value: PartyVisibilityMode; label: string; description: string }[] = [
  {
    value: 'partner_visible',
    label: 'Partner visible',
    description:
      "The non-subject partner sees their partner's party from the start (they're not the one being surprised), and can reveal it to their partner whenever they choose.",
  },
  {
    value: 'locked',
    label: 'Locked',
    description:
      'The non-subject partner also starts locked out. A coordinator or that party’s Best Man/Maid of Honour grants them in first.',
  },
]

// Wave 3 item 14 D1: the cross-grant visibility dial. Small card, matching
// the house style of the Menu/Theme cards above — deliberately not touching
// either of those.
function PartyVisibilityCard({ settings }: { settings: WeddingSettings }) {
  const updateMutation = useUpdateSettings()
  const [feedback, setFeedback] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const mode = settings.party_visibility_mode

  const setMode = async (value: PartyVisibilityMode) => {
    if (value === mode) return
    setFeedback(null)
    setSaveError(null)
    try {
      await updateMutation.mutateAsync({ party_visibility_mode: value })
      setFeedback('Party visibility saved.')
    } catch (err) {
      setSaveError(err instanceof SettingsApiError ? err.message : 'Unable to save party visibility.')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Party Visibility</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3">
          <p className="text-sm text-gray-600 m-0">
            Controls whether the non-subject partner can see their partner&apos;s Stag/Hen Do
            from the start, or needs to be granted in.
          </p>

          {feedback && (
            <Alert variant="success" role="status" aria-live="polite">
              {feedback}
            </Alert>
          )}
          {saveError && <Alert variant="destructive">{saveError}</Alert>}

          <div role="radiogroup" aria-label="Party visibility" className="grid gap-3">
            {PARTY_VISIBILITY_OPTIONS.map((option) => {
              const active = mode === option.value
              return (
                <label
                  key={option.value}
                  className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer ${
                    active ? 'border-plum bg-plum/5' : 'border-input'
                  }`}
                >
                  <input
                    type="radio"
                    name="party-visibility-mode"
                    className="mt-1"
                    checked={active}
                    disabled={updateMutation.isPending}
                    onChange={() => void setMode(option.value)}
                  />
                  <span className="grid gap-0.5">
                    <span className="text-sm font-medium">{option.label}</span>
                    <span className="text-xs text-gray-500">{option.description}</span>
                  </span>
                </label>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

const LAYOUT_MODE_OPTIONS: { value: LayoutMode; label: string; description: string }[] = [
  {
    value: 'paged',
    label: 'Paged',
    description:
      'Dashboard, RSVP, Schedule and Blessings fill the screen and guests swipe (or use arrow keys) between them — no page scrolling.',
  },
  {
    value: 'scroll',
    label: 'Scroll',
    description: "Today's normal scrolling pages, one after another.",
  },
]

// Wave 4 item 17 Phase 1 (docs/specs/VIEWPORT_PAGING_PHASE1.md): the
// route-level fallback the couple can flip back from if paged navigation
// doesn't work for a guest. Small card, matching the house style of the
// Party Visibility card above — deliberately not touching that one. Stored
// nested in the theme JSONB (layout_mode lives on WeddingTheme, not as its
// own top-level settings field), so saving merges into the existing theme
// object rather than sending a bare top-level field like party_visibility_mode.
function LayoutModeCard({ settings }: { settings: WeddingSettings }) {
  const updateMutation = useUpdateSettings()
  const [feedback, setFeedback] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const mode = themeWithDefaults(settings.theme).layout_mode

  const setMode = async (value: LayoutMode) => {
    if (value === mode) return
    setFeedback(null)
    setSaveError(null)
    try {
      await updateMutation.mutateAsync({
        theme: { ...themeWithDefaults(settings.theme), layout_mode: value },
      })
      setFeedback('Guest page navigation saved.')
    } catch (err) {
      setSaveError(err instanceof SettingsApiError ? err.message : 'Unable to save guest page navigation.')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Guest Page Navigation</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3">
          <p className="text-sm text-gray-600 m-0">
            Controls how guests move between Dashboard, RSVP, Schedule and Blessings.
          </p>

          {feedback && (
            <Alert variant="success" role="status" aria-live="polite">
              {feedback}
            </Alert>
          )}
          {saveError && <Alert variant="destructive">{saveError}</Alert>}

          <div role="radiogroup" aria-label="Guest page navigation" className="grid gap-3">
            {LAYOUT_MODE_OPTIONS.map((option) => {
              const active = mode === option.value
              return (
                <label
                  key={option.value}
                  className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer ${
                    active ? 'border-plum bg-plum/5' : 'border-input'
                  }`}
                >
                  <input
                    type="radio"
                    name="layout-mode"
                    className="mt-1"
                    checked={active}
                    disabled={updateMutation.isPending}
                    onChange={() => void setMode(option.value)}
                  />
                  <span className="grid gap-0.5">
                    <span className="text-sm font-medium">{option.label}</span>
                    <span className="text-xs text-gray-500">{option.description}</span>
                  </span>
                </label>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

const PAGE_BACKGROUND_TABS: { key: PageBackgroundKey; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'rsvp', label: 'RSVP' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'celebrate', label: 'Celebrate' },
  { key: 'wedding_party', label: 'Wedding Party' },
  { key: 'invite', label: 'Invite & Landing' },
]

type BackgroundSourceTab = 'stock' | 'gallery' | 'upload'

const BACKGROUND_SOURCE_TABS: { key: BackgroundSourceTab; label: string }[] = [
  { key: 'gallery', label: 'Gallery' },
  { key: 'stock', label: 'Stock' },
  { key: 'upload', label: 'Upload' },
]

// Every key always present (unlike the stored theme, where an absent key
// means "not customized") — the card always edits the full 6-page map and
// saves it back in one PUT.
function pageBackgroundsWithDefaults(
  theme: WeddingThemeSettings | null,
): Record<PageBackgroundKey, PageBackground> {
  const saved = theme?.page_backgrounds ?? {}
  const result = {} as Record<PageBackgroundKey, PageBackground>
  for (const { key } of PAGE_BACKGROUND_TABS) {
    result[key] = saved[key] ?? DEFAULT_PAGE_BACKGROUNDS[key]
  }
  return result
}

function focalFromPointer(event: ReactPointerEvent<HTMLDivElement>): {
  focal_x: number
  focal_y: number
} {
  const box = event.currentTarget.getBoundingClientRect()
  return {
    focal_x: Math.min(100, Math.max(0, ((event.clientX - box.left) / box.width) * 100)),
    focal_y: Math.min(100, Math.max(0, ((event.clientY - box.top) / box.height) * 100)),
  }
}

// ROADMAP item 18 (docs/specs/PAGE_BACKGROUNDS.md): the couple picks a photo
// per guest page (their own gallery, the 6 stock photos, or an upload) and
// drags on the live preview to set its focal point, then a zoom slider.
// Matching the house card style above — own local state seeded from the
// saved theme, own Save button.
function PageBackgroundsCard({ settings }: { settings: WeddingSettings }) {
  const updateMutation = useUpdateSettings()
  const uploadMutation = useUploadPageBackground()
  const { data: galleryItems } = useApprovedGallery()

  const [backgrounds, setBackgrounds] = useState<Record<PageBackgroundKey, PageBackground>>(() =>
    pageBackgroundsWithDefaults(settings.theme),
  )
  const [activePage, setActivePage] = useState<PageBackgroundKey>('dashboard')
  const [activeSource, setActiveSource] = useState<BackgroundSourceTab>('stock')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const draggingRef = useRef(false)

  useEffect(() => {
    setBackgrounds(pageBackgroundsWithDefaults(settings.theme))
  }, [settings.theme])

  const baseTheme = themeWithDefaults(settings.theme)
  const tint = buildTint(
    isValidHex(baseTheme.secondary) ? baseTheme.secondary : DEFAULT_THEME.secondary,
    baseTheme.tint_opacity,
  )
  const current = backgrounds[activePage]
  const isSaving = updateMutation.isPending

  const updateCurrent = (patch: Partial<PageBackground>) => {
    setBackgrounds((prior) => ({
      ...prior,
      [activePage]: { ...prior[activePage], ...patch },
    }))
  }

  const selectPhoto = (source: PageBackgroundSource, url: string) => {
    // Reset to a neutral focal point/zoom on every photo swap — an old
    // focal point rarely fits a differently-composed new photo.
    updateCurrent({ source, url, focal_x: 50, focal_y: 50, zoom: 1.0 })
  }

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setUploadError(null)
    try {
      const result = await uploadMutation.mutateAsync(file)
      selectPhoto('upload', result.url)
    } catch (err) {
      setUploadError(err instanceof SettingsApiError ? err.message : 'Unable to upload photo.')
    }
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    draggingRef.current = true
    updateCurrent(focalFromPointer(event))
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return
    updateCurrent(focalFromPointer(event))
  }

  const endDrag = () => {
    draggingRef.current = false
  }

  const saveAll = async () => {
    setFeedback(null)
    setSaveError(null)
    try {
      await updateMutation.mutateAsync({
        theme: { ...baseTheme, page_backgrounds: backgrounds },
      })
      setFeedback('Page backgrounds saved — guests will see this from now on.')
    } catch (err) {
      setSaveError(err instanceof SettingsApiError ? err.message : 'Unable to save page backgrounds.')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Page Backgrounds</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          <p className="text-sm text-gray-600 m-0">
            Pick a photo for each guest page, drag on the preview to set its focal point, and
            zoom in or out.
          </p>

          {feedback && (
            <Alert variant="success" role="status" aria-live="polite">
              {feedback}
            </Alert>
          )}
          {saveError && <Alert variant="destructive">{saveError}</Alert>}

          <div
            role="tablist"
            aria-label="Page"
            className="flex flex-wrap gap-1 rounded-md border border-input p-1 w-fit"
          >
            {PAGE_BACKGROUND_TABS.map((tab) => {
              const active = activePage === tab.key
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActivePage(tab.key)}
                  className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                    active ? 'bg-plum text-white' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_260px]">
            <div className="grid gap-2">
              <span className="text-sm font-medium">Preview</span>
              <div
                data-testid="background-preview-box"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                className="relative aspect-video w-full touch-none select-none overflow-hidden rounded-2xl cursor-crosshair"
              >
                <div
                  className="absolute inset-0 bg-cover"
                  style={{
                    backgroundImage: `url(${current.url})`,
                    backgroundPosition: `${current.focal_x}% ${current.focal_y}%`,
                    transform: `scale(${current.zoom})`,
                    transformOrigin: `${current.focal_x}% ${current.focal_y}%`,
                  }}
                />
                <div className="absolute inset-0" style={{ backgroundImage: tint }} />
                <div
                  aria-hidden="true"
                  data-testid="background-focal-point"
                  className="pointer-events-none absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
                  style={{ left: `${current.focal_x}%`, top: `${current.focal_y}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 m-0">
                Click or drag on the photo to set its focal point.
              </p>

              <div className="grid gap-2">
                <Label htmlFor="background-zoom">Zoom ({Math.round(current.zoom * 100)}%)</Label>
                <input
                  id="background-zoom"
                  type="range"
                  min={100}
                  max={250}
                  step={5}
                  value={Math.round(current.zoom * 100)}
                  onChange={(event) => updateCurrent({ zoom: Number(event.target.value) / 100 })}
                  className="w-full accent-plum"
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <Button type="button" disabled={isSaving} onClick={() => void saveAll()}>
                  {isSaving ? 'Saving...' : 'Save all backgrounds'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSaving}
                  onClick={() => updateCurrent(DEFAULT_PAGE_BACKGROUNDS[activePage])}
                >
                  Reset this page&apos;s photo
                </Button>
              </div>
            </div>

            <div className="grid gap-2">
              <div
                role="tablist"
                aria-label="Photo source"
                className="inline-flex w-fit overflow-hidden rounded-md border border-input"
              >
                {BACKGROUND_SOURCE_TABS.map((tab) => {
                  const active = activeSource === tab.key
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setActiveSource(tab.key)}
                      className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                        active ? 'bg-plum text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {tab.label}
                    </button>
                  )
                })}
              </div>

              {activeSource === 'stock' && (
                <div className="grid grid-cols-3 gap-2" aria-label="Stock photos">
                  {STOCK_BACKGROUNDS.map((bg) => {
                    const url = `/backgrounds/${bg.file}`
                    const active = current.source === 'stock' && current.url === url
                    return (
                      <button
                        key={bg.file}
                        type="button"
                        aria-pressed={active}
                        aria-label={bg.label}
                        onClick={() => selectPhoto('stock', url)}
                        className={`aspect-square rounded-md bg-cover bg-center ring-2 transition-shadow ${
                          active ? 'ring-plum' : 'ring-transparent hover:ring-gray-300'
                        }`}
                        style={{ backgroundImage: `url(${url})` }}
                      />
                    )
                  })}
                </div>
              )}

              {activeSource === 'gallery' && (
                <div className="grid grid-cols-3 gap-2" aria-label="Gallery photos">
                  {(galleryItems ?? []).length === 0 && (
                    <p className="col-span-3 text-xs text-gray-500 m-0">
                      No approved gallery photos yet.
                    </p>
                  )}
                  {(galleryItems ?? []).map((item) => {
                    const active = current.source === 'gallery' && current.url === item.url
                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-pressed={active}
                        aria-label={item.title ?? 'Gallery photo'}
                        onClick={() => selectPhoto('gallery', item.url)}
                        className={`aspect-square rounded-md bg-cover bg-center ring-2 transition-shadow ${
                          active ? 'ring-plum' : 'ring-transparent hover:ring-gray-300'
                        }`}
                        style={{ backgroundImage: `url(${item.thumb_url ?? item.url})` }}
                      />
                    )
                  })}
                </div>
              )}

              {activeSource === 'upload' && (
                <div className="grid gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    aria-label="Upload a background photo"
                    disabled={uploadMutation.isPending}
                    onChange={(event) => void handleUpload(event)}
                  />
                  {uploadMutation.isPending && (
                    <p className="text-xs text-gray-500 m-0">Uploading...</p>
                  )}
                  {uploadError && <Alert variant="destructive">{uploadError}</Alert>}
                </div>
              )}
            </div>
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
      setFormError(err instanceof SettingsApiError ? err.message : 'Unable to save settings.')
    }
  }

  return (
    <AdminLayout
      title="Settings"
      breadcrumb={[{ label: 'Dashboard', href: '/admin' }, { label: 'Settings' }]}
    >
      <div className="grid grid-cols-1 gap-4">
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
            {error instanceof Error ? error.message : 'Unable to load settings.'}
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

        {!isLoading && !isError && settings && <LayoutModeCard settings={settings} />}

        {!isLoading && !isError && settings && <PageBackgroundsCard settings={settings} />}

        {!isLoading && !isError && settings && <PartyVisibilityCard settings={settings} />}

        {!isLoading && !isError && settings && <MenuManager />}
      </div>
    </AdminLayout>
  )
}
