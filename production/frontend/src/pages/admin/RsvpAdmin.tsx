import { MailCheck } from 'lucide-react'

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
import { useRsvpAdmin } from '@/hooks/useRsvpAdmin'

function displayValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '-'
  }
  return String(value)
}

export function RsvpAdmin() {
  const { data: responses, isLoading, isError, error } = useRsvpAdmin()

  const responseList = responses ?? []
  const responseCount = responseList.length

  return (
    <AdminLayout
      title="RSVP Responses"
      breadcrumb={[{ label: 'Dashboard', href: '/admin' }, { label: 'RSVP' }]}
    >
      <div className="grid gap-4">
        <section>
          <h2 className="text-xl font-semibold text-gray-900 m-0">RSVP Responses</h2>
          <p className="text-sm text-gray-600 m-0 mt-1">{responseCount} responses</p>
        </section>

        {isLoading && (
          <div
            role="status"
            className="text-sm text-gray-600 border border-gray-200 rounded-md p-4"
          >
            Loading RSVP responses...
          </div>
        )}

        {isError && !isLoading && (
          <Alert variant="destructive">
            {error instanceof Error ? error.message : 'Failed to load RSVP responses'}
          </Alert>
        )}

        {!isLoading && !isError && responseCount === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <MailCheck className="h-10 w-10 text-gray-400" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-gray-900 m-0">No RSVP responses yet</p>
                <p className="text-sm text-gray-600 m-0 mt-1">
                  Responses will appear here once guests reply to their invitations.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {!isLoading && !isError && responseCount > 0 && (
          <div className="rounded-md border border-gray-200">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Guest</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Party Size</TableHead>
                  <TableHead>Responded</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {responseList.map((response) => (
                  <TableRow key={response.id}>
                    <TableCell className="font-medium text-gray-900">
                      {response.guest_name}
                    </TableCell>
                    <TableCell>{response.rsvp_status}</TableCell>
                    <TableCell>{displayValue(response.party_size)}</TableCell>
                    <TableCell>{displayValue(response.responded_at)}</TableCell>
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
