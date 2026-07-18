import React from 'react'

import { usePortalTheme } from '@/hooks/useTheme'
import { buildTint, resolvePageBackground } from '@/lib/theme'

interface AuthLayoutProps {
  children: React.ReactNode
  title?: string
  description?: string
}

export function AuthLayout({ children, title, description }: AuthLayoutProps) {
  const theme = usePortalTheme()
  const tint = buildTint(theme.secondary, theme.tint_opacity)
  const background = resolvePageBackground('invite', theme)

  return (
    <div className="min-h-screen flex flex-col text-cream">
      {/* Photo backdrop under the prototype's plum night gradient. Same
          clip-wrapper + photo layer + tint layer split as GuestLayout, so
          the couple's chosen focal point/zoom (ROADMAP item 18) applies here
          too -- see docs/specs/PAGE_BACKGROUNDS.md. */}
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

      {/* Header */}
      <header className="border-b border-gold/40 bg-plum-night/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-full px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src="/backgrounds/cat-seal.jpg"
                alt=""
                className="w-10 h-10 rounded-full object-cover ring-2 ring-gold"
              />
              <h1 className="font-display text-xl font-bold text-cream m-0">
                Ashley &amp; Hazel
              </h1>
            </div>
            <nav className="flex items-center gap-4">
              <a href="/" className="text-sm text-cream/80 hover:text-gold transition-colors">
                Back
              </a>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <div className="relative w-full max-w-[560px]" data-envelope-card>
          {/* Pattern band framing the invitation */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-4 rounded-[34px] border-2 border-dashed border-gold/50 [background:linear-gradient(135deg,rgba(246,196,69,0.1)_25%,transparent_25%)_0_0/26px_26px]"
          />

          <div className="relative rounded-[28px] border-4 border-double border-plum bg-gradient-to-b from-[#fff7e9] to-[#f8e7ad] p-6 sm:p-10 text-center text-plum shadow-2xl">
            <p className="m-0 text-xs font-extrabold uppercase tracking-[0.18em] text-[#b77900]">
              You are warmly invited
            </p>
            <p className="font-display text-5xl sm:text-6xl font-bold my-2 leading-none">
              Ashley <span className="text-[#9b6b00]">&amp;</span> Hazel
            </p>
            <p className="m-0 text-lg font-bold">Saturday 19 June 2027 · Halifax</p>
            <p className="m-0 mt-2 text-sm italic text-plum/80">
              Jamaica and Zimbabwe, a journey through England, and now, Halifax —
              come see where our sliding doors led us.
            </p>

            {title && (
              <div className="mt-6 mb-2">
                <h2 className="text-2xl font-bold m-0">{title}</h2>
                {description && <p className="text-plum/80 m-0 mt-1">{description}</p>}
              </div>
            )}

            {/* Content (invite form) */}
            <div className="mt-6 rounded-3xl bg-plum p-5 text-left text-cream shadow-inner [&_h2]:text-cream [&_h3]:text-cream [&_label]:text-cream">
              {children}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gold/40 bg-plum-night/80 backdrop-blur-sm">
        <div className="max-w-full px-4 py-4 text-center">
          <p className="text-xs sm:text-sm text-cream/90 m-0">
            Your privacy is important to us.{' '}
            <a
              href="/privacy"
              className="text-gold hover:text-gold/80 underline transition-colors"
            >
              Privacy Policy
            </a>
          </p>
        </div>
      </footer>
    </div>
  )
}
