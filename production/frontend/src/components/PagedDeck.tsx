import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { ChevronLeft, ChevronRight, Hand } from 'lucide-react'

import { Button } from './ui/button'
import { cn } from '@/lib/utils'

export interface PagedDeckPage {
  /** Stable key for the slide (also used in the aria-live announcement). */
  id: string
  /** Human-readable name announced on page change, e.g. "RSVP". */
  label: string
  content: ReactNode
}

export interface PagedDeckHandle {
  /** Imperative jump used by an external nav (e.g. the preview's burger menu). */
  goToIndex: (index: number) => void
}

interface PagedDeckProps {
  pages: PagedDeckPage[]
  /** Reported on every settled page change, for an external burger-menu nav. */
  onIndexChange?: (index: number) => void
}

// Below this scale factor a page would become illegibly small, so we give up
// shrinking it and fall back to letting that one slide scroll internally
// instead (exactly the fallback docs/specs/VIEWPORT_PAGING_SPIKE.md already
// accepted for content that can't reasonably be compressed).
const MIN_FIT_SCALE = 0.62

// Below this viewport width, skip the auto-fit shrink entirely (matches the
// `sm` breakpoint already used for the mobile nav/burger-menu switch). The
// couple's own single-viewport ask was specifically about desktop screen
// real estate; on a narrow phone screen there's no width to spare, so
// CSS `scale()` compressing height ALSO compresses width by the same
// factor, leaving big empty side margins and a thin column of tiny content
// (caught in review: "content margins seem quite large ... small thin area
// in the middle"). Mobile keeps the plain internal-scroll fallback instead.
const MOBILE_BREAKPOINT_PX = 640

/**
 * Measures each embedded page's `<main>` against the available height and
 * shrinks JUST that element (CSS `transform: scale`) so a normal, unmodified
 * page composes into one screen instead of needing to scroll. Rough-pass
 * only, and desktop-only (see MOBILE_BREAKPOINT_PX) — this is a blanket
 * shrink, not the real per-page composition work (item 18) — some pages
 * will still hit MIN_FIT_SCALE and keep an internal scrollbar, same as
 * before.
 *
 * Scoped to `<main>` specifically, NOT the whole page tree: a CSS `transform`
 * on an ancestor makes that ancestor the containing block for any
 * `position: fixed` descendant (a CSS spec quirk), which broke
 * GuestLayout's `<FeedbackWidget>` (position: fixed) the first time this was
 * built wrapping everything — its "fixed" position started resolving
 * relative to the scaled wrapper instead of the real viewport, so it visibly
 * detached from its usual bottom-right corner (caught during couple review:
 * two "Feedback" pills painting at different screen positions). `<main>` and
 * `<FeedbackWidget>` are siblings inside GuestLayout, not ancestor/descendant,
 * so scaling `<main>` alone leaves the widget's real fixed positioning intact.
 */
function FitToSlide({ children }: { children: ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const outer = outerRef.current
    if (!outer) {
      return
    }

    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const recompute = () => {
      const main = outer.querySelector('main')
      if (!main) {
        return
      }
      const header = outer.querySelector('header')
      const footer = outer.querySelector('footer')

      // Measure at natural size first, so a previous shrink doesn't feed
      // back into the next measurement.
      main.style.transform = 'none'
      main.style.marginBottom = ''

      const isMobileViewport =
        typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT_PX

      const headerHeight = header?.getBoundingClientRect().height ?? 0
      const footerHeight = footer?.getBoundingClientRect().height ?? 0
      const availableHeight = outer.clientHeight - headerHeight - footerHeight
      const contentHeight = main.scrollHeight

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
      main.style.transform = `scale(${fitted})`
      main.style.transformOrigin = 'top center'
      // transform doesn't reflow layout, so without this the footer would
      // sit exactly where it did before the shrink, leaving a blank gap
      // under the now-smaller content. Pull it up by exactly the amount
      // visually removed.
      main.style.marginBottom = `${-(contentHeight * (1 - fitted))}px`
    }

    recompute()
    const observer = new ResizeObserver(recompute)
    observer.observe(outer)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={outerRef} className="h-full w-full overflow-y-auto">
      {children}
    </div>
  )
}

/**
 * Viewport-fit horizontal "paged deck" — Phase 0 spike (Wave 4 item 17).
 *
 * One child per page, each `100vw` / `100dvh`, laid out in a flex row with
 * CSS scroll-snap so native touch swipe works for free. Desktop gets
 * hover-visible arrow buttons and ArrowLeft/ArrowRight keyboard navigation;
 * every page change is announced via an aria-live region for screen readers.
 * Dot indicators + a one-time swipe hint make the gesture discoverable, and
 * each slide's content is auto-shrunk (FitToSlide) to approximate a real
 * single-viewport composition without touching the real page components.
 *
 * This is a throwaway prototype shell (see docs/specs/VIEWPORT_PAGING_SPIKE.md)
 * — it intentionally does not touch GuestLayout or any guest page.
 */
export const PagedDeck = forwardRef<PagedDeckHandle, PagedDeckProps>(function PagedDeck(
  { pages, onIndexChange },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const slideRefs = useRef<Array<HTMLDivElement | null>>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showSwipeHint, setShowSwipeHint] = useState(true)

  const scrollToIndex = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(index, pages.length - 1))
      const slide = slideRefs.current[clamped]
      if (!slide) {
        return
      }
      setShowSwipeHint(false)
      // prefers-reduced-motion: jump directly instead of smooth-scrolling.
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

  useImperativeHandle(ref, () => ({ goToIndex: scrollToIndex }), [scrollToIndex])

  const goToPrevious = useCallback(() => scrollToIndex(currentIndex - 1), [currentIndex, scrollToIndex])
  const goToNext = useCallback(() => scrollToIndex(currentIndex + 1), [currentIndex, scrollToIndex])

  // Native touch swipe (and any other direct scroll) never calls
  // scrollToIndex, so the scroll position itself is the source of truth for
  // "which page are we on" — used for the arrow buttons and the aria-live
  // announcement.
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

  useEffect(() => {
    onIndexChange?.(currentIndex)
  }, [currentIndex, onIndexChange])

  // All 4 pages stay mounted (so swiping is instant, not a re-render), but
  // each is a FULL page including its own header/nav/footer -- without this,
  // Tab would walk off the visible slide straight into an off-screen page's
  // form fields, and screen readers would announce 4 duplicate "Logout"
  // buttons / nav landmarks. `inert` removes an off-screen slide from both
  // the tab order and the accessibility tree entirely, recursively, which
  // plain `tabIndex`/`aria-hidden` on the wrapper alone cannot do.
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

  // Keyboard nav is registered at the document level (rather than as an
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
    <div className="group relative h-[100dvh] w-full overflow-hidden bg-black">
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
        aria-label="Prototype preview pages"
        tabIndex={0}
        data-testid="paged-deck"
        className={cn(
          'flex h-[100dvh] w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden',
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
            className="h-[100dvh] w-screen flex-shrink-0 snap-start"
          >
            <FitToSlide>{page.content}</FitToSlide>
          </div>
        ))}
      </div>

      {/* Desktop: hidden until hover/focus (a quiet affordance once the
          swipe hint below has done its job). Mobile has no hover state at
          all, so these stayed invisible there permanently -- the couple
          only ever saw the transient swipe hint fade after ~3s and nothing
          after (reported as "the hints/floaties disappeared"). max-sm
          forces them permanently visible below the same breakpoint used
          for the burger-menu switch, so touch users always have a
          persistent, not just one-time, cue that there's another page. */}
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
          ~3s. Purely decorative (aria-hidden) -- the arrow buttons and the
          caller's own page indicator (see onIndexChange) are the persistent,
          accessible way to tell there's more. Placed mid-screen rather than
          at the top or bottom -- every embedded page has real header/footer
          content pinned to both those edges, so a fixed screen position
          there would overlap it on at least one of the 4 pages. */}
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
})
