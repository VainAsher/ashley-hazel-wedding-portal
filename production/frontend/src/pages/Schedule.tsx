import { CalendarDays, Clock, MapPin } from 'lucide-react'

import { GuestLayout } from '../components/GuestLayout'
import { Alert } from '../components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { usePageTitle } from '../hooks/usePageTitle'
import {
  usePortalSchedule,
  usePortalWedding,
  type PortalScheduleEvent,
} from '../hooks/usePortal'

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

function sortKey(event: PortalScheduleEvent): string {
  return `${event.event_date}T${event.event_time ?? '99:99'}`
}

function ScheduleItem({ event }: { event: PortalScheduleEvent }) {
  const time = formatTime(event.event_time)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{event.event_name}</CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
            {formatDate(event.event_date)}
          </span>
          {time && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-4 w-4" aria-hidden="true" />
              {time}
            </span>
          )}
          {event.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-4 w-4" aria-hidden="true" />
              {event.location}
            </span>
          )}
        </CardDescription>
      </CardHeader>
      {event.description && (
        <CardContent>
          <p className="text-sm text-gray-700 m-0">{event.description}</p>
        </CardContent>
      )}
    </Card>
  )
}

export function Schedule() {
  usePageTitle('Schedule')
  const { data: events, isLoading, isError, error } = usePortalSchedule()
  const { data: wedding } = usePortalWedding()

  // The ceremony lives on the wedding record rather than in the events list,
  // so synthesize an entry for it — guests should see the whole day here.
  // Skip it if the couple has added their own ceremony event to avoid a duplicate.
  const hasCeremonyEvent = (events ?? []).some((event) =>
    event.event_name.toLowerCase().includes('ceremony'),
  )
  const ceremony: PortalScheduleEvent | null = wedding && !hasCeremonyEvent
    ? {
        id: -1,
        event_name: 'Wedding Ceremony',
        event_date: wedding.wedding_date,
        event_time: wedding.ceremony_time,
        location: wedding.ceremony_location,
        description: null,
      }
    : null

  const orderedEvents = [...(events ?? []), ...(ceremony ? [ceremony] : [])].sort((a, b) =>
    sortKey(a).localeCompare(sortKey(b)),
  )

  return (
    <GuestLayout>
      <div className="max-w-3xl mx-auto w-full grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Schedule</CardTitle>
            <CardDescription>The plan for the celebration.</CardDescription>
          </CardHeader>
        </Card>

        {isLoading && (
          <Card>
            <CardContent className="pt-6">
              <div role="status" className="text-gray-600 text-sm">
                Loading schedule...
              </div>
            </CardContent>
          </Card>
        )}

        {isError && !isLoading && (
          <Alert variant="destructive">
            {error instanceof Error ? error.message : 'Unable to load the schedule.'}
          </Alert>
        )}

        {!isLoading && !isError && orderedEvents.length === 0 && (
          <Card className="flex flex-col items-center justify-center gap-3 p-10 text-center">
            <CalendarDays className="h-10 w-10 text-gray-400" aria-hidden="true" />
            <div>
              <h3 className="text-base font-semibold text-gray-900 m-0">No events yet</h3>
              <p className="text-sm text-gray-600 m-0 mt-1">
                The schedule will appear here once it is published.
              </p>
            </div>
          </Card>
        )}

        {!isLoading && !isError && orderedEvents.length > 0 && (
          <section aria-label="Schedule events" className="grid gap-4">
            {orderedEvents.map((event) => (
              <ScheduleItem key={event.id} event={event} />
            ))}
          </section>
        )}
      </div>
    </GuestLayout>
  )
}
