import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

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
  '/gallery': '/backgrounds/bg-05-evening-sky.jpg',
}

const PLUM_TINT =
  'radial-gradient(circle at top left, rgba(43, 6, 77, 0.86), rgba(22, 0, 31, 0.92) 55%, rgba(8, 0, 13, 0.95))'

export function GuestLayout({ children }: GuestLayoutProps) {
  const { user, logout } = useAuth()
  const { pathname } = useLocation()

  const backgroundImage = ROUTE_BACKGROUNDS[pathname] ?? ROUTE_BACKGROUNDS['/dashboard']

  const navigationItems = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'RSVP', href: '/rsvp' },
    { label: 'Schedule', href: '/schedule' },
    { label: 'Blessings', href: '/blessings' },
    { label: 'Gallery', href: '/gallery' },
  ]

  return (
    <div className="min-h-screen flex flex-col">
      {/* Fixed photo backdrop with plum tint */}
      <div
        aria-hidden="true"
        className="fixed inset-0 -z-10 bg-cover bg-center"
        style={{ backgroundImage: `${PLUM_TINT}, url(${backgroundImage})` }}
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
          <nav aria-label="Guest pages" className="-mb-px">
            <div className="flex space-x-8 overflow-x-auto">
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
            </div>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-plum-night/90 backdrop-blur border-t border-gold/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-sm text-cream/90 m-0">
            Questions? Contact us at{' '}
            <a
              href="mailto:Ajandrews210888@aol.com"
              className="text-gold hover:text-gold/80 underline"
            >
              Ajandrews210888@aol.com
            </a>
          </p>
        </div>
      </footer>
    </div>
  )
}
