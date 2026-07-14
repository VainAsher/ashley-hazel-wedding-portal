import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Hand } from 'lucide-react'

import { Button } from './ui/button'
import { cn } from '@/lib/utils'

export interface PagedGuestDeckPage {
  /** Stable key for the slide (also used in the aria-live announcement). */
  id: string
  /** Human-readable name announced on page change and shown in the header. */
  label: string
  /** Route this slide corresponds to, for the initial-index resolve and the
   * navigate({replace: true}) URL sync on settle. */
  path: string
  content: ReactNode
}

interface PagedGuestDeckProps {
  pages: PagedGuestDeckPage[]
  /** The route the deck is mounting under (deep link or a settled swipe
   * that just remounted GuestLayout) -- resolved to a slide index on mount,
   * synchronously, so there is no visible jump. */
  initialPath: string
  /** Reported on every settled page change, so GuestLayout's own header can
   * show the dot indicator + current page name. */
  onIndexChange?: (index: number) => void
}

// Below this scale factor a page would become illegibly small, so we give up
// shrinking it and fall back to letting that one slide scroll internally
// instead (the fallback docs/specs/VIEWPORT_PAGING_SPIKE.md already proved
// out during the Phase 0 review).
const MIN_FIT_SCALE = 0.62

// Below this viewport width, skip the auto-fit shrink entirely (matches the
// `sm` breakpoint already used elsewhere for mobile/desktop switches). CSS
// `scale()` compresses width and height by the same factor, so shrinking
// height enough to fit on a narrow phone screen also compresses width down
// to a thin column with big empty side margins -- a real bug caught during
// the Phase 0 spike review. Mobile keeps the plain internal-scroll fallback.
const MOBILE_BREAKPOINT_PX = 640

/**
 * Desktop-only auto-fit-to-viewport shrink for one slide's own content,
 * adapted from the Phase 0 spike's `FitToSlide` (see
 * src/components/PagedDeck.tsx in the spike, now deleted). Critically
 * simpler here: GuestLayout renders ONE real header/footer around the whole
 * deck now, not a duplicate per slide, so there is no header/footer to pin
 * and no banner-offset math -- this only measures the slide's own content
 * against the space the slide already has (the deck fills GuestLayout's
 * `<main>` exactly, via flexbox, so no `position: fixed` escape-hatch is
 * needed either).
 */
function FitSlideContent({ children }: { children: ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const outer = outerRef.current
    const inner = innerRef.current
    if (!outer || !inner) {
      return
    }

    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const recompute = () => {
      // Measure at natural size first, so a previous shrink doesn't feed
      // back into the next measurement.
      inner.style.transform = 'none'
      inner.style.marginBottom = ''

      const isMobileViewport =
        typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT_PX
      const availableHeight = outer.clientHeight
      const contentHeight = inner.scrollHeight

      if (
        reduceMotion ||
        isMobileViewport ||
        contentHeight === 0 ||
        availableHeight <= 0 ||
        contentHeight <= availableHeight
      ) {
        return
      }

      const fitted = Math.max(MIN_FIT_SCALE, availableHeight / contentHeight)
      inner.style.transform = `scale(${fitted})`
      inner.style.transformOrigin = 'top center'
      // transform doesn't reflow layout, so without this there would be a
      // blank gap below the now-smaller content equal to the space removed.
      inner.style.marginBottom = `${-(contentHeight * (1 - fitted))}px`
    }

    recompute()
    const observer = new ResizeObserver(recompute)
    observer.observe(outer)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={outerRef} className="h-full w-full overflow-y-auto px-4 sm:px-6 lg:px-8 py-8">
      <div ref={innerRef}>{children}</div>
    </div>
  )
}

/**
 * Viewport-fit horizontal "paged deck" -- the Phase 1 real rollout (Wave 4
 * item 17, docs/specs/VIEWPORT_PAGING_PHASE1.md) of the pattern the couple
 * approved in the Phase 0 spike. Mounted by GuestLayout in place of
 * `{children}` when the current route is one of the 4 paged pages and
 * `layout_mode === 'paged'`.
 *
 * One child per page, each filling the deck's own box (which itself fills
 * GuestLayout's `<main>` via flexbox), laid out in a flex row with CSS
 * scroll-snap so native touch swipe works for free. Desktop gets
 * hover-visible arrow buttons (permanently visible on mobile, which has no
 * hover state) and ArrowLeft/ArrowRight keyboard navigation; every page
 * change is announced via an aria-live region for screen readers, and each
 * slide's content is auto-shrunk (FitSlideContent) on desktop to approximate
 * a single-viewport composition.
 *
 * Swiping/arrow-navigating/keyboard-navigating calls `navigate(path, {
 * replace: true })` on settle, so the address bar reflects the visible page
 * without polluting browser back-history with every swipe.
 */
export function PagedGuestDeck({ pages, initialPath, onIndexChange }: PagedGuestDeckProps) {
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const slideRefs = useRef<Array<HTMLDivElement | null>>([])

  const resolvedInitialIndex = Math.max(
    0,
    pages.findIndex((page) => page.path === initialPath),
  )

  const [currentIndex, setCurrentIndex] = useState(resolvedInitialIndex)
  const [showSwipeHint, setShowSwipeHint] = useState(true)
  const hasSyncedUrlRef = useRef(false)
  // The path the deck's OWN scroll position currently corresponds to --
  // updated both when we scroll (swipe/arrow/keyboard) AND when we notice an
  // external navigation. Lets the effect below tell "the URL changed because
  // WE navigated there" (skip, we're already scrolled to it) apart from "the
  // URL changed because something else navigated" (a real nav-link click, or
  // browser back/forward -- scroll to match, since GuestLayout no longer
  // remounts PagedGuestDeck between the 4 paged routes).
  const lastKnownPathRef = useRef(initialPath)

  // Position at the initial index synchronously, before paint -- no visible
  // jump on first mount (a fresh deep link or a hard reload).
  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }
    const width = container.clientWidth
    container.scrollLeft = resolvedInitialIndex * width
    // Only ever run once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const scrollToIndex = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(index, pages.length - 1))
      const slide = slideRefs.current[clamped]
      if (!slide) {
        return
      }
      setShowSwipeHint(false)
      const reduceMotion =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      slide.scrollIntoView({
        behavior: reduceMotion ? 'auto' : 'smooth',
        block: 'nearest',
        inline: 'start',
      })
    },
    [pages.length],
  )

  // GuestLayout stays mounted across all 4 paged routes now (that's the
  // whole point -- see the doc comment above), so a real nav-link click or a
  // browser back/forward button changes `initialPath` on an ALREADY-MOUNTED
  // deck, not just at mount time. Without this, the URL would update but the
  // deck's own scroll position would silently stay wherever it was (caught
  // during Phase 1 verification: clicking "Blessings" in the nav updated the
  // address bar but left the Dashboard slide showing).
  useEffect(() => {
    if (initialPath === lastKnownPathRef.current) {
      return
    }
    lastKnownPathRef.current = initialPath
    const index = pages.findIndex((page) => page.path === initialPath)
    if (index >= 0) {
      scrollToIndex(index)
    }
    // Only reacting to the route actually changing underneath us.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPath])

  const goToPrevious = useCallback(() => scrollToIndex(currentIndex - 1), [currentIndex, scrollToIndex])
  const goToNext = useCallback(() => scrollToIndex(currentIndex + 1), [currentIndex, scrollToIndex])

  // Native touch swipe (and any other direct scroll) never calls
  // scrollToIndex, so the scroll position itself is the source of truth for
  // "which page are we on" -- used for the arrow buttons, the aria-live
  // announcement, the URL sync, and the header's dot indicator.
  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    let frame: number | null = null
    const handleScroll = () => {
      setShowSwipeHint(false)
      if (frame !== null) {
        return
      }
      frame = window.requestAnimationFrame(() => {
        frame = null
        const width = container.clientWidth || 1
        const index = Math.round(container.scrollLeft / width)
        const clamped = Math.max(0, Math.min(index, pages.length - 1))
        setCurrentIndex((previous) => (previous === clamped ? previous : clamped))
      })
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      container.removeEventListener('scroll', handleScroll)
      if (frame !== null) {
        window.cancelAnimationFrame(frame)
      }
    }
  }, [pages.length])

  // Real URL sync: reflect the visible page in the address bar via replace
  // (not push), so the back button leaves the paged group entirely instead
  // of stepping through each page one swipe at a time. Skipped on the very
  // first render -- the initial index already matches the current URL.
  useEffect(() => {
    if (!hasSyncedUrlRef.current) {
      hasSyncedUrlRef.current = true
      return
    }
    const page = pages[currentIndex]
    if (page) {
      // Record this as OUR OWN navigation before it lands, so the
      // external-navigation effect above doesn't mistake the resulting
      // `initialPath` prop change for a nav-link click or back/forward and
      // redundantly re-scroll to where we already are.
      lastKnownPathRef.current = page.path
      navigate(page.path, { replace: true })
    }
    // Deliberately only reacting to currentIndex changes here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex])

  useEffect(() => {
    onIndexChange?.(currentIndex)
  }, [currentIndex, onIndexChange])

  // All pages stay mounted (so swiping is instant, not a re-render), so
  // without `inert` Tab would walk off the visible slide straight into an
  // off-screen page's form fields, and screen readers would announce
  // duplicate landmarks/widgets. `inert` removes an off-screen slide from
  // both the tab order and the accessibility tree entirely, recursively.
  useEffect(() => {
    slideRefs.current.forEach((slide, index) => {
      if (!slide) {
        return
      }
      if (index === currentIndex) {
        slide.removeAttribute('inert')
      } else {
        slide.setAttribute('inert', '')
      }
    })
  }, [currentIndex])

  // Keyboard nav is registered at the document level (rather than an
  // onKeyDown on the scroller) so it keeps working no matter what currently
  // has focus -- including right after clicking an arrow button, which sits
  // outside the scroller in the DOM and would otherwise swallow the event.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') {
        return
      }

      const target = event.target as HTMLElement | null
      const tag = target?.tagName
      // Don't hijack arrow keys while the guest is typing/selecting inside
      // one of the real pages (RSVP's form fields, dropdowns, etc.).
      const isEditableContext =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        target?.isContentEditable ||
        target?.closest('[role="listbox"], [role="combobox"], [role="dialog"], [role="slider"]') !=
          null

      if (isEditableContext) {
        return
      }

      event.preventDefault()
      if (event.key === 'ArrowRight') {
        goToNext()
      } else {
        goToPrevious()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [goToNext, goToPrevious])

  // The hint is a one-time nudge -- gone as soon as the guest interacts, and
  // never shown at all under prefers-reduced-motion (it's built entirely out
  // of a pulse animation).
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShowSwipeHint(false)
      return
    }
    const timer = window.setTimeout(() => setShowSwipeHint(false), 3200)
    return () => window.clearTimeout(timer)
  }, [])

  const currentPage = pages[currentIndex]

  return (
    <div className="group relative h-full w-full overflow-hidden">
      {/* Screen-reader-only page-change announcement. */}
      <div aria-live="polite" aria-atomic="true" className="sr-only" data-testid="paged-deck-announcer">
        {currentPage
          ? `Page ${currentIndex + 1} of ${pages.length}: ${currentPage.label}`
          : ''}
      </div>

      <div
        ref={containerRef}
        role="group"
        aria-roledescription="carousel"
        aria-label="Guest pages"
        tabIndex={0}
        data-testid="paged-deck"
        className={cn(
          'flex h-full w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden',
          'scroll-smooth motion-reduce:scroll-auto',
          'outline-none',
        )}
      >
        {pages.map((page, index) => (
          <div
            key={page.id}
            ref={(node) => {
              slideRefs.current[index] = node
            }}
            role="group"
            aria-roledescription="slide"
            aria-label={`${index + 1} of ${pages.length}: ${page.label}`}
            data-testid={`paged-deck-slide-${page.id}`}
            className="h-full w-full flex-shrink-0 snap-start"
          >
            <FitSlideContent>{page.content}</FitSlideContent>
          </div>
        ))}
      </div>

      {/* Desktop: hidden until hover/focus. Mobile has no hover state at
          all, so max-sm forces them permanently visible there instead of
          relying on the one-time swipe hint alone. */}
      {currentIndex > 0 && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={goToPrevious}
          aria-label="Previous page"
          className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 text-white opacity-0 transition-opacity hover:bg-black/60 hover:text-white focus-visible:opacity-100 group-hover:opacity-100 max-sm:opacity-100"
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
      )}
      {currentIndex < pages.length - 1 && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={goToNext}
          aria-label="Next page"
          className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/40 text-white opacity-0 transition-opacity hover:bg-black/60 hover:text-white focus-visible:opacity-100 group-hover:opacity-100 max-sm:opacity-100"
        >
          <ChevronRight aria-hidden="true" />
        </Button>
      )}

      {/* One-time swipe affordance: fades out on first interaction or after
          ~3.2s. Purely decorative (aria-hidden) -- the arrow buttons and
          GuestLayout's own header dot indicator are the persistent,
          accessible way to tell there's more. */}
      {showSwipeHint && (
        <div
          aria-hidden="true"
          data-testid="paged-deck-swipe-hint"
          className="pointer-events-none absolute inset-x-0 top-1/2 z-10 flex -translate-y-1/2 justify-center"
        >
          <div className="flex items-center gap-2 rounded-full bg-black/60 px-4 py-2 text-xs font-medium text-white animate-pulse">
            <ChevronLeft className="h-3.5 w-3.5" />
            <Hand className="h-4 w-4" />
            <span>Swipe or use arrow keys</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </div>
        </div>
      )}
    </div>
  )
}
