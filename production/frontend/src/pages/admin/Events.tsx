import { CalendarDays } from 'lucide-react'

import { AdminLayout } from '@/components/AdminLayout'
import { Alert } from '@/components/ui/alert'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useEvents } from '@/hooks/useEvents'

function displayValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '-'
  }
  return String(value)
}

export function Events() {
  const { data: events, isLoading, isError, error } = useEvents()

  const eventList = events ?? []
  const eventCount = eventList.length

  return (
    <AdminLayout
      title="Events"
      breadcrumb={[{ label: 'Dashboard', href: '/admin' }, { label: 'Events' }]}
    >
      <div className="grid gap-4">
        <section>
          <h2 className="text-xl font-semibold text-gray-900 m-0">Events</h2>
          <p className="text-sm text-gray-600 m-0 mt-1">{eventCount} events</p>
        </section>

        {isLoading && (
          <div
            role="status"
            className="text-sm text-gray-600 border border-gray-200 rounded-md p-4"
          >
            Loading events...
          </div>
        )}

        {isError && !isLoading && (
          <Alert variant="destructive">
            {error instanceof Error ? error.message : 'Failed to load events'}
          </Alert>
        )}

        {!isLoading && !isError && eventCount === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <CalendarDays className="h-10 w-10 text-gray-400" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-gray-900 m-0">No events yet</p>
                <p className="text-sm text-gray-600 m-0 mt-1">
                  Add ceremonies, receptions, and other events to organize your day.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {!isLoading && !isError && eventCount > 0 && (
          <div className="rounded-md border border-gray-200">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Location</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {eventList.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="font-medium text-gray-900">{event.name}</TableCell>
                    <TableCell>{displayValue(event.date)}</TableCell>
                    <TableCell>{displayValue(event.location)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
