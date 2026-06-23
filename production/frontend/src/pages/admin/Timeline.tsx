import { ListChecks } from 'lucide-react'

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
import { useTimeline } from '@/hooks/useTimeline'

function displayValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '-'
  }
  return String(value)
}

export function Timeline() {
  const { data: milestones, isLoading, isError, error } = useTimeline()

  const milestoneList = milestones ?? []
  const milestoneCount = milestoneList.length

  return (
    <AdminLayout
      title="Timeline"
      breadcrumb={[{ label: 'Dashboard', href: '/admin' }, { label: 'Timeline' }]}
    >
      <div className="grid gap-4">
        <section>
          <h2 className="text-xl font-semibold text-gray-900 m-0">Timeline</h2>
          <p className="text-sm text-gray-600 m-0 mt-1">{milestoneCount} milestones</p>
        </section>

        {isLoading && (
          <div
            role="status"
            className="text-sm text-gray-600 border border-gray-200 rounded-md p-4"
          >
            Loading timeline...
          </div>
        )}

        {isError && !isLoading && (
          <Alert variant="destructive">
            {error instanceof Error ? error.message : 'Failed to load timeline'}
          </Alert>
        )}

        {!isLoading && !isError && milestoneCount === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <ListChecks className="h-10 w-10 text-gray-400" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-gray-900 m-0">No milestones yet</p>
                <p className="text-sm text-gray-600 m-0 mt-1">
                  Add planning milestones to track what needs to happen and when.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {!isLoading && !isError && milestoneCount > 0 && (
          <div className="rounded-md border border-gray-200">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {milestoneList.map((milestone) => (
                  <TableRow key={milestone.id}>
                    <TableCell className="font-medium text-gray-900">
                      {milestone.title}
                    </TableCell>
                    <TableCell>{displayValue(milestone.due_date)}</TableCell>
                    <TableCell>{milestone.status}</TableCell>
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
