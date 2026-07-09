// Guest-site theme dials, set by the couple in admin Settings and applied at
// runtime as CSS custom properties. NULL/absent theme = these defaults (the
// original prototype palette).

export interface WeddingTheme {
  primary: string
  secondary: string
  tint_opacity: number
}

export const DEFAULT_THEME: WeddingTheme = {
  primary: '#f6c445',
  secondary: '#2b064d',
  tint_opacity: 0.9,
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
}
