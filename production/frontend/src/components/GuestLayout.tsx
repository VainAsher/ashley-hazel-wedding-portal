import React, { useEffect, useState } from 'react'
import { Link, Navigate, NavLink, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { FeedbackWidget } from '@/components/FeedbackWidget'
import { HowThisWorksDialog } from '@/components/HowThisWorksDialog'
import { NotificationsBell } from '@/components/NotificationsBell'
import { PagedGuestDeck, type PagedGuestDeckPage } from '@/components/PagedGuestDeck'
import { usePartyAccess } from '@/hooks/useParty'
import { usePortalTheme } from '@/hooks/useTheme'
import { Button } from '@/components/ui/button'
import { buildTint, resolvePageBackground, type PageBackground, type PageBackgroundKey } from '@/lib/theme'
import { cn } from '@/lib/utils'
import { DashboardContent } from '@/pages/Dashboard'
import { RSVPContent } from '@/pages/RSVP'
import { ScheduleContent } from '@/pages/Schedule'
import { CelebrateContent } from '@/pages/Celebrate'
import { WeddingPartyContent } from '@/pages/WeddingParty'
import { PartyContent } from '@/pages/Party'
import type { PartyAccess } from '@/hooks/useParty'

interface GuestLayoutProps {
  children: React.ReactNode
}

// One of the couple's own photos behind every page, under a deep plum
// tint (the prototype's radial night gradient) so cards stay readable.
const ROUTE_BACKGROUNDS: Record<string, string> = {
  '/dashboard': '/backgrounds/bg-02-registry-office.jpg',
  '/rsvp': '/backgrounds/bg-03-waterfall.jpg',
  '/schedule': '/backgrounds/bg-04-woodland-walk.jpg',
  '/celebrate': '/backgrounds/bg-05-evening-sky.jpg',
  '/wedding-party': '/backgrounds/bg-02-registry-office.jpg',
  '/party/stag': '/backgrounds/bg-04-woodland-walk.jpg',
  '/party/hen': '/backgrounds/bg-01-winter-selfie.jpg',
}

// ROADMAP item 18 (docs/specs/PAGE_BACKGROUNDS.md): routes the couple can
// set a custom background/focal-point/zoom for. Stag/Hen are deliberately
// excluded from v1 -- they keep resolving through ROUTE_BACKGROUNDS above.
const PAGE_BACKGROUND_ROUTE_KEYS: Partial<Record<string, PageBackgroundKey>> = {
  '/dashboard': 'dashboard',
  '/rsvp': 'rsvp',
  '/schedule': 'schedule',
  '/celebrate': 'celebrate',
  '/wedding-party': 'wedding_party',
}

// Wave 4 item 17 Phase 1 (docs/specs/VIEWPORT_PAGING_PHASE1.md), expanded
// 2026-07-14 to every guest page: PagedGuestDeck swipes between all of a
// guest's pages, not just Dashboard/RSVP/Schedule/Blessings. Unlike those
// original 4 (identical for every guest), this list is now guest-specific --
// a guest's own Stag or Hen party page joins the set (never both, matching
// the existing party access rule), mirroring the exact same conditional
// inclusion already used for `navigationItems` below. Built inside the
// component body (not at module scope) so it's constructed after every
// *Content component has finished loading regardless of the circular-import
// load order (each of those files imports GuestLayout too, for their own
// thin route wrapper).
function buildPagedDeckPages(partyAccess: PartyAccess | undefined): PagedGuestDeckPage[] {
  return [
    { id: 'dashboard', label: 'Dashboard', path: '/dashboard', content: <DashboardContent /> },
    { id: 'rsvp', label: 'RSVP', path: '/rsvp', content: <RSVPContent /> },
    { id: 'schedule', label: 'Schedule', path: '/schedule', content: <ScheduleContent /> },
    { id: 'celebrate', label: 'Celebrate', path: '/celebrate', content: <CelebrateContent /> },
    { id: 'wedding-party', label: 'Wedding Party', path: '/wedding-party', content: <WeddingPartyContent /> },
    ...(partyAccess?.stag
      ? [{ id: 'party-stag', label: 'Stag Do', path: '/party/stag', content: <PartyContent party="stag" /> }]
      : []),
    ...(partyAccess?.hen
      ? [{ id: 'party-hen', label: 'Hen Do', path: '/party/hen', content: <PartyContent party="hen" /> }]
      : []),
  ]
}

export function GuestLayout({ children }: GuestLayoutProps) {
  const { user, logout } = useAuth()
  const { pathname } = useLocation()
  const theme = usePortalTheme()
  // Nav-hint only — every party content endpoint independently re-checks
  // access, so hiding these links is never the security boundary.
  const { data: partyAccess } = usePartyAccess()

  // Guest-specific (a stag/hen guest's own party page joins the set) --
  // computed unconditionally so route-membership can be checked against it
  // directly, rather than maintaining a second static list that has to stay
  // in sync by hand. Cheap even when it won't end up rendered: this just
  // builds plain descriptor objects, it doesn't mount anything.
  // docs/specs/VIEW_AS_GUEST_PREVIEW.md: the couple's own read-only look at
  // the guest experience, under a distinct /preview/* path prefix (not a
  // query param -- the nav links below are plain `to={href}` `NavLink`s, so
  // a query param would silently drop on the second click between tabs).
  const isPreview = pathname.startsWith('/preview/')
  const routePath = isPreview ? pathname.slice('/preview'.length) : pathname

  const pagedDeckPages = buildPagedDeckPages(partyAccess)
  const isPagedRoute = pagedDeckPages.some((page) => page.path === pathname)
  // Guests only. A couple member can reach /party/:party (RequireGuestOrCouple
  // -- viewing/revealing their partner's party), but has no route-level
  // access to Dashboard/RSVP/Schedule/Blessings/Music/Gallery/Wedding Party
  // at all. The deck renders each page's *Content directly, bypassing those
  // routes' own RequireGuest guards entirely -- so a couple ending up with a
  // paged deck would silently mount pages they aren't supposed to be able to
  // reach. Simplest correct fix: couples always get today's plain
  // single-page rendering, regardless of layout_mode, since paging a
  // single-page access pattern doesn't mean anything anyway.
  const isPagedActive = isPagedRoute && theme.layout_mode === 'paged' && user?.role === 'guest'

  // Resolved up front (not just from PagedGuestDeck's onIndexChange) so the
  // header's dot indicator shows the right page from the very first paint,
  // with no flash of index 0 before the deck's own effect confirms it.
  const initialPagedIndex = Math.max(
    0,
    pagedDeckPages.findIndex((page) => page.path === pathname),
  )
  const [activePagedIndex, setActivePagedIndex] = useState(initialPagedIndex)

  // Mobile guest nav (below `sm`): a real burger menu, matching what the
  // couple approved in the Phase 0 `/preview` spike -- see the nav markup
  // below for why this replaced the old wrap-to-second-row treatment.
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  useEffect(() => {
    setMobileNavOpen(false)
  }, [pathname])

  // App.tsx's shared PagedGuestLayoutRoute gates on RequireGuestOrCouple --
  // the widest permission any nested child needs, since a couple member can
  // reach /party/:party (viewing/revealing their partner's party, per Wave
  // 3's access rule). Every OTHER guest page is guest-only; restoring that
  // narrower restriction here (via the already-fetched useAuth() context,
  // not a second RequireGuest guard re-fetching /api/auth/me) matches
  // today's exact access rule without doubling the auth request per guest
  // page load. Placed after every hook call above (not as an early return
  // interleaved with them) so the hook call order never changes between
  // renders, even if pathname changes while this same GuestLayout instance
  // stays mounted (the whole point of nesting every guest route under one
  // shared layout route).
  if (user?.role === 'couple' && !isPreview && !pathname.startsWith('/party/')) {
    return <Navigate replace to="/admin" />
  }

  // ROADMAP item 18 (docs/specs/PAGE_BACKGROUNDS.md): routes the couple can
  // customize a background for resolve through theme.page_backgrounds;
  // everything else (Stag/Hen for now) keeps the legacy static map.
  const pageBackgroundKey = PAGE_BACKGROUND_ROUTE_KEYS[routePath]
  const background: PageBackground = pageBackgroundKey
    ? resolvePageBackground(pageBackgroundKey, theme)
    : {
        source: 'stock',
        url: ROUTE_BACKGROUNDS[routePath] ?? ROUTE_BACKGROUNDS['/dashboard'],
        focal_x: 50,
        focal_y: 50,
        zoom: 1.0,
      }
  const tint = buildTint(theme.secondary, theme.tint_opacity)

  const baseNavigationItems = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'RSVP', href: '/rsvp' },
    { label: 'Schedule', href: '/schedule' },
    { label: 'Celebrate', href: '/celebrate' },
    // Unlike Stag Do/Hen Do below, this has no gating -- the "Meet the
    // wedding party" directory is open to every logged-in guest.
    { label: 'Wedding Party', href: '/wedding-party' },
  ]
  // Preview mode prefixes every href so tab-to-tab clicks stay under
  // /preview/* -- a plain href would land back on the real (redirect-
  // blocked) route. Stag/Hen are excluded from the preview nav entirely:
  // party pages are the couple's own real, already-shipped feature
  // (/party/:party), not something to preview.
  const navigationItems = isPreview
    ? baseNavigationItems.map((item) => ({ ...item, href: `/preview${item.href}` }))
    : [
        ...baseNavigationItems,
        ...(partyAccess?.stag ? [{ label: 'Stag Do', href: '/party/stag' }] : []),
        ...(partyAccess?.hen ? [{ label: 'Hen Do', href: '/party/hen' }] : []),
      ]
  const currentNavLabel = navigationItems.find((item) => item.href === pathname)?.label

  return (
    <div className={cn('flex flex-col', isPagedActive ? 'h-[100dvh] overflow-hidden' : 'min-h-screen')}>
      {/* Fixed photo backdrop with plum tint. Split into a clip wrapper +
          photo layer + tint layer (rather than one combined multi-background
          div) so a per-page focal point/zoom (item 18) can transform just
          the photo without distorting the tint -- see
          docs/specs/PAGE_BACKGROUNDS.md for the geometry reasoning. */}
      <div aria-hidden="true" className="fixed inset-0 -z-10 overflow-hidden">
        <div
          data-testid="guest-backdrop-photo"
          className="absolute inset-0 bg-cover"
          style={{
            backgroundImage: `url(${background.url})`,
            backgroundPosition: `${background.focal_x}% ${background.focal_y}%`,
            transform: `scale(${background.zoom})`,
            transformOrigin: `${background.focal_x}% ${background.focal_y}%`,
          }}
        />
        <div className="absolute inset-0" style={{ backgroundImage: tint }} />
      </div>

      {/* Decorative sunflower & lavender frame -- above the tint, below all
          content. White centre keyed to transparent so only the corners
          (and a soft watercolour wash) show. */}
      <div
        aria-hidden="true"
        className="fixed inset-0 -z-[5] bg-cover bg-center"
        style={{ backgroundImage: 'url(/backgrounds/frame-sunflower-lavender.webp)' }}
      />

      {/* Header */}
      <header className="bg-plum-night/90 backdrop-blur border-b border-gold/40 sticky top-0 z-50 text-cream">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Brand seal */}
            <div className="flex items-center gap-3">
              <img
                src="/backgrounds/cat-seal.jpg"
                alt=""
                className="w-11 h-11 rounded-full object-cover ring-2 ring-gold flex-shrink-0"
              />
              <div className="flex flex-col">
                <p className="m-0 font-display text-lg leading-tight text-cream">
                  Ashley &amp; Hazel's Wedding Portal
                </p>
                <p className="m-0 text-xs text-gold">Saturday 19 June 2027 · Halifax</p>
              </div>
            </div>

            {/* User Info & Logout */}
            <div className="flex items-center gap-4">
              {/* Paged-mode-only: which of the 4 swipeable pages is showing.
                  Lives in the header (not a separate banner) -- see
                  docs/specs/VIEWPORT_PAGING_PHASE1.md. */}
              {isPagedActive && (
                <div
                  className="hidden items-center gap-2 sm:flex"
                  data-testid="paged-nav-indicator"
                >
                  <span
                    data-testid="paged-current-page-name"
                    className="text-xs font-semibold text-gold"
                  >
                    {pagedDeckPages[activePagedIndex]?.label}
                  </span>
                  <span className="flex gap-1" aria-hidden="true">
                    {pagedDeckPages.map((page, index) => (
                      <span
                        key={page.id}
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          index === activePagedIndex ? 'bg-gold' : 'bg-cream/30',
                        )}
                      />
                    ))}
                  </span>
                </div>
              )}
              <NotificationsBell variant="guest" />
              <div className="text-right hidden sm:block">
                <p className="m-0 text-sm font-medium text-cream">{user?.name || 'Guest'}</p>
                <p className="m-0 text-xs capitalize text-gold">{user?.role}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-foreground"
                onClick={() => logout().catch(() => {})}
              >
                Logout
              </Button>
            </div>
          </div>

          {/* Navigation */}
          {/* Desktop (sm+): every page directly visible in one row, as
              always. Below `sm`, this used to wrap onto a second row instead
              -- fine for the original 4 pages, but cramped and cluttered now
              that there are up to 8. Replaced with a real burger menu
              matching what the couple approved in the Phase 0 `/preview`
              spike (docs/specs/VIEWPORT_PAGING_SPIKE.md), built for real
              here instead of as a preview-only CSS hack. One set of links in
              the DOM either way -- only the container's layout/visibility
              classes differ by breakpoint and open state, so there's never a
              duplicate, ambiguous "Blessings" link to trip over. */}
          <nav aria-label="Guest pages" className="-mb-px relative">
            <div className="flex items-center justify-between py-3 sm:hidden">
              <button
                type="button"
                onClick={() => setMobileNavOpen((value) => !value)}
                aria-expanded={mobileNavOpen}
                aria-controls="guest-nav-links"
                // An aria-label overrides all descendant text for the
                // accessible name, so it must spell out the current page
                // itself -- otherwise a screen reader user would hear only
                // "Open guest pages menu" with no indication of where they
                // are, even though sighted users see the page name right
                // on the button.
                aria-label={`${mobileNavOpen ? 'Close' : 'Open'} guest pages menu — currently ${currentNavLabel ?? 'Menu'}`}
                className="flex items-center gap-2 text-sm font-medium text-cream"
              >
                {mobileNavOpen ? (
                  <X className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Menu className="h-4 w-4" aria-hidden="true" />
                )}
                <span data-testid="mobile-nav-current-page">{currentNavLabel ?? 'Menu'}</span>
              </button>
              {/* Mobile: the dot indicator lives next to the burger trigger
                  instead of the (now hidden by default) row of links. */}
              {isPagedActive && (
                <span className="flex gap-1" aria-hidden="true">
                  {pagedDeckPages.map((page, index) => (
                    <span
                      key={page.id}
                      className={cn(
                        'h-1.5 w-1.5 rounded-full',
                        index === activePagedIndex ? 'bg-gold' : 'bg-cream/30',
                      )}
                    />
                  ))}
                </span>
              )}
            </div>

            <div
              id="guest-nav-links"
              className={cn(
                'gap-x-6 sm:flex sm:flex-wrap sm:gap-x-8',
                isPagedActive && 'sm:items-center',
                mobileNavOpen
                  ? 'absolute inset-x-0 top-full z-40 flex flex-col gap-0 rounded-b-lg bg-plum-night pb-2 shadow-xl sm:static sm:z-auto sm:flex-row sm:rounded-none sm:bg-transparent sm:pb-0 sm:shadow-none'
                  : 'hidden sm:flex',
              )}
            >
              {navigationItems.map((item) => (
                <NavLink
                  key={item.href}
                  to={item.href}
                  onClick={() => setMobileNavOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'px-4 py-2.5 text-sm font-medium no-underline transition-colors sm:border-b-2 sm:px-1 sm:py-3 sm:whitespace-nowrap',
                      isActive
                        ? 'text-gold sm:border-gold'
                        : 'text-cream/80 hover:text-gold sm:border-transparent sm:hover:border-gold/60',
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </nav>
        </div>
      </header>

      {/* Preview banner (docs/specs/VIEW_AS_GUEST_PREVIEW.md) -- the "easy
          accessibility... back to admin" the redesign asked for. Plain
          in-flow block (not sticky): the header above it isn't a fixed
          height (its nav row wraps/collapses by breakpoint), so pinning
          this underneath it would require guessing that height. */}
      {isPreview && (
        <div className="bg-gold text-plum-night" data-testid="preview-banner">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex flex-wrap items-center justify-between gap-2">
            <p className="m-0 text-sm font-medium">
              You're previewing the guest experience — this is what guests see.
            </p>
            <Link to="/admin" className="text-sm font-semibold underline hover:no-underline">
              Exit preview
            </Link>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main
        className={cn(
          'flex-1 w-full',
          isPagedActive ? 'overflow-hidden' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8',
        )}
      >
        {isPagedActive ? (
          <PagedGuestDeck
            pages={pagedDeckPages}
            initialPath={pathname}
            onIndexChange={setActivePagedIndex}
          />
        ) : (
          children
        )}
      </main>

      {/* Footer */}
      <footer className="bg-plum-night/90 backdrop-blur border-t border-gold/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col items-center gap-3">
            <p className="text-center text-sm text-cream/90 m-0">
              Questions? Contact us at{' '}
              <a
                href="mailto:Ajandrews210888@aol.com"
                className="text-gold hover:text-gold/80 underline"
              >
                Ajandrews210888@aol.com
              </a>
            </p>
            <HowThisWorksDialog />
          </div>
        </div>
      </footer>

      <FeedbackWidget />
    </div>
  )
}
