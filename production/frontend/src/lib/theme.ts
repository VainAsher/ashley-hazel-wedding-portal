// Guest-site theme dials, set by the couple in admin Settings and applied at
// runtime as CSS custom properties. NULL/absent theme = these defaults (the
// original prototype palette).

// Wave 4 item 17 Phase 1 (docs/specs/VIEWPORT_PAGING_PHASE1.md): guest-site
// navigation pattern for Dashboard/RSVP/Schedule/Blessings. The backend
// mirrors this allowlist in app/db/schemas.py (THEME_LAYOUT_MODES).
export type LayoutMode = 'paged' | 'scroll'

// ROADMAP item 18 (docs/specs/PAGE_BACKGROUNDS.md): per-page background
// photo + focal point/zoom, couple-set in admin Settings. Backend mirrors
// this in app/db/schemas.py (PageBackground, PAGE_BACKGROUND_KEYS).
export type PageBackgroundSource = 'stock' | 'gallery' | 'upload'
export type PageBackgroundKey =
  | 'dashboard'
  | 'rsvp'
  | 'schedule'
  | 'celebrate'
  | 'wedding_party'
  | 'invite'

export interface PageBackground {
  source: PageBackgroundSource
  url: string
  focal_x: number
  focal_y: number
  zoom: number
}

export interface WeddingTheme {
  primary: string
  secondary: string
  tint_opacity: number
  display_font: string
  body_font: string
  type_scale: number
  layout_mode: LayoutMode
  page_backgrounds: Partial<Record<PageBackgroundKey, PageBackground>>
}

// ---------------------------------------------------------------------------
// Typography dials — the single frontend source of truth. The backend mirrors
// these allowlists in app/db/schemas.py (THEME_DISPLAY_FONTS /
// THEME_BODY_FONTS); keep both in sync. First entry is the default.
// ---------------------------------------------------------------------------

export interface FontOption {
  /** Canonical name stored in the theme (must match the backend allowlist). */
  value: string
  /** Full CSS font-family stack applied via the CSS custom property. */
  stack: string
  /** Google Fonts css2 family spec — absent for defaults that ship with the
   * site so the out-of-the-box theme loads no extra stylesheet. */
  google?: string
}

export const THEME_DISPLAY_FONTS: FontOption[] = [
  { value: 'Georgia', stack: 'Georgia, "Times New Roman", serif' },
  {
    value: 'Playfair Display',
    stack: '"Playfair Display", Georgia, serif',
    google: 'Playfair+Display:wght@400;600;700',
  },
  {
    value: 'Cormorant Garamond',
    stack: '"Cormorant Garamond", Georgia, serif',
    google: 'Cormorant+Garamond:wght@400;600;700',
  },
  {
    value: 'EB Garamond',
    stack: '"EB Garamond", Georgia, serif',
    google: 'EB+Garamond:wght@400;600;700',
  },
  {
    value: 'Libre Baskerville',
    stack: '"Libre Baskerville", Georgia, serif',
    google: 'Libre+Baskerville:wght@400;700',
  },
  { value: 'Lora', stack: 'Lora, Georgia, serif', google: 'Lora:wght@400;600;700' },
  { value: 'Marcellus', stack: 'Marcellus, Georgia, serif', google: 'Marcellus' },
  { value: 'Great Vibes', stack: '"Great Vibes", Georgia, cursive', google: 'Great+Vibes' },
]

export const THEME_BODY_FONTS: FontOption[] = [
  // Inter is already bundled via global.css — the site default costs nothing.
  { value: 'Inter', stack: 'Inter, system-ui, sans-serif' },
  {
    value: 'Source Sans 3',
    stack: '"Source Sans 3", Inter, system-ui, sans-serif',
    google: 'Source+Sans+3:wght@400;600;700',
  },
  {
    value: 'Nunito Sans',
    stack: '"Nunito Sans", Inter, system-ui, sans-serif',
    google: 'Nunito+Sans:wght@400;600;700',
  },
  {
    value: 'Karla',
    stack: 'Karla, Inter, system-ui, sans-serif',
    google: 'Karla:wght@400;600;700',
  },
  {
    value: 'Mulish',
    stack: 'Mulish, Inter, system-ui, sans-serif',
    google: 'Mulish:wght@400;600;700',
  },
]

export const THEME_TYPE_SCALES = [0.9, 1.0, 1.1] as const

export const DEFAULT_THEME: WeddingTheme = {
  primary: '#f6c445',
  secondary: '#2b064d',
  tint_opacity: 0.9,
  display_font: THEME_DISPLAY_FONTS[0].value,
  body_font: THEME_BODY_FONTS[0].value,
  type_scale: 1.0,
  layout_mode: 'paged',
  page_backgrounds: {},
}

// ---------------------------------------------------------------------------
// Per-page backgrounds (ROADMAP item 18, docs/specs/PAGE_BACKGROUNDS.md)
// ---------------------------------------------------------------------------

// Mirrors production/frontend/public/backgrounds/*.jpg and the backend's
// STOCK_BACKGROUND_FILES allowlist — keep all three in sync.
export const STOCK_BACKGROUNDS: { file: string; label: string }[] = [
  { file: 'bg-01-winter-selfie.jpg', label: 'Winter selfie' },
  { file: 'bg-02-registry-office.jpg', label: 'Registry office' },
  { file: 'bg-03-waterfall.jpg', label: 'Waterfall' },
  { file: 'bg-04-woodland-walk.jpg', label: 'Woodland walk' },
  { file: 'bg-05-evening-sky.jpg', label: 'Evening sky' },
  { file: 'bg-06-registry-candid.jpg', label: 'Registry candid' },
]

// Reproduces today's ROUTE_BACKGROUNDS values at the neutral focal point/zoom
// that renders identically to plain bg-cover/bg-center — this is what keeps
// an uncustomized wedding (theme.page_backgrounds missing a key, or the whole
// theme null) visually unchanged until the couple actively picks a photo.
export const DEFAULT_PAGE_BACKGROUNDS: Record<PageBackgroundKey, PageBackground> = {
  dashboard: {
    source: 'stock',
    url: '/backgrounds/bg-02-registry-office.jpg',
    focal_x: 50,
    focal_y: 50,
    zoom: 1.0,
  },
  rsvp: {
    source: 'stock',
    url: '/backgrounds/bg-03-waterfall.jpg',
    focal_x: 50,
    focal_y: 50,
    zoom: 1.0,
  },
  schedule: {
    source: 'stock',
    url: '/backgrounds/bg-04-woodland-walk.jpg',
    focal_x: 50,
    focal_y: 50,
    zoom: 1.0,
  },
  celebrate: {
    source: 'stock',
    url: '/backgrounds/bg-05-evening-sky.jpg',
    focal_x: 50,
    focal_y: 50,
    zoom: 1.0,
  },
  wedding_party: {
    source: 'stock',
    url: '/backgrounds/bg-02-registry-office.jpg',
    focal_x: 50,
    focal_y: 50,
    zoom: 1.0,
  },
  invite: {
    source: 'stock',
    url: '/backgrounds/bg-06-registry-candid.jpg',
    focal_x: 50,
    focal_y: 50,
    zoom: 1.0,
  },
}

/**
 * Resolves key-by-key against DEFAULT_PAGE_BACKGROUNDS, independent of
 * themeWithDefaults()'s shallow merge (Settings.tsx) — so guest-facing
 * rendering never depends on that admin-only merge behaviour.
 */
export function resolvePageBackground(
  key: PageBackgroundKey,
  theme: WeddingTheme,
): PageBackground {
  return theme.page_backgrounds?.[key] ?? DEFAULT_PAGE_BACKGROUNDS[key]
}

export function findDisplayFont(value: string | undefined): FontOption {
  return THEME_DISPLAY_FONTS.find((font) => font.value === value) ?? THEME_DISPLAY_FONTS[0]
}

export function findBodyFont(value: string | undefined): FontOption {
  return THEME_BODY_FONTS.find((font) => font.value === value) ?? THEME_BODY_FONTS[0]
}

const THEME_FONTS_LINK_ID = 'ah-theme-fonts'
const FONT_PREVIEW_LINK_ID = 'ah-theme-fonts-preview'

export function buildGoogleFontsHref(specs: string[]): string {
  const families = specs.map((spec) => `family=${spec}`).join('&')
  return `https://fonts.googleapis.com/css2?${families}&display=swap`
}

/**
 * Keep a single Google Fonts <link> in sync with the theme's font choices.
 * Defaults (Georgia + Inter) need nothing from Google, so the link is removed
 * entirely and the site stays dependency-free out of the box.
 */
function syncGoogleFontsLink(fonts: FontOption[]): void {
  const specs = fonts.map((font) => font.google).filter((spec): spec is string => Boolean(spec))
  const existing = document.getElementById(THEME_FONTS_LINK_ID)

  if (specs.length === 0) {
    existing?.remove()
    return
  }

  const href = buildGoogleFontsHref(specs)
  if (existing instanceof HTMLLinkElement) {
    if (existing.href !== href) {
      existing.href = href
    }
    return
  }

  const link = document.createElement('link')
  link.id = THEME_FONTS_LINK_ID
  link.rel = 'stylesheet'
  link.href = href
  document.head.appendChild(link)
}

/**
 * Load every allowlisted Google family once, so the admin font pickers can
 * render each option (and the live preview) in its real face. Admin-only —
 * the guest site never calls this.
 */
export function ensureFontPreviewStylesheet(): void {
  if (document.getElementById(FONT_PREVIEW_LINK_ID)) {
    return
  }

  const specs = [...THEME_DISPLAY_FONTS, ...THEME_BODY_FONTS]
    .map((font) => font.google)
    .filter((spec): spec is string => Boolean(spec))

  const link = document.createElement('link')
  link.id = FONT_PREVIEW_LINK_ID
  link.rel = 'stylesheet'
  link.href = buildGoogleFontsHref(specs)
  document.head.appendChild(link)
}

interface Hsl {
  h: number
  s: number
  l: number
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const value = hex.replace('#', '')
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  }
}

function hexToHsl(hex: string): Hsl {
  const { r, g, b } = hexToRgb(hex)
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const delta = max - min
  const l = (max + min) / 2

  let h = 0
  let s = 0
  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1))
    if (max === rn) {
      h = 60 * (((gn - bn) / delta) % 6)
    } else if (max === gn) {
      h = 60 * ((bn - rn) / delta + 2)
    } else {
      h = 60 * ((rn - gn) / delta + 4)
    }
  }
  if (h < 0) {
    h += 360
  }

  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) }
}

/** "#f6c445" -> "43 91% 62%" — the space-separated triplet the tokens use. */
function triplet({ h, s, l }: Hsl): string {
  return `${h} ${s}% ${l}%`
}

/**
 * The plum-night radial gradient from the prototype, built from the theme's
 * secondary colour and the couple's chosen tint strength. The three stops
 * darken toward the corner so photos glow through the top-left.
 */
export function buildTint(secondary: string, opacity: number): string {
  const { h, s, l } = hexToHsl(secondary)
  const stop = (lightness: number, alpha: number) =>
    `hsl(${h} ${s}% ${lightness}% / ${Math.min(alpha, 1).toFixed(2)})`

  return (
    `radial-gradient(circle at top left, ` +
    `${stop(Math.min(l * 1.6, 40), opacity)}, ` +
    `${stop(l * 0.45, Math.min(opacity + 0.05, 1))} 55%, ` +
    `${stop(l * 0.2, Math.min(opacity + 0.08, 1))})`
  )
}

/** Apply the theme as CSS custom properties on <html>. */
export function applyTheme(theme: WeddingTheme): void {
  const root = document.documentElement
  const primary = hexToHsl(theme.primary)
  const secondary = hexToHsl(theme.secondary)

  root.style.setProperty('--primary', triplet(primary))
  root.style.setProperty('--primary-foreground', triplet(secondary))
  root.style.setProperty('--secondary', triplet(secondary))
  root.style.setProperty('--secondary-foreground', triplet(primary))
  root.style.setProperty('--ring', triplet({ ...secondary, l: Math.min(secondary.l + 14, 60) }))

  // Derived tints: hover accent and form borders follow the primary hue.
  root.style.setProperty('--accent', triplet({ h: primary.h, s: 89, l: 90 }))
  root.style.setProperty('--border', triplet({ h: primary.h, s: 55, l: 72 }))
  root.style.setProperty('--input', triplet({ h: primary.h, s: 55, l: 72 }))

  // Named prototype colours used by the layouts (bg-gold, text-plum, ...).
  root.style.setProperty('--theme-gold', triplet(primary))
  root.style.setProperty('--theme-plum', triplet(secondary))
  root.style.setProperty(
    '--theme-plum-night',
    triplet({ h: secondary.h, s: secondary.s, l: Math.max(Math.round(secondary.l * 0.4), 3) }),
  )

  // Typography dials. Older stored themes may predate these keys — fall back
  // to the defaults (first allowlist entry) so the site always has a stack.
  const displayFont = findDisplayFont(theme.display_font)
  const bodyFont = findBodyFont(theme.body_font)
  root.style.setProperty('--font-display', displayFont.stack)
  root.style.setProperty('--font-sans', bodyFont.stack)

  const typeScale = theme.type_scale ?? 1.0
  root.style.fontSize = typeScale === 1.0 ? '' : `${Math.round(typeScale * 100)}%`

  syncGoogleFontsLink([displayFont, bodyFont])
}
