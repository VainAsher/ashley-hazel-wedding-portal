import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Mail } from 'lucide-react'

/**
 * Save-The-Date envelope reveal (ROADMAP Wave 1 item 5).
 *
 * On first visit per browser session the invite page renders as a closed
 * plum envelope with the prototype's cat wax seal. It stays sealed until the
 * guest taps it; then the flap lifts, the invitation card grows out from the
 * envelope, and a one-shot confetti sprinkle in the prototype palette falls
 * over the page.
 *
 * - `prefers-reduced-motion: reduce` skips straight to the open card.
 * - A sessionStorage flag makes it play once per session; a tiny envelope
 *   icon-button lets guests replay it.
 * - Tests pre-seed the flag via addInitScript (tests/browser/fixtures/
 *   page-cleanup.ts) so existing specs always see the open state.
 */

export const ENVELOPE_SESSION_KEY = 'ah-envelope-opened'

// The envelope is drawn this much larger than the revealed card on every
// side, so the card always plausibly fits inside it.
const ENVELOPE_EXCESS = 48

const OPEN_SETTLE_MS = 1200
const CONFETTI_DELAY_MS = 450
const CONFETTI_DURATION_MS = 2000

type Phase = 'closed' | 'opening' | 'open'

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

function hasOpenedThisSession(): boolean {
  try {
    return window.sessionStorage.getItem(ENVELOPE_SESSION_KEY) === '1'
  } catch {
    return false
  }
}

function markOpenedThisSession(): void {
  try {
    window.sessionStorage.setItem(ENVELOPE_SESSION_KEY, '1')
  } catch {
    // Private browsing / storage disabled: the reveal simply replays next visit.
  }
}

interface ConfettiParticle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  rotation: number
  spin: number
}

/**
 * One-shot confetti sprinkle: ~110 small plum/gold/cream rectangles burst
 * from just above the card, fall under gravity, and fade over ~2s.
 * Plain requestAnimationFrame on an inline canvas — no library.
 */
function ConfettiBurst({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) {
      onDoneRef.current()
      return
    }

    const width = window.innerWidth
    const height = window.innerHeight
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    context.scale(dpr, dpr)

    // Prototype palette: deep plum, sun gold, cream, aged gold.
    const colors = ['#2b064d', '#f6c445', '#fff6df', '#d99a1f']
    const particles: ConfettiParticle[] = Array.from({ length: 110 }, (_, i) => {
      const angle = Math.random() * Math.PI * 2
      const speed = 110 + Math.random() * 260
      return {
        x: width / 2 + (Math.random() - 0.5) * 60,
        y: height * 0.34,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 190,
        size: 5 + Math.random() * 5,
        color: colors[i % colors.length],
        rotation: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 9,
      }
    })

    const gravity = 880
    let frame = 0
    let startedAt: number | null = null
    let lastAt = 0

    const tick = (now: number) => {
      if (startedAt === null) {
        startedAt = now
        lastAt = now
      }
      const elapsed = now - startedAt
      const dt = Math.min((now - lastAt) / 1000, 0.05)
      lastAt = now

      context.clearRect(0, 0, width, height)
      if (elapsed >= CONFETTI_DURATION_MS) {
        onDoneRef.current()
        return
      }

      // Hold full opacity for the burst, then fade out over the tail.
      const fadeFrom = CONFETTI_DURATION_MS * 0.55
      const alpha =
        elapsed < fadeFrom ? 1 : 1 - (elapsed - fadeFrom) / (CONFETTI_DURATION_MS - fadeFrom)

      for (const particle of particles) {
        particle.vy += gravity * dt
        particle.x += particle.vx * dt
        particle.y += particle.vy * dt
        particle.rotation += particle.spin * dt

        context.save()
        context.globalAlpha = alpha
        context.translate(particle.x, particle.y)
        context.rotate(particle.rotation)
        context.fillStyle = particle.color
        context.fillRect(
          -particle.size / 2,
          -particle.size / 2,
          particle.size,
          particle.size * 0.62,
        )
        context.restore()
      }

      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <canvas
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[70] h-full w-full"
      data-testid="confetti-canvas"
      ref={canvasRef}
    />
  )
}

interface EnvelopeRevealProps {
  children: ReactNode
}

export function EnvelopeReveal({ children }: EnvelopeRevealProps) {
  const [phase, setPhase] = useState<Phase>(() =>
    prefersReducedMotion() || hasOpenedThisSession() ? 'open' : 'closed',
  )
  const [confetti, setConfetti] = useState(false)
  const [cardSize, setCardSize] = useState<{ width: number; height: number } | null>(
    null,
  )
  const cardWrapRef = useRef<HTMLDivElement | null>(null)
  const timersRef = useRef<number[]>([])

  // While sealed, the card renders invisibly underneath the overlay so it can
  // be measured — the envelope is then drawn ENVELOPE_EXCESS larger than it.
  useEffect(() => {
    if (phase !== 'closed') return
    const wrapper = cardWrapRef.current
    if (!wrapper) return
    const card = wrapper.querySelector('[data-envelope-card]') ?? wrapper
    const measure = () => {
      const rect = card.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        setCardSize({ width: rect.width, height: rect.height })
      }
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(card)
    return () => observer.disconnect()
  }, [phase])

  useEffect(() => {
    const timers = timersRef.current
    return () => timers.forEach((id) => window.clearTimeout(id))
  }, [])

  const open = useCallback(() => {
    markOpenedThisSession()

    if (prefersReducedMotion()) {
      setPhase('open')
      return
    }

    setPhase('opening')
    timersRef.current.push(
      window.setTimeout(() => setConfetti(true), CONFETTI_DELAY_MS),
      window.setTimeout(() => setPhase('open'), OPEN_SETTLE_MS),
    )
  }, [])

  const replay = useCallback(() => {
    setConfetti(false)
    setPhase('closed')
  }, [])

  const revealing = phase !== 'open'

  return (
    <>
      <style>{`
        @keyframes env-card-enter {
          from { opacity: 0; transform: translateY(90px) scale(0.68); }
          60% { opacity: 1; }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes env-hint-pulse {
          0%, 100% { opacity: 0.65; }
          50% { opacity: 1; }
        }
        .env-card-enter { animation: env-card-enter 900ms cubic-bezier(0.22, 1, 0.36, 1) 250ms both; }
        .env-hint { animation: env-hint-pulse 2.2s ease-in-out infinite; }
        .env-flap {
          clip-path: polygon(0 0, 100% 0, 50% 96%);
          transform-origin: top center;
          backface-visibility: hidden;
          transition: transform 700ms cubic-bezier(0.33, 1, 0.5, 1);
        }
        .env-flap-open { transform: rotateX(178deg); }
        @media (prefers-reduced-motion: reduce) {
          .env-card-enter, .env-hint { animation: none; }
          .env-flap { transition: none; }
        }
      `}</style>

      {/* The invitation card. Rendered invisibly (for measuring) while sealed. */}
      <div
        aria-hidden={phase === 'closed' || undefined}
        className={
          phase === 'closed'
            ? 'invisible'
            : phase === 'opening'
              ? 'env-card-enter'
              : undefined
        }
        ref={cardWrapRef}
      >
        {children}
      </div>

      {/* Sealed envelope overlay */}
      {revealing && (
        <div
          className={`fixed inset-0 z-[60] flex items-center justify-center overflow-hidden bg-plum-night px-6 transition-opacity duration-500 ${
            phase === 'opening' ? 'pointer-events-none opacity-0 delay-500' : 'opacity-100'
          }`}
          style={{
            backgroundImage:
              'radial-gradient(circle at 50% 30%, rgba(246, 196, 69, 0.14), transparent 60%)',
          }}
        >
          <button
            aria-label="Open your invitation"
            className="relative block w-full max-w-[720px] cursor-pointer border-0 bg-transparent p-0 text-left outline-none focus-visible:ring-4 focus-visible:ring-gold/80"
            onClick={open}
            type="button"
          >
            <span className="block text-center font-display text-xs font-extrabold uppercase tracking-[0.22em] text-gold">
              You are warmly invited
            </span>

            <span className="mt-5 block" style={{ perspective: '900px' }}>
              <span
                className={`relative mx-auto block rounded-xl border-2 border-gold/70 bg-gradient-to-b from-[#41125f] to-[#2b064d] shadow-[0_24px_60px_rgba(0,0,0,0.6)] ${
                  cardSize ? '' : 'aspect-[10/7] w-full max-w-[520px]'
                }`}
                data-testid="envelope-body"
                style={{
                  transformStyle: 'preserve-3d',
                  ...(cardSize && {
                    width: `min(${Math.round(cardSize.width) + ENVELOPE_EXCESS * 2}px, calc(100vw - 2rem))`,
                    height: `min(${Math.round(cardSize.height) + ENVELOPE_EXCESS * 2}px, calc(100vh - 9rem))`,
                  }),
                }}
              >
                {/* Letter peeking out of the pocket */}
                <span className="absolute inset-x-[8%] bottom-[10%] top-[12%] rounded-md bg-gradient-to-b from-[#fff7e9] to-[#f8e7ad]" />

                {/* Side + bottom folds of the pocket */}
                <span
                  className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#37094f] to-[#2b064d]"
                  style={{ clipPath: 'polygon(0 0, 56% 52%, 0 100%)' }}
                />
                <span
                  className="absolute inset-0 rounded-xl bg-gradient-to-l from-[#37094f] to-[#2b064d]"
                  style={{ clipPath: 'polygon(100% 0, 44% 52%, 100% 100%)' }}
                />
                <span
                  className="absolute inset-0 rounded-xl bg-gradient-to-t from-[#3c0b58] to-[#30074f]"
                  style={{ clipPath: 'polygon(0 100%, 100% 100%, 50% 44%)' }}
                />

                {/* Flap (rotates up on open) */}
                <span
                  className={`env-flap absolute inset-x-0 top-0 h-[56%] bg-gradient-to-b from-[#4a1668] to-[#33084e] ${
                    phase === 'opening' ? 'env-flap-open' : ''
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 border-b-2 border-gold/50"
                    style={{ clipPath: 'polygon(0 0, 100% 0, 50% 96%)' }}
                  />
                </span>

                {/* Cat wax seal at the flap tip (fades as the flap lifts) */}
                <span
                  className={`absolute left-1/2 top-[56%] block h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-b from-[#ffe9a8] to-gold p-[5px] shadow-[0_6px_16px_rgba(0,0,0,0.45)] transition-all duration-300 ${
                    phase === 'opening' ? 'scale-50 opacity-0' : 'scale-100 opacity-100'
                  }`}
                >
                  <img
                    alt=""
                    className="h-full w-full rounded-full object-cover ring-2 ring-plum"
                    src="/backgrounds/cat-seal.jpg"
                  />
                </span>
              </span>
            </span>

            <span className="env-hint mt-5 block text-center font-display text-sm italic text-cream/80">
              Tap the envelope to open your invitation
            </span>
          </button>
        </div>
      )}

      {confetti && <ConfettiBurst onDone={() => setConfetti(false)} />}

      {/* Tasteful replay affordance once the card is open */}
      {phase === 'open' && (
        <button
          aria-label="Replay the envelope opening"
          className="fixed bottom-4 right-4 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-gold/60 bg-plum/90 text-gold shadow-lg transition-colors hover:bg-plum hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          onClick={replay}
          title="Replay the envelope opening"
          type="button"
        >
          <Mail aria-hidden="true" className="h-5 w-5" />
        </button>
      )}
    </>
  )
}
