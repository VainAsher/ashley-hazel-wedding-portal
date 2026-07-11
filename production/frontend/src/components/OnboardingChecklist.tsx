import { useEffect, useMemo, useState } from 'react'
import { Check, X } from 'lucide-react'
import { Link } from 'react-router-dom'

import { useAuth } from '@/contexts/AuthContext'
import { usePortalProgress, type PortalProgress } from '@/hooks/usePortal'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * Progressive onboarding for guests (ROADMAP Wave 2 item 10).
 *
 * Renders two things, both guest-only and both self-contained so the
 * Dashboard mounts this with a single line:
 *  - a one-time coach mark pointing at the top navigation (localStorage)
 *  - a "what you haven't done yet" checklist card driven by
 *    GET /api/portal/me/progress, with per-row dismissal (localStorage)
 */

// Shown once per device, then never again.
const HINT_SEEN_KEY = 'ah-nav-hint-seen'

// Per-member row dismissals: a JSON array of item keys.
function dismissedStorageKey(memberKey: number | string): string {
  return `ah-checklist-dismissed:${memberKey}`
}

interface ChecklistItem {
  key: keyof PortalProgress
  emoji: string
  label: string
  /** Completes the headline: "2 of 4 done — you haven't … yet 🎵" */
  headline: string
  /** Row copy while the item is still to do. */
  prompt: string
  cta: string
  href: string
  /** Row copy once the item is done. */
  done: string
}

const CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    key: 'rsvp_submitted',
    emoji: '💌',
    label: 'RSVP',
    headline: "you haven't RSVP'd yet 💌",
    prompt: 'Let Ashley & Hazel know if you can make it.',
    cta: 'RSVP now',
    href: '/rsvp',
    done: 'RSVP received — thank you!',
  },
  {
    key: 'song_requested',
    emoji: '🎵',
    label: 'Song request',
    headline: "you haven't requested a song yet 🎵",
    prompt: 'Add a song to the wedding soundtrack.',
    cta: 'Request a song',
    href: '/music',
    done: 'Song requested — see you on the dancefloor!',
  },
  {
    key: 'photo_submitted',
    emoji: '📸',
    label: 'Photo',
    headline: "you haven't shared a photo yet 📸",
    prompt: 'Share a favourite photo for the gallery.',
    cta: 'Share a photo',
    href: '/gallery',
    done: 'Photo shared — lovely!',
  },
  {
    key: 'blessing_posted',
    emoji: '💛',
    label: 'Blessing',
    headline: "you haven't left the couple a blessing yet 💛",
    prompt: 'Leave a few warm words for Ashley & Hazel.',
    cta: 'Write a blessing',
    href: '/blessings',
    done: "Blessing posted — they'll treasure it.",
  },
]

function readDismissed(storageKey: string): string[] {
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) {
      return []
    }
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

/**
 * One-time callout pointing up at the header navigation. The flag is written
 * as soon as the hint renders, so it appears exactly once per device.
 */
function FirstVisitHint() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (window.localStorage.getItem(HINT_SEEN_KEY)) {
        return
      }
      window.localStorage.setItem(HINT_SEEN_KEY, '1')
      setVisible(true)
    } catch {
      // Storage unavailable: skip the hint rather than nag on every visit.
    }
  }, [])

  if (!visible) {
    return null
  }

  return (
    <div
      role="note"
      aria-label="Navigation hint"
      data-testid="nav-coach-mark"
      className="fixed left-1/2 top-[10.5rem] z-40 w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 sm:top-[7.75rem]"
    >
      <div className="relative rounded-2xl border-2 border-gold bg-[#fff7e9] p-4 pr-3 shadow-xl">
        <span
          aria-hidden="true"
          className="absolute -top-[7px] left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-l-2 border-t-2 border-gold bg-[#fff7e9]"
        />
        <div className="flex items-start gap-3">
          <p className="m-0 flex-1 text-sm leading-relaxed text-plum">
            Everything lives up here — RSVP, the schedule, the dancefloor and more.
          </p>
          <button
            type="button"
            onClick={() => setVisible(false)}
            className="shrink-0 rounded-full border border-gold bg-gold/20 px-3 py-1 text-xs font-semibold text-plum transition-colors hover:bg-gold/40"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}

function headlineFor(doneCount: number, next: ChecklistItem | undefined): string {
  if (!next) {
    return `${doneCount} of ${CHECKLIST_ITEMS.length} done — you're all set 🎉`
  }
  return `${doneCount} of ${CHECKLIST_ITEMS.length} done — ${next.headline}`
}

export function OnboardingChecklist() {
  const { user } = useAuth()
  const isGuest = user?.role === 'guest'
  const { data: progress, isLoading, isError } = usePortalProgress(isGuest)

  const storageKey = dismissedStorageKey(user?.guest_id ?? user?.id ?? 'anon')
  const [dismissed, setDismissed] = useState<string[]>(() => readDismissed(storageKey))

  // Re-read when the signed-in member changes (e.g. logout/login).
  useEffect(() => {
    setDismissed(readDismissed(storageKey))
  }, [storageKey])

  const dismissItem = (key: string) => {
    setDismissed((current) => {
      const next = current.includes(key) ? current : [...current, key]
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next))
      } catch {
        // Storage unavailable: the dismissal still applies for this visit.
      }
      return next
    })
  }

  const rows = useMemo(() => {
    if (!progress) {
      return []
    }
    return CHECKLIST_ITEMS.map((item) => ({
      item,
      isDone: progress[item.key],
      isDismissed: dismissed.includes(item.key),
    }))
  }, [progress, dismissed])

  if (!isGuest) {
    return null
  }

  // Never render a half-known checklist: wait for progress, and stay quiet
  // if it can't be loaded (the dashboard still works without the nudge).
  if (isLoading || isError || !progress) {
    return <FirstVisitHint />
  }

  const visibleRows = rows.filter((row) => row.isDone || !row.isDismissed)
  const remaining = rows.filter((row) => !row.isDone && !row.isDismissed)
  const doneCount = rows.filter((row) => row.isDone).length
  const allSettled = remaining.length === 0

  return (
    <>
      <FirstVisitHint />
      {!allSettled && (
        <section aria-label="Your checklist">
          <Card data-testid="onboarding-checklist" className="border-gold/60">
            <CardHeader>
              <CardTitle className="text-lg">A few little things ✨</CardTitle>
              <CardDescription>{headlineFor(doneCount, remaining[0]?.item)}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="m-0 grid list-none gap-2 p-0">
                {visibleRows.map(({ item, isDone }) => (
                  <li
                    key={item.key}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-plum/10 bg-cream/40 px-3 py-2"
                  >
                    {isDone ? (
                      <>
                        <span
                          aria-hidden="true"
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold/30 text-plum"
                        >
                          <Check className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <span className="text-sm text-plum">{item.done}</span>
                      </>
                    ) : (
                      <>
                        <span aria-hidden="true" className="w-6 shrink-0 text-center">
                          {item.emoji}
                        </span>
                        <span className="min-w-0 flex-1 text-sm text-gray-900">{item.prompt}</span>
                        <Link
                          to={item.href}
                          className="whitespace-nowrap rounded-full border border-plum/30 bg-white px-3 py-1 text-xs font-semibold text-plum no-underline transition-colors hover:border-plum hover:bg-plum hover:text-cream"
                        >
                          {item.cta}
                        </Link>
                        <button
                          type="button"
                          aria-label={`Hide the ${item.label} reminder`}
                          onClick={() => dismissItem(item.key)}
                          className="shrink-0 rounded-full p-1 text-plum/50 transition-colors hover:bg-plum/10 hover:text-plum"
                        >
                          <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      )}
    </>
  )
}
