import { Briefcase } from 'lucide-react'

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
import { useVendors } from '@/hooks/useVendors'

function displayValue(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '-'
  }
  return value
}

export function Vendors() {
  const { data: vendors, isLoading, isError, error } = useVendors()

  const vendorList = vendors ?? []
  const vendorCount = vendorList.length

  return (
    <AdminLayout
      title="Vendors"
      breadcrumb={[{ label: 'Dashboard', href: '/admin' }, { label: 'Vendors' }]}
    >
      <div className="grid gap-4">
        <section className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 m-0">Vendors</h2>
            <p className="text-sm text-gray-600 m-0 mt-1">{vendorCount} vendors</p>
          </div>
        </section>

        {isLoading && (
          <div role="status" className="text-sm text-gray-600 border border-gray-200 rounded-md p-4">
            Loading vendors...
          </div>
        )}

        {isError && !isLoading && (
          <Alert variant="destructive">
            {error instanceof Error ? error.message : 'Failed to load vendors'}
          </Alert>
        )}

        {!isLoading && !isError && vendorCount === 0 && (
          <Card className="flex flex-col items-center justify-center gap-3 p-10 text-center">
            <Briefcase className="h-10 w-10 text-gray-400" aria-hidden="true" />
            <div>
              <h3 className="text-base font-semibold text-gray-900 m-0">No vendors yet</h3>
              <p className="text-sm text-gray-600 m-0 mt-1">
                Vendors you add for the wedding will appear here.
              </p>
            </div>
          </Card>
        )}

        {!isLoading && !isError && vendorCount > 0 && (
          <div className="rounded-md border border-gray-200">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendorList.map((vendor) => (
                  <TableRow key={vendor.id}>
                    <TableCell className="font-medium text-gray-900">{vendor.name}</TableCell>
                    <TableCell>{vendor.category}</TableCell>
                    <TableCell>{displayValue(vendor.contact)}</TableCell>
                    <TableCell>{vendor.status}</TableCell>
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
