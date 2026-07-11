import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { FeedbackWidget } from '@/components/FeedbackWidget'
import { usePageTitle } from '@/hooks/usePageTitle'

interface AdminLayoutProps {
  children: React.ReactNode
  breadcrumb?: Array<{ label: string; href?: string }>
  title?: string
}

// coupleOnly entries are hidden from coordinators — their backing APIs
// (e.g. /api/invites) are require_couple, so the pages would only error.
const adminMenuItems = [
  { label: 'Dashboard', href: '/admin', icon: '📊' },
  { label: 'Guests', href: '/guests', icon: '👥' },
  { label: 'Invitations', href: '/admin/invitations', icon: '📧', coupleOnly: true },
  { label: 'RSVP', href: '/admin/rsvp', icon: '✅' },
  { label: 'Budget', href: '/admin/budget', icon: '💰' },
  { label: 'Events', href: '/admin/events', icon: '📅' },
  { label: 'Timeline', href: '/admin/timeline', icon: '🗓️' },
  { label: 'Communications', href: '/admin/communications', icon: '💬' },
  { label: 'Vendors', href: '/admin/vendors', icon: '🏪' },
  { label: 'Gallery', href: '/admin/gallery', icon: '🖼️' },
  { label: 'Music', href: '/admin/music', icon: '🎵' },
  { label: 'Blessings', href: '/admin/blessings', icon: '💌' },
  { label: 'Feedback', href: '/admin/feedback', icon: '🐞' },
  { label: 'Settings', href: '/admin/settings', icon: '⚙️' },
]

export function AdminLayout({ children, breadcrumb, title }: AdminLayoutProps) {
  usePageTitle(title)
  const { user, logout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  // Close the mobile drawer on Escape for keyboard/accessibility parity.
  useEffect(() => {
    if (!mobileNavOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileNavOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mobileNavOpen])

  // Shared nav links, reused by the desktop sidebar and the mobile drawer.
  const visibleMenuItems = adminMenuItems.filter(
    (item) => !item.coupleOnly || user?.role === 'couple',
  )
  const navLinks = (opts: { showLabels: boolean; onNavigate?: () => void }) =>
    visibleMenuItems.map((item) => (
      <Link
        key={item.href}
        to={item.href}
        onClick={opts.onNavigate}
        className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-200 hover:text-gold hover:bg-gray-800 transition-colors group"
        title={!opts.showLabels ? item.label : undefined}
      >
        <span className="text-lg flex-shrink-0">{item.icon}</span>
        {opts.showLabels && (
          <span className="text-sm font-medium group-hover:text-gold transition-colors">
            {item.label}
          </span>
        )}
      </Link>
    ))

  const userSection = (showLabels: boolean) => (
    <div className="border-t border-gray-800 p-3 space-y-2">
      {showLabels && (
        <div className="text-xs text-gray-400">
          <p className="font-semibold text-gray-300 truncate">{user?.name}</p>
          <p className="capitalize text-gray-500">{user?.role}</p>
        </div>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start text-gray-300 hover:text-white hover:bg-gray-800"
        onClick={() => logout().catch(() => {})}
      >
        {showLabels ? '🚪 Logout' : '🚪'}
      </Button>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Desktop sidebar: in-flow on >= sm screens, hidden on mobile (the mobile
          drawer below takes over so admin pages stay reachable on phones). */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-gray-900 text-white transition-all duration-300 flex-col sticky top-0 h-screen hidden sm:flex`}
      >
        {/* Logo */}
        <div className="h-16 border-b border-gray-800 flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <img
              src="/backgrounds/cat-seal.jpg"
              alt=""
              className="w-8 h-8 rounded-full object-cover ring-2 ring-gold flex-shrink-0"
            />
            {sidebarOpen && <span className="font-bold text-sm">Ashley &amp; Hazel</span>}
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 hover:bg-gray-800 rounded transition-colors hidden sm:block"
            aria-label="Toggle sidebar"
          >
            <span className="text-lg">{sidebarOpen ? '◀' : '▶'}</span>
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-2 overflow-y-auto">
          {navLinks({ showLabels: sidebarOpen })}
        </nav>

        {userSection(sidebarOpen)}
      </aside>

      {/* Mobile drawer + backdrop: only rendered on small screens when opened. */}
      {mobileNavOpen && (
        <div
          id="admin-mobile-nav"
          className="fixed inset-0 z-50 sm:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
        >
          <div
            className="absolute inset-0 bg-black/50"
            aria-hidden="true"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-64 bg-gray-900 text-white flex flex-col shadow-xl">
            <div className="h-16 border-b border-gray-800 flex items-center justify-between px-4">
              <span className="font-bold text-sm">Wedding</span>
              <button
                onClick={() => setMobileNavOpen(false)}
                className="p-1 hover:bg-gray-800 rounded transition-colors"
                aria-label="Close menu"
              >
                <span className="text-lg">✕</span>
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-2 overflow-y-auto">
              {navLinks({ showLabels: true, onNavigate: () => setMobileNavOpen(false) })}
            </nav>
            {userSection(true)}
          </aside>
        </div>
      )}

      {/* Main Content. min-w-0 lets this flex column shrink below its content's
          intrinsic width so wide tables scroll inside their own overflow-x
          container instead of forcing the whole page to scroll horizontally
          (which otherwise destabilizes header controls on narrow viewports). */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
          <div className="px-4 sm:px-6 lg:px-8 py-4">
            {/* Mobile menu trigger — only on screens below the sm breakpoint,
                where the desktop sidebar is hidden. */}
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="sm:hidden mb-3 inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              aria-label="Open menu"
              aria-expanded={mobileNavOpen}
              aria-controls="admin-mobile-nav"
            >
              <span className="text-base">☰</span> Menu
            </button>

            {/* Breadcrumb */}
            {breadcrumb && breadcrumb.length > 0 && (
              <nav className="mb-3 flex items-center gap-2 text-sm text-gray-600">
                {breadcrumb.map((item, index) => (
                  <React.Fragment key={index}>
                    {index > 0 && <span>/</span>}
                    {item.href ? (
                      <Link
                        to={item.href}
                        className="text-plum hover:text-plum/80 underline"
                      >
                        {item.label}
                      </Link>
                    ) : (
                      <span className="text-gray-900 font-medium">{item.label}</span>
                    )}
                  </React.Fragment>
                ))}
              </nav>
            )}

            {/* Title */}
            {title && <h1 className="text-2xl font-bold text-gray-900">{title}</h1>}
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8 overflow-auto">
          {children}
        </main>
      </div>

      <FeedbackWidget />
    </div>
  )
}
