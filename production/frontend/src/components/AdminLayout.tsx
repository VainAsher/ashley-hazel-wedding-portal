import React, { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'

interface AdminLayoutProps {
  children: React.ReactNode
  breadcrumb?: Array<{ label: string; href?: string }>
  title?: string
}

export function AdminLayout({ children, breadcrumb, title }: AdminLayoutProps) {
  const { user, logout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const adminMenuItems = [
    { label: 'Dashboard', href: '/admin/dashboard', icon: '📊' },
    { label: 'Guests', href: '/admin/guests', icon: '👥' },
    { label: 'Invitations', href: '/admin/invitations', icon: '📧' },
    { label: 'RSVP', href: '/admin/rsvp', icon: '✅' },
    { label: 'Events', href: '/admin/events', icon: '📅' },
    { label: 'Gallery', href: '/admin/gallery', icon: '🖼️' },
    { label: 'Settings', href: '/admin/settings', icon: '⚙️' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar: off-canvas on mobile, in-flow on >= sm screens so it never
          squeezes the main content on narrow viewports. */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-gray-900 text-white transition-all duration-300 flex-col sticky top-0 h-screen hidden sm:flex`}
      >
        {/* Logo */}
        <div className="h-16 border-b border-gray-800 flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-400 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-xs">W</span>
            </div>
            {sidebarOpen && <span className="font-bold text-sm">Wedding</span>}
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 hover:bg-gray-800 rounded transition-colors hidden sm:block"
            aria-label="Toggle sidebar"
          >
            <span className="text-lg">{sidebarOpen ? '◀' : '▶'}</span>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-2 overflow-y-auto">
          {adminMenuItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors group"
              title={!sidebarOpen ? item.label : undefined}
            >
              <span className="text-lg flex-shrink-0">{item.icon}</span>
              {sidebarOpen && (
                <span className="text-sm font-medium group-hover:text-blue-300 transition-colors">
                  {item.label}
                </span>
              )}
            </a>
          ))}
        </nav>

        {/* User Section */}
        <div className="border-t border-gray-800 p-3 space-y-2">
          {sidebarOpen && (
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
            {sidebarOpen ? '🚪 Logout' : '🚪'}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Header */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
          <div className="px-4 sm:px-6 lg:px-8 py-4">
            {/* Breadcrumb */}
            {breadcrumb && breadcrumb.length > 0 && (
              <nav className="mb-3 flex items-center gap-2 text-sm text-gray-600">
                {breadcrumb.map((item, index) => (
                  <React.Fragment key={index}>
                    {index > 0 && <span>/</span>}
                    {item.href ? (
                      <a
                        href={item.href}
                        className="text-blue-600 hover:text-blue-700 underline"
                      >
                        {item.label}
                      </a>
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
    </div>
  )
}
