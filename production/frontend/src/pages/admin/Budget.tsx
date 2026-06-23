import { Wallet } from 'lucide-react'

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
import { useBudget } from '@/hooks/useBudget'

function displayValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '-'
  }
  return String(value)
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}

export function Budget() {
  const { data: items, isLoading, isError, error } = useBudget()

  const itemList = items ?? []
  const itemCount = itemList.length

  return (
    <AdminLayout
      title="Budget"
      breadcrumb={[{ label: 'Dashboard', href: '/admin' }, { label: 'Budget' }]}
    >
      <div className="grid gap-4">
        <section>
          <h2 className="text-xl font-semibold text-gray-900 m-0">Budget</h2>
          <p className="text-sm text-gray-600 m-0 mt-1">{itemCount} line items</p>
        </section>

        {isLoading && (
          <div
            role="status"
            className="text-sm text-gray-600 border border-gray-200 rounded-md p-4"
          >
            Loading budget...
          </div>
        )}

        {isError && !isLoading && (
          <Alert variant="destructive">
            {error instanceof Error ? error.message : 'Failed to load budget'}
          </Alert>
        )}

        {!isLoading && !isError && itemCount === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <Wallet className="h-10 w-10 text-gray-400" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-gray-900 m-0">No budget items yet</p>
                <p className="text-sm text-gray-600 m-0 mt-1">
                  Add line items to start tracking planned and actual spending.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {!isLoading && !isError && itemCount > 0 && (
          <div className="rounded-md border border-gray-200">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Planned</TableHead>
                  <TableHead>Spent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itemList.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium text-gray-900">{item.item}</TableCell>
                    <TableCell>{displayValue(item.category)}</TableCell>
                    <TableCell>{formatCurrency(item.planned)}</TableCell>
                    <TableCell>{formatCurrency(item.spent)}</TableCell>
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
