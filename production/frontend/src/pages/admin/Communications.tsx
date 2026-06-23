import { MessageSquare } from 'lucide-react'

import { AdminLayout } from '@/components/AdminLayout'
import { Alert } from '@/components/ui/alert'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useCommunications } from '@/hooks/useCommunications'

function displayValue(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '-'
  }
  return value
}

export function Communications() {
  const { data: communications, isLoading, isError, error } = useCommunications()

  const messageList = communications ?? []
  const messageCount = messageList.length

  return (
    <AdminLayout
      title="Communications"
      breadcrumb={[{ label: 'Dashboard', href: '/admin' }, { label: 'Communications' }]}
    >
      <div className="grid gap-4">
        <section className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 m-0">Messages</h2>
            <p className="text-sm text-gray-600 m-0 mt-1">{messageCount} messages</p>
          </div>
        </section>

        {isLoading && (
          <div role="status" className="text-sm text-gray-600 border border-gray-200 rounded-md p-4">
            Loading communications...
          </div>
        )}

        {isError && !isLoading && (
          <Alert variant="destructive">
            {error instanceof Error ? error.message : 'Failed to load communications'}
          </Alert>
        )}

        {!isLoading && !isError && messageCount === 0 && (
          <Card className="flex flex-col items-center justify-center gap-3 p-10 text-center">
            <MessageSquare className="h-10 w-10 text-gray-400" aria-hidden="true" />
            <div>
              <h3 className="text-base font-semibold text-gray-900 m-0">No messages yet</h3>
              <p className="text-sm text-gray-600 m-0 mt-1">
                Announcements and messages sent to guests will appear here.
              </p>
            </div>
          </Card>
        )}

        {!isLoading && !isError && messageCount > 0 && (
          <div className="rounded-md border border-gray-200">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Audience</TableHead>
                  <TableHead>Sent Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {messageList.map((message) => (
                  <TableRow key={message.id}>
                    <TableCell className="font-medium text-gray-900">{message.subject}</TableCell>
                    <TableCell>{message.audience}</TableCell>
                    <TableCell>{displayValue(message.sent_at)}</TableCell>
                    <TableCell>{message.status}</TableCell>
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
