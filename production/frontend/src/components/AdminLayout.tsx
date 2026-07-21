import React, { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Bug,
  CalendarDays,
  CheckSquare,
  Heart,
  Image as ImageIcon,
  KanbanSquare,
  LayoutDashboard,
  Mail,
  MessageSquare,
  Music2,
  Settings as SettingsIcon,
  Store,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { FeedbackWidget } from '@/components/FeedbackWidget'
import { NotificationsBell } from '@/components/NotificationsBell'
import { usePageTitle } from '@/hooks/usePageTitle'
import { cn } from '@/lib/utils'

interface AdminLayoutProps {
  children: React.ReactNode
  breadcrumb?: Array<{ label: string; href?: string }>
  title?: string
}

interface AdminNavItem {
  label: string
  href: string
  icon: LucideIcon
  // coupleOnly entries are hidden from coordinators — their backing APIs
  // (e.g. /api/invites) are require_couple, so the pages would only error.
  coupleOnly?: boolean
}

// Grouped by what a couple is actually doing when they reach for it, not by
// implementation area — this is the order a wedding gets planned in.
const adminNavGroups: { label: string; items: AdminNavItem[] }[] = [
  {
    label: 'Overview',
    items: [{ label: 'Dashboard', href: '/admin', icon: LayoutDashboard }],
  },
  {
    label: 'Planning',
    items: [
      { label: 'Budget', href: '/admin/budget', icon: Wallet },
      { label: 'Events', href: '/admin/events', icon: CalendarDays },
      { label: 'Timeline', href: '/admin/timeline', icon: KanbanSquare },
      { label: 'Vendors', href: '/admin/vendors', icon: Store },
    ],
  },
  {
    label: 'Guests',
    items: [
      { label: 'Guest list', href: '/guests', icon: Users },
      { label: 'RSVP', href: '/admin/rsvp', icon: CheckSquare },
      { label: 'Invitations', href: '/admin/invitations', icon: Mail, coupleOnly: true },
      { label: 'Communications', href: '/admin/communications', icon: MessageSquare },
    ],
  },
  {
    label: 'Content',
    items: [
      { label: 'Gallery', href: '/admin/gallery', icon: ImageIcon },
      { label: 'Music', href: '/admin/music', icon: Music2 },
      { label: 'Blessings', href: '/admin/blessings', icon: Heart },
    ],
  },
  {
    label: 'Support',
    items: [{ label: 'Feedback', href: '/admin/feedback', icon: Bug }],
  },
  {
    label: 'Settings',
    items: [{ label: 'Settings', href: '/admin/settings', icon: SettingsIcon }],
  },
]

const SIDEBAR_STATE_KEY = 'ah-admin-sidebar-open'

function readStoredSidebarState(): boolean {
  try {
    const stored = window.localStorage.getItem(SIDEBAR_STATE_KEY)
    return stored === null ? true : stored === '1'
  } catch {
    return true
  }
}

export function AdminLayout({ children, breadcrumb, title }: AdminLayoutProps) {
  usePageTitle(title)
  const { user, logout } = useAuth()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(readStoredSidebarState)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  // Persisted across admin navigations: every /admin/* route mounts its own
  // AdminLayout instance (no shared layout route), so local state alone
  // would reset the sidebar to expanded on every click otherwise.
  const toggleSidebar = () => {
    setSidebarOpen((current) => {
      const next = !current
      try {
        window.localStorage.setItem(SIDEBAR_STATE_KEY, next ? '1' : '0')
      } catch {
        // Private browsing / storage disabled: the toggle still works for
        // this page load, it just won't persist to the next one.
      }
      return next
    })
  }

  // Close the mobile drawer on Escape for keyboard/accessibility parity.
  useEffect(() => {
    if (!mobileNavOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileNavOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mobileNavOpen])

  const isCouple = user?.role === 'couple'

  // Shared nav groups, reused by the desktop sidebar and the mobile drawer.
  const visibleNavGroups = adminNavGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.coupleOnly || isCouple),
    }))
    .filter((group) => group.items.length > 0)

  const navGroups = (opts: { showLabels: boolean; onNavigate?: () => void }) => (
    <>
      {visibleNavGroups.map((group) => (
        <div key={group.label} className="mb-4 last:mb-0">
          {opts.showLabels && (
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-cream/40">
              {group.label}
            </p>
          )}
          <div className="space-y-1">
            {group.items.map((item) => {
              const active =
                item.href === '/admin'
                  ? location.pathname === '/admin'
                  : location.pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={opts.onNavigate}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group',
                    active
                      ? 'bg-gold/15 text-gold'
                      : 'text-cream/70 hover:text-gold hover:bg-white/5',
                  )}
                  title={!opts.showLabels ? item.label : undefined}
                >
                  <item.icon className="h-[18px] w-[18px] flex-shrink-0" aria-hidden="true" />
                  {opts.showLabels && (
                    <span className="text-sm font-medium">{item.label}</span>
                  )}
                </Link>
              )
            })}
          </div>
        </div>
      ))}
    </>
  )

  const userSection = (showLabels: boolean) => (
    <div className="border-t border-white/10 p-3 space-y-2">
      {showLabels && (
        <div className="text-xs text-cream/50 px-1">
          <p className="font-semibold text-cream/80 truncate">{user?.name}</p>
          <p className="capitalize">{user?.role}</p>
        </div>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start text-cream/70 hover:text-cream hover:bg-white/10"
        onClick={() => logout().catch(() => {})}
      >
        {showLabels ? 'Log out' : '⏻'}
      </Button>
    </div>
  )

  return (
    <div className="min-h-screen bg-cream/20 flex">
      {/* Desktop sidebar: in-flow on >= sm screens, hidden on mobile (the mobile
          drawer below takes over so admin pages stay reachable on phones). */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-plum-night text-cream transition-all duration-300 flex-col sticky top-0 h-screen hidden sm:flex`}
      >
        {/* Logo */}
        <div className="h-16 border-b border-white/10 flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <img
              src="/backgrounds/cat-seal.jpg"
              alt=""
              className="w-8 h-8 rounded-full object-cover ring-2 ring-gold flex-shrink-0"
            />
            {sidebarOpen && (
              <span className="font-display text-sm font-bold">Ashley &amp; Hazel</span>
            )}
          </div>
          <button
            onClick={toggleSidebar}
            className="p-1 hover:bg-white/10 rounded transition-colors hidden sm:block"
            aria-label="Toggle sidebar"
          >
            <span className="text-lg">{sidebarOpen ? '◀' : '▶'}</span>
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          {navGroups({ showLabels: sidebarOpen })}
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
          <aside className="absolute left-0 top-0 h-full w-64 bg-plum-night text-cream flex flex-col shadow-xl">
            <div className="h-16 border-b border-white/10 flex items-center justify-between px-4">
              <span className="font-display text-sm font-bold">Ashley &amp; Hazel</span>
              <button
                onClick={() => setMobileNavOpen(false)}
                className="p-1 hover:bg-white/10 rounded transition-colors"
                aria-label="Close menu"
              >
                <span className="text-lg">✕</span>
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 overflow-y-auto">
              {navGroups({ showLabels: true, onNavigate: () => setMobileNavOpen(false) })}
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
          <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
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
            {title && (
              <h1 className="font-display text-2xl font-bold text-gray-900">{title}</h1>
            )}
            </div>

            <NotificationsBell variant="admin" />
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
