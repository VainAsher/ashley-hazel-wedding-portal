import React, { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { FeedbackWidget } from '@/components/FeedbackWidget'
import { HowThisWorksDialog } from '@/components/HowThisWorksDialog'
import { NotificationsBell } from '@/components/NotificationsBell'
import { PagedGuestDeck, type PagedGuestDeckPage } from '@/components/PagedGuestDeck'
import { usePartyAccess } from '@/hooks/useParty'
import { usePortalTheme } from '@/hooks/useTheme'
import { Button } from '@/components/ui/button'
import { buildTint } from '@/lib/theme'
import { cn } from '@/lib/utils'
import { DashboardContent } from '@/pages/Dashboard'
import { RSVPContent } from '@/pages/RSVP'
import { ScheduleContent } from '@/pages/Schedule'
import { BlessingsContent } from '@/pages/Blessings'

interface GuestLayoutProps {
  children: React.ReactNode
}

// One of the couple's own photos behind every page, under a deep plum
// tint (the prototype's radial night gradient) so cards stay readable.
const ROUTE_BACKGROUNDS: Record<string, string> = {
  '/dashboard': '/backgrounds/bg-02-registry-office.jpg',
  '/rsvp': '/backgrounds/bg-03-waterfall.jpg',
  '/schedule': '/backgrounds/bg-04-woodland-walk.jpg',
  '/blessings': '/backgrounds/bg-01-winter-selfie.jpg',
  '/music': '/backgrounds/bg-05-evening-sky.jpg',
  '/gallery': '/backgrounds/bg-05-evening-sky.jpg',
  '/wedding-party': '/backgrounds/bg-02-registry-office.jpg',
  '/party/stag': '/backgrounds/bg-04-woodland-walk.jpg',
  '/party/hen': '/backgrounds/bg-01-winter-selfie.jpg',
}

// Wave 4 item 17 Phase 1 (docs/specs/VIEWPORT_PAGING_PHASE1.md): the 4 pages
// PagedGuestDeck swipes between. Built inside the component body (not at
// module scope) so it's constructed after Dashboard/RSVP/Schedule/Blessings
// have finished loading regardless of the circular-import load order (each
// of those files imports GuestLayout too, for their own thin route wrapper).
function buildPagedDeckPages(): PagedGuestDeckPage[] {
  return [
    { id: 'dashboard', label: 'Dashboard', path: '/dashboard', content: <DashboardContent /> },
    { id: 'rsvp', label: 'RSVP', path: '/rsvp', content: <RSVPContent /> },
    { id: 'schedule', label: 'Schedule', path: '/schedule', content: <ScheduleContent /> },
    { id: 'blessings', label: 'Blessings', path: '/blessings', content: <BlessingsContent /> },
  ]
}

const PAGED_ROUTES = ['/dashboard', '/rsvp', '/schedule', '/blessings']

export function GuestLayout({ children }: GuestLayoutProps) {
  const { user, logout } = useAuth()
  const { pathname } = useLocation()
  const theme = usePortalTheme()
  // Nav-hint only — every party content endpoint independently re-checks
  // access, so hiding these links is never the security boundary.
  const { data: partyAccess } = usePartyAccess()

  const isPagedRoute = PAGED_ROUTES.includes(pathname)
  const isPagedActive = isPagedRoute && theme.layout_mode === 'paged'

  const pagedDeckPages = isPagedActive ? buildPagedDeckPages() : []
  // Resolved up front (not just from PagedGuestDeck's onIndexChange) so the
  // header's dot indicator shows the right page from the very first paint,
  // with no flash of index 0 before the deck's own effect confirms it.
  const initialPagedIndex = Math.max(0, PAGED_ROUTES.indexOf(pathname))
  const [activePagedIndex, setActivePagedIndex] = useState(initialPagedIndex)

  const backgroundImage = ROUTE_BACKGROUNDS[pathname] ?? ROUTE_BACKGROUNDS['/dashboard']
  const tint = buildTint(theme.secondary, theme.tint_opacity)

  const navigationItems = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'RSVP', href: '/rsvp' },
    { label: 'Schedule', href: '/schedule' },
    { label: 'Blessings', href: '/blessings' },
    { label: 'Dancefloor', href: '/music' },
    { label: 'Gallery', href: '/gallery' },
    // Unlike Stag Do/Hen Do below, this has no gating -- the "Meet the
    // wedding party" directory is open to every logged-in guest.
    { label: 'Wedding Party', href: '/wedding-party' },
    ...(partyAccess?.stag ? [{ label: 'Stag Do', href: '/party/stag' }] : []),
    ...(partyAccess?.hen ? [{ label: 'Hen Do', href: '/party/hen' }] : []),
  ]

  return (
    <div className={cn('flex flex-col', isPagedActive ? 'h-[100dvh] overflow-hidden' : 'min-h-screen')}>
      {/* Fixed photo backdrop with plum tint */}
      <div
        aria-hidden="true"
        className="fixed inset-0 -z-10 bg-cover bg-center"
        style={{ backgroundImage: `${tint}, url(${backgroundImage})` }}
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
          {/* Wraps onto a second row on narrow screens so every page stays
              reachable (an overflow scroller hid Dancefloor + Gallery). */}
          <nav aria-label="Guest pages" className="-mb-px">
            <div className={cn('flex flex-wrap gap-x-6 sm:gap-x-8', isPagedActive && 'items-center')}>
              {navigationItems.map((item) => (
                <NavLink
                  key={item.href}
                  to={item.href}
                  className={({ isActive }) =>
                    cn(
                      'px-1 py-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap no-underline',
                      isActive
                        ? 'text-gold border-gold'
                        : 'text-cream/80 border-transparent hover:text-gold hover:border-gold/60',
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
              {/* Mobile: the dot indicator lives on the nav row instead (the
                  top row is too tight below `sm`). */}
              {isPagedActive && (
                <span className="ml-auto flex gap-1 py-3 sm:hidden" aria-hidden="true">
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
          </nav>
        </div>
      </header>

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
