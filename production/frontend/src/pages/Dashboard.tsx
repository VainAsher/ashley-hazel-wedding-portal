import { Calendar, Clock, Heart, Image as ImageIcon, MapPin, Send } from 'lucide-react'
import { Link } from 'react-router-dom'

import { useAuth } from '../contexts/AuthContext'
import { GuestLayout } from '../components/GuestLayout'
import { Alert } from '../components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Skeleton } from '../components/ui/skeleton'
import { usePageTitle } from '../hooks/usePageTitle'
import { usePortalWedding, type PortalWedding } from '../hooks/usePortal'

function formatDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return parsed.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatTime(value: string | null): string | null {
  if (!value) {
    return null
  }
  const [hoursPart, minutesPart] = value.split(':')
  const hours = Number(hoursPart)
  const minutes = Number(minutesPart ?? '0')
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return value
  }
  const date = new Date()
  date.setHours(hours, minutes, 0, 0)
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function daysUntil(weddingDate: string): number {
  const target = new Date(`${weddingDate}T00:00:00`)
  if (Number.isNaN(target.getTime())) {
    return 0
  }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffMs = target.getTime() - today.getTime()
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}

function countdownLabel(weddingDate: string): string {
  const days = daysUntil(weddingDate)
  if (days > 1) {
    return `${days} days to go`
  }
  if (days === 1) {
    return '1 day to go'
  }
  if (days === 0) {
    return 'Today is the day!'
  }
  return 'The celebration has passed'
}

const quickLinks = [
  {
    href: '/rsvp',
    title: 'RSVP',
    description: 'Let us know if you can make it.',
    icon: Send,
  },
  {
    href: '/schedule',
    title: 'Schedule',
    description: 'See the plan for the day.',
    icon: Calendar,
  },
  {
    href: '/blessings',
    title: 'Blessings',
    description: 'Leave a message for the couple.',
    icon: Heart,
  },
  {
    href: '/gallery',
    title: 'Gallery',
    description: 'Browse and share photos.',
    icon: ImageIcon,
  },
]

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Calendar
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-5 w-5 text-plum mt-0.5 flex-shrink-0" aria-hidden="true" />
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground m-0">{label}</p>
        <p className="text-sm text-gray-900 m-0">{value}</p>
      </div>
    </div>
  )
}

function InvitationHero({
  wedding,
  guestName,
}: {
  wedding: PortalWedding
  guestName: string | null
}) {
  const firstName = guestName?.trim().split(/\s+/)[0]

  return (
    <section aria-label="Welcome" className="relative">
      {/* Pattern band, straight from the prototype landing page */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-3 rounded-[34px] border-2 border-dashed border-gold/60 [background:linear-gradient(135deg,rgba(246,196,69,0.12)_25%,transparent_25%)_0_0/26px_26px]"
      />
      <div className="relative rounded-[28px] border-4 border-double border-plum bg-gradient-to-b from-[#fff7e9] to-[#f8e7ad] px-6 py-10 text-center shadow-xl">
        <p className="m-0 text-xs font-extrabold uppercase tracking-[0.18em] text-[#b77900]">
          You are warmly invited
        </p>
        <h1 className="font-display text-4xl sm:text-5xl text-plum my-2">
          {firstName ? `Welcome, ${firstName}` : `Welcome to ${wedding.couple_names}'s wedding`}
        </h1>
        <p className="m-0 text-lg font-bold text-plum">
          {formatDate(wedding.wedding_date)} · {countdownLabel(wedding.wedding_date)}
        </p>
        <p className="mx-auto mt-4 mb-0 max-w-xl text-base leading-relaxed text-plum/90">
          Two families, two cultures, one celebration — love, blessings, music, food,
          laughter, and the people who made us who we are.
        </p>
      </div>
    </section>
  )
}

function KeyDetails({ wedding }: { wedding: PortalWedding }) {
  const ceremonyTime = formatTime(wedding.ceremony_time)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Key details</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <DetailRow icon={Calendar} label="Date" value={formatDate(wedding.wedding_date)} />
        {ceremonyTime && (
          <DetailRow icon={Clock} label="Ceremony time" value={ceremonyTime} />
        )}
        {wedding.ceremony_location && (
          <DetailRow icon={MapPin} label="Ceremony" value={wedding.ceremony_location} />
        )}
        {wedding.reception_location && (
          <DetailRow icon={MapPin} label="Reception" value={wedding.reception_location} />
        )}
      </CardContent>
    </Card>
  )
}

export function Dashboard() {
  usePageTitle('Dashboard')
  const { user } = useAuth()
  const { data: wedding, isLoading, isError, error } = usePortalWedding()

  return (
    <GuestLayout>
      <div className="max-w-4xl mx-auto w-full grid gap-6">
        {isLoading && (
          <div role="status" className="grid gap-6">
            <span className="sr-only">Loading wedding details...</span>

            {/* Invitation hero skeleton */}
            <div className="rounded-[28px] border-4 border-double border-plum/20 bg-cream/60 px-6 py-10">
              <div className="mx-auto flex max-w-xl flex-col items-center gap-3">
                <Skeleton className="h-3 w-44" />
                <Skeleton className="h-10 w-72 max-w-full" />
                <Skeleton className="h-5 w-64 max-w-full" />
                <Skeleton className="mt-2 h-4 w-full max-w-md" />
                <Skeleton className="h-4 w-3/5" />
              </div>
            </div>

            {/* Key details skeleton */}
            <Card>
              <CardHeader>
                <Skeleton className="h-5 w-28" />
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                {[0, 1, 2, 3].map((row) => (
                  <div key={row} className="flex items-start gap-3">
                    <Skeleton className="h-5 w-5 rounded-full" />
                    <div className="grid flex-1 gap-1.5">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-4 w-40 max-w-full" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {isError && !isLoading && (
          <Alert variant="destructive">
            {error instanceof Error ? error.message : 'Unable to load wedding details.'}
          </Alert>
        )}

        {!isLoading && !isError && wedding && (
          <>
            <InvitationHero wedding={wedding} guestName={user?.name ?? null} />

            <KeyDetails wedding={wedding} />
          </>
        )}

        <section aria-label="Quick links" className="grid gap-4 sm:grid-cols-2">
          {quickLinks.map(({ href, title, description, icon: Icon }) => (
            <Link key={href} to={href} className="block no-underline">
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Icon className="h-5 w-5 text-plum" aria-hidden="true" />
                    {title}
                  </CardTitle>
                  <CardDescription>{description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </section>
      </div>
    </GuestLayout>
  )
}
