import { useMemo, useState } from 'react'

import { AdminLayout } from '@/components/AdminLayout'
import { Alert } from '@/components/ui/alert'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useGuests, type Guest, type RsvpStatus } from '@/hooks/useGuests'

type StatusFilter = 'all' | 'accepted' | 'declined' | 'pending'

const FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'declined', label: 'Declined' },
  { value: 'pending', label: 'Pending' },
]

const MEAL_LABELS: Record<string, string> = {
  chicken: 'Chicken',
  fish: 'Fish',
  vegetarian: 'Vegetarian',
}

const STATUS_VARIANT: Record<RsvpStatus, BadgeProps['variant']> = {
  accepted: 'success',
  declined: 'danger',
  pending: 'neutral',
  tentative: 'warning',
}

function displayValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '-'
  }
  return String(value)
}

function dietaryNotes(guest: Guest): string {
  return guest.dietary_restrictions ?? '-'
}

export function RsvpAdmin() {
  const { data: guests, isLoading, isError, error } = useGuests()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const guestList = guests ?? []

  const summary = useMemo(() => {
    const total = guestList.length
    let accepted = 0
    let declined = 0
    let pending = 0
    const meals: Record<string, number> = {}

    for (const guest of guestList) {
      if (guest.rsvp_status === 'accepted') {
        accepted += 1
      } else if (guest.rsvp_status === 'declined') {
        declined += 1
      } else if (guest.rsvp_status === 'pending') {
        pending += 1
      }

      if (guest.meal_choice) {
        meals[guest.meal_choice] = (meals[guest.meal_choice] ?? 0) + 1
      }
    }

    return { total, accepted, declined, pending, meals }
  }, [guestList])

  const filteredGuests = useMemo(() => {
    if (statusFilter === 'all') {
      return guestList
    }
    return guestList.filter((guest) => guest.rsvp_status === statusFilter)
  }, [guestList, statusFilter])

  const mealEntries = Object.entries(summary.meals)

  return (
    <AdminLayout
      title="RSVP Responses"
      breadcrumb={[{ label: 'Dashboard', href: '/admin' }, { label: 'RSVP' }]}
    >
      <div className="grid grid-cols-1 gap-4">
        <section>
          <h2 className="text-xl font-semibold text-gray-900 m-0">RSVP overview</h2>
          <p className="text-sm text-gray-600 m-0 mt-1">{summary.total} guests</p>
        </section>

        {isLoading && (
          <div
            role="status"
            className="text-sm text-gray-600 border border-gray-200 rounded-md p-4"
          >
            Loading RSVPs...
          </div>
        )}

        {isError && !isLoading && (
          <Alert variant="destructive">
            {error instanceof Error ? error.message : 'Failed to load RSVPs'}
          </Alert>
        )}

        {!isLoading && !isError && (
          <>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-gray-600 m-0">Total guests</p>
                  <p className="text-2xl font-semibold text-gray-900 m-0 mt-1">{summary.total}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-gray-600 m-0">Accepted</p>
                  <p className="text-2xl font-semibold text-gray-900 m-0 mt-1">{summary.accepted}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-gray-600 m-0">Declined</p>
                  <p className="text-2xl font-semibold text-gray-900 m-0 mt-1">{summary.declined}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-gray-600 m-0">Pending</p>
                  <p className="text-2xl font-semibold text-gray-900 m-0 mt-1">{summary.pending}</p>
                </CardContent>
              </Card>
            </section>

            <Card>
              <CardContent className="p-4">
                <p className="text-sm font-medium text-gray-900 m-0">Meal choices</p>
                {mealEntries.length === 0 ? (
                  <p className="text-sm text-gray-600 m-0 mt-2">No meal choices recorded.</p>
                ) : (
                  <ul className="mt-2 grid gap-1 sm:grid-cols-3">
                    {mealEntries.map(([meal, count]) => (
                      <li key={meal} className="text-sm text-gray-700">
                        {MEAL_LABELS[meal] ?? meal}: {count}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <section className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-gray-600 m-0">{filteredGuests.length} shown</p>
              <div className="grid gap-2">
                <label htmlFor="rsvp-status-filter" className="sr-only">
                  Filter by status
                </label>
                <Select
                  value={statusFilter}
                  onValueChange={(value) => setStatusFilter(value as StatusFilter)}
                >
                  <SelectTrigger
                    id="rsvp-status-filter"
                    aria-label="Filter by status"
                    className="w-48"
                  >
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    {FILTER_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </section>

            {filteredGuests.length === 0 ? (
              <div className="text-sm text-gray-600 border border-gray-200 rounded-md p-4">
                No guests match this filter.
              </div>
            ) : (
              <div className="rounded-md border border-gray-200">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Meal</TableHead>
                      <TableHead>Dietary Notes</TableHead>
                      <TableHead>Plus One</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredGuests.map((guest) => (
                      <TableRow key={guest.id}>
                        <TableCell className="font-medium text-gray-900">{guest.name}</TableCell>
                        <TableCell>
                          <Badge variant={STATUS_VARIANT[guest.rsvp_status]} className="capitalize">
                            {guest.rsvp_status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {guest.meal_choice
                            ? (MEAL_LABELS[guest.meal_choice] ?? guest.meal_choice)
                            : '-'}
                        </TableCell>
                        <TableCell>{dietaryNotes(guest)}</TableCell>
                        <TableCell>{displayValue(guest.plus_one_name)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  )
}
