import { useEffect, useRef, useState, type RefObject } from 'react'
import { Menu, X } from 'lucide-react'

import { PagedDeck, type PagedDeckHandle, type PagedDeckPage } from '../components/PagedDeck'
import { usePageTitle } from '../hooks/usePageTitle'
import { Blessings } from './Blessings'
import { Dashboard } from './Dashboard'
import { RSVP } from './RSVP'
import { Schedule } from './Schedule'

// Phase 0 spike (Wave 4 item 17, docs/specs/VIEWPORT_PAGING_SPIKE.md).
//
// A throwaway prototype, deliberately isolated from the live guest
// experience: a brand-new admin-gated route rendering the same 4 guest
// pages (unmodified, real data) inside a horizontal swipeable deck instead
// of the normal scrolling GuestLayout flow. If the couple says "no-go",
// this file, PagedDeck.tsx, and the /preview route can be deleted with zero
// impact on anything else in the app.
const PREVIEW_PAGES: PagedDeckPage[] = [
  { id: 'dashboard', label: 'Dashboard', content: <Dashboard /> },
  { id: 'rsvp', label: 'RSVP', content: <RSVP /> },
  { id: 'schedule', label: 'Schedule', content: <Schedule /> },
  { id: 'blessings', label: 'Blessings', content: <Blessings /> },
]

// Couple feedback (2026-07-13) on the first look at this spike: mobile
// should get a burger menu rather than the live nav's wrap-to-second-row
// treatment. Each embedded page renders its own GuestLayout (deliberately
// unmodified, per spec), so this can't be done by editing that shared
// component without touching the live guest experience. Instead: hide that
// per-page nav row on narrow viewports with CSS scoped to this route only,
// and add a preview-only burger menu that drives the SAME deck navigation
// as swiping/arrow keys.
function MobileNavOverride() {
  return (
    <style>{`
      @media (max-width: 639px) {
        .wave4-preview-shell nav[aria-label="Guest pages"] {
          display: none;
        }
      }
    `}</style>
  )
}

// Every mounted page's <header> is pinned to the same real screen position
// by FitToSlide (see PagedDeck.tsx), so querying for just one gives the
// header's true on-screen bottom edge. A plain useEffect (not
// useLayoutEffect) is deliberate here: React runs every useLayoutEffect in
// a commit before any useEffect in that same commit, so this always reads
// the header AFTER FitToSlide has already pinned and offset it below the
// banner -- avoiding a hardcoded pixel guess that silently drifted out of
// sync the moment the header's own height changed (caught in review: the
// burger button ended up overlapping the header's Logout button once the
// header was pushed down to clear the banner).
function useFixedHeaderBottom(): number {
  const [bottom, setBottom] = useState(0)

  useEffect(() => {
    const recompute = () => {
      const header = document.querySelector('header')
      setBottom(header ? header.getBoundingClientRect().bottom : 0)
    }
    recompute()

    const header = document.querySelector('header')
    const observer = new ResizeObserver(recompute)
    if (header) {
      observer.observe(header)
    }
    window.addEventListener('resize', recompute)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', recompute)
    }
  }, [])

  return bottom
}

function BurgerMenu({ deckRef }: { deckRef: RefObject<PagedDeckHandle | null> }) {
  const [open, setOpen] = useState(false)
  const headerBottom = useFixedHeaderBottom()

  return (
    <div
      className="fixed right-3 z-[70] sm:hidden"
      style={{ top: headerBottom > 0 ? headerBottom + 8 : 44 }}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={open ? 'Close page menu' : 'Open page menu'}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white shadow-lg"
      >
        {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Preview pages"
          className="absolute right-0 top-12 w-40 overflow-hidden rounded-lg bg-white text-sm shadow-xl"
        >
          {PREVIEW_PAGES.map((page, index) => (
            <button
              key={page.id}
              type="button"
              role="menuitem"
              onClick={() => {
                deckRef.current?.goToIndex(index)
                setOpen(false)
              }}
              className="block w-full px-4 py-2.5 text-left text-gray-900 hover:bg-gray-100"
            >
              {page.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function PreviewPaged() {
  usePageTitle('Preview (prototype)')
  const deckRef = useRef<PagedDeckHandle>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  return (
    <div className="wave4-preview-shell relative h-[100dvh] w-full overflow-hidden">
      <MobileNavOverride />

      {/* Fixed (not absolute) so it stays pinned above every slide's own
          content, including each guest page's own sticky header, no matter
          how far the guest scrolls a slide's internal content. The dot
          pagination lives here (not inside PagedDeck) because this banner is
          the one guaranteed-empty spot across all 4 embedded pages -- every
          other screen edge has real header/footer content from GuestLayout
          pinned to it, so dots placed at the top or bottom of the deck
          itself overlapped that content on every page. */}
      <div
        role="status"
        data-testid="preview-banner"
        className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 bg-yellow-300 px-3 py-1 text-center text-xs font-semibold uppercase tracking-wide text-black"
      >
        <span className="hidden sm:inline">Prototype — internal review only</span>
        <span className="sm:hidden">Prototype</span>
        <span aria-hidden="true">·</span>
        {/* Couple feedback (2026-07-13): with the arrows/dots/hint, there
            was still nothing naming WHICH page is showing -- this is that,
            live-updated from PagedDeck's onIndexChange. */}
        <span data-testid="preview-current-page-name" className="font-bold">
          {PREVIEW_PAGES[activeIndex]?.label}
        </span>
        <span className="flex gap-1" aria-hidden="true">
          {PREVIEW_PAGES.map((page, index) => (
            <span
              key={page.id}
              className={`h-1.5 w-1.5 rounded-full ${
                index === activeIndex ? 'bg-black' : 'bg-black/25'
              }`}
            />
          ))}
        </span>
      </div>

      <BurgerMenu deckRef={deckRef} />

      <PagedDeck ref={deckRef} pages={PREVIEW_PAGES} onIndexChange={setActiveIndex} />
    </div>
  )
}
