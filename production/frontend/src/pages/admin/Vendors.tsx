import { useMemo, useState, type FormEvent } from 'react'

import { AdminLayout } from '@/components/AdminLayout'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { useBudgetCategories } from '@/hooks/useBudget'
import {
  VendorApiError,
  useCreateVendor,
  useDeleteVendor,
  useUpdateVendor,
  useVendors,
  type Vendor,
  type VendorPayload,
} from '@/hooks/useVendors'

const NONE_VALUE = '__none__'

type DialogMode = 'create' | 'edit'

interface VendorFormState {
  wedding_id: string
  vendor_name: string
  category_id: string
  contact_person: string
  email: string
  phone: string
  website: string
  contract_signed: boolean
  notes: string
}

function emptyFormState(): VendorFormState {
  return {
    wedding_id: '1',
    vendor_name: '',
    category_id: '',
    contact_person: '',
    email: '',
    phone: '',
    website: '',
    contract_signed: false,
    notes: '',
  }
}

function formStateFromVendor(vendor: Vendor): VendorFormState {
  return {
    wedding_id: String(vendor.wedding_id),
    vendor_name: vendor.vendor_name,
    category_id: vendor.category_id === null ? '' : String(vendor.category_id),
    contact_person: vendor.contact_person ?? '',
    email: vendor.email ?? '',
    phone: vendor.phone ?? '',
    website: vendor.website ?? '',
    contract_signed: vendor.contract_signed,
    notes: vendor.notes ?? '',
  }
}

function optionalText(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function validate(form: VendorFormState): string | null {
  if (!Number(form.wedding_id) || Number(form.wedding_id) < 1) {
    return 'Wedding ID is required.'
  }
  if (!form.vendor_name.trim()) {
    return 'Vendor name is required.'
  }
  if (form.email.trim() && !form.email.includes('@')) {
    return 'Email must contain @.'
  }
  return null
}

function buildPayload(form: VendorFormState): VendorPayload {
  return {
    wedding_id: Number(form.wedding_id),
    vendor_name: form.vendor_name.trim(),
    category_id: form.category_id === '' ? null : Number(form.category_id),
    contact_person: optionalText(form.contact_person),
    email: optionalText(form.email),
    phone: optionalText(form.phone),
    website: optionalText(form.website),
    contract_signed: form.contract_signed,
    notes: optionalText(form.notes),
  }
}

function displayValue(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '-'
  }
  return value
}

export function Vendors() {
  const { data: vendors, isLoading, isError, error } = useVendors()
  const { data: categories } = useBudgetCategories()

  const createMutation = useCreateVendor()
  const updateMutation = useUpdateVendor()
  const deleteMutation = useDeleteVendor()

  const [dialogMode, setDialogMode] = useState<DialogMode | null>(null)
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null)
  const [form, setForm] = useState<VendorFormState>(emptyFormState)
  const [formError, setFormError] = useState<string | null>(null)

  const [vendorToDelete, setVendorToDelete] = useState<Vendor | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [feedback, setFeedback] = useState<string | null>(null)

  const vendorList = vendors ?? []
  const vendorCount = vendorList.length
  const categoryList = categories ?? []

  const isSaving = createMutation.isPending || updateMutation.isPending

  const dialogTitle = useMemo(
    () => (dialogMode === 'edit' ? 'Edit Vendor' : 'Add Vendor'),
    [dialogMode],
  )

  const updateField = <K extends keyof VendorFormState>(key: K, value: VendorFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const openCreateDialog = () => {
    setFeedback(null)
    setFormError(null)
    setEditingVendor(null)
    setForm(emptyFormState())
    setDialogMode('create')
  }

  const openEditDialog = (vendor: Vendor) => {
    setFeedback(null)
    setFormError(null)
    setEditingVendor(vendor)
    setForm(formStateFromVendor(vendor))
    setDialogMode('edit')
  }

  const closeDialog = () => {
    setDialogMode(null)
    setEditingVendor(null)
    setFormError(null)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)

    const validationError = validate(form)
    if (validationError) {
      setFormError(validationError)
      return
    }

    const payload = buildPayload(form)

    try {
      if (dialogMode === 'edit' && editingVendor) {
        await updateMutation.mutateAsync({ id: editingVendor.id, payload })
        setFeedback('Vendor updated successfully.')
      } else {
        await createMutation.mutateAsync(payload)
        setFeedback('Vendor added successfully.')
      }
      closeDialog()
    } catch (err) {
      const fallback = dialogMode === 'edit' ? 'Failed to update vendor' : 'Failed to add vendor'
      setFormError(err instanceof VendorApiError ? err.message : fallback)
    }
  }

  const requestDelete = (vendor: Vendor) => {
    setFeedback(null)
    setDeleteError(null)
    setVendorToDelete(vendor)
  }

  const cancelDelete = () => {
    setVendorToDelete(null)
    setDeleteError(null)
  }

  const confirmDelete = async () => {
    if (!vendorToDelete) {
      return
    }

    try {
      await deleteMutation.mutateAsync(vendorToDelete.id)
      setFeedback('Vendor deleted successfully.')
      setVendorToDelete(null)
    } catch (err) {
      setDeleteError(err instanceof VendorApiError ? err.message : 'Failed to delete vendor')
    }
  }

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
          <Button type="button" onClick={openCreateDialog}>
            Add Vendor
          </Button>
        </section>

        {feedback && (
          <Alert variant="success" role="status" aria-live="polite">
            {feedback}
          </Alert>
        )}

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
          <div className="text-sm text-gray-600 border border-gray-200 rounded-md p-4">
            No vendors found.
          </div>
        )}

        {!isLoading && !isError && vendorCount > 0 && (
          <div className="rounded-md border border-gray-200">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Contact Person</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Contract</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendorList.map((vendor) => (
                  <TableRow key={vendor.id}>
                    <TableCell className="font-medium text-gray-900">{vendor.vendor_name}</TableCell>
                    <TableCell>{displayValue(vendor.category_name)}</TableCell>
                    <TableCell>{displayValue(vendor.contact_person)}</TableCell>
                    <TableCell>{displayValue(vendor.email)}</TableCell>
                    <TableCell>{displayValue(vendor.phone)}</TableCell>
                    <TableCell>
                      <Badge variant={vendor.contract_signed ? 'success' : 'neutral'}>
                        {vendor.contract_signed ? 'Signed' : 'Unsigned'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          aria-label={`Edit ${vendor.vendor_name}`}
                          onClick={() => openEditDialog(vendor)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          aria-label={`Delete ${vendor.vendor_name}`}
                          onClick={() => requestDelete(vendor)}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={dialogMode !== null} onOpenChange={(open) => (!open ? closeDialog() : undefined)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>
              {dialogMode === 'edit'
                ? 'Update the vendor details and save your changes.'
                : 'Enter the vendor details to add them to the wedding.'}
            </DialogDescription>
          </DialogHeader>

          <form noValidate onSubmit={handleSubmit} className="grid gap-4">
            {formError && <Alert variant="destructive">{formError}</Alert>}

            <div className="grid gap-2">
              <Label htmlFor="vendor-wedding-id">Wedding ID</Label>
              <Input
                id="vendor-wedding-id"
                type="number"
                min={1}
                value={form.wedding_id}
                onChange={(event) => updateField('wedding_id', event.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="vendor-name">Name</Label>
              <Input
                id="vendor-name"
                value={form.vendor_name}
                onChange={(event) => updateField('vendor_name', event.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="vendor-category">Category</Label>
              <Select
                value={form.category_id === '' ? NONE_VALUE : form.category_id}
                onValueChange={(value) =>
                  updateField('category_id', value === NONE_VALUE ? '' : value)
                }
              >
                <SelectTrigger id="vendor-category" aria-label="Category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>None</SelectItem>
                  {categoryList.map((category) => (
                    <SelectItem key={category.id} value={String(category.id)}>
                      {category.category_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="vendor-contact">Contact Person</Label>
              <Input
                id="vendor-contact"
                value={form.contact_person}
                onChange={(event) => updateField('contact_person', event.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="vendor-email">Email</Label>
              <Input
                id="vendor-email"
                type="email"
                value={form.email}
                onChange={(event) => updateField('email', event.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="vendor-phone">Phone</Label>
                <Input
                  id="vendor-phone"
                  value={form.phone}
                  onChange={(event) => updateField('phone', event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="vendor-website">Website</Label>
                <Input
                  id="vendor-website"
                  value={form.website}
                  onChange={(event) => updateField('website', event.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="vendor-contract"
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300"
                checked={form.contract_signed}
                onChange={(event) => updateField('contract_signed', event.target.checked)}
              />
              <Label htmlFor="vendor-contract">Contract signed</Label>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="vendor-notes">Notes</Label>
              <Input
                id="vendor-notes"
                value={form.notes}
                onChange={(event) => updateField('notes', event.target.value)}
              />
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={closeDialog} disabled={isSaving}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving
                  ? dialogMode === 'edit'
                    ? 'Saving...'
                    : 'Adding...'
                  : dialogMode === 'edit'
                    ? 'Save Vendor'
                    : 'Add Vendor'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={vendorToDelete !== null} onOpenChange={(open) => (!open ? cancelDelete() : undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Vendor</DialogTitle>
            <DialogDescription>
              {vendorToDelete
                ? `Delete ${vendorToDelete.vendor_name}? This action cannot be undone.`
                : 'Delete this vendor?'}
            </DialogDescription>
          </DialogHeader>

          {deleteError && <Alert variant="destructive">{deleteError}</Alert>}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={cancelDelete}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void confirmDelete()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}
