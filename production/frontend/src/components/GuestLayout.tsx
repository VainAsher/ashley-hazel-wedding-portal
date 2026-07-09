import React from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface GuestLayoutProps {
  children: React.ReactNode
}

export function GuestLayout({ children }: GuestLayoutProps) {
  const { user, logout } = useAuth()

  const navigationItems = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'RSVP', href: '/rsvp' },
    { label: 'Schedule', href: '/schedule' },
    { label: 'Blessings', href: '/blessings' },
    { label: 'Gallery', href: '/gallery' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo/Brand */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-lg">W</span>
              </div>
              <div className="flex flex-col">
                <h1 className="text-lg font-bold text-gray-900">Wedding Portal</h1>
                <p className="text-xs text-gray-500">Guest Portal</p>
              </div>
            </div>

            {/* User Info & Logout */}
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">
                  {user?.name || 'Guest'}
                </p>
                <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => logout().catch(() => {})}
              >
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8 overflow-x-auto">
            {navigationItems.map((item) => (
              <NavLink
                key={item.href}
                to={item.href}
                className={({ isActive }) =>
                  cn(
                    'px-1 py-4 text-sm font-medium transition-colors border-b-2 whitespace-nowrap',
                    isActive
                      ? 'text-gray-900 border-blue-600'
                      : 'text-gray-600 border-transparent hover:text-gray-900 hover:border-blue-600',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer (Optional) */}
      <footer className="bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-sm text-gray-600">
            Questions? Contact us at{' '}
            <a
              href="mailto:Ajandrews210888@aol.com"
              className="text-blue-600 hover:text-blue-700 underline"
            >
              Ajandrews210888@aol.com
            </a>
          </p>
        </div>
      </footer>
    </div>
  )
}
