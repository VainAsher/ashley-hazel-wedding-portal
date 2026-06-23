import React from 'react'

interface AuthLayoutProps {
  children: React.ReactNode
  title?: string
  description?: string
}

export function AuthLayout({ children, title, description }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-white/20 bg-white/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-full px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                <span className="text-white font-bold text-lg">W</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900">Wedding Portal</h1>
            </div>
            <nav className="flex items-center gap-4">
              <a
                href="/"
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Back
              </a>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-[420px]">
          {title && (
            <div className="mb-8 text-center">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">{title}</h2>
              {description && (
                <p className="text-gray-600">{description}</p>
              )}
            </div>
          )}

          {/* Content Card */}
          <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8">
            {children}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/20 bg-white/50 backdrop-blur-sm">
        <div className="max-w-full px-4 py-4 text-center">
          <p className="text-xs sm:text-sm text-gray-600">
            Your privacy is important to us.{' '}
            <a
              href="/privacy"
              className="text-blue-600 hover:text-blue-700 underline transition-colors"
            >
              Privacy Policy
            </a>
          </p>
        </div>
      </footer>
    </div>
  )
}
