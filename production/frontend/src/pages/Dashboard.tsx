import { Calendar, Clock, Heart, Image as ImageIcon, MapPin, Send } from 'lucide-react'
import { Link } from 'react-router-dom'

import { GuestLayout } from '../components/GuestLayout'
import { Alert } from '../components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
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
      <Icon className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" aria-hidden="true" />
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500 m-0">{label}</p>
        <p className="text-sm text-gray-900 m-0">{value}</p>
      </div>
    </div>
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
  const { data: wedding, isLoading, isError, error } = usePortalWedding()

  return (
    <GuestLayout>
      <div className="max-w-4xl mx-auto w-full grid gap-6">
        {isLoading && (
          <Card>
            <CardContent className="pt-6">
              <div role="status" className="text-gray-600 text-sm">
                Loading wedding details...
              </div>
            </CardContent>
          </Card>
        )}

        {isError && !isLoading && (
          <Alert variant="destructive">
            {error instanceof Error ? error.message : 'Unable to load wedding details.'}
          </Alert>
        )}

        {!isLoading && !isError && wedding && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Welcome to {wedding.couple_names}'s wedding</CardTitle>
                <CardDescription>{countdownLabel(wedding.wedding_date)}</CardDescription>
              </CardHeader>
            </Card>

            <KeyDetails wedding={wedding} />
          </>
        )}

        <section aria-label="Quick links" className="grid gap-4 sm:grid-cols-2">
          {quickLinks.map(({ href, title, description, icon: Icon }) => (
            <Link key={href} to={href} className="block no-underline">
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Icon className="h-5 w-5 text-blue-600" aria-hidden="true" />
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
