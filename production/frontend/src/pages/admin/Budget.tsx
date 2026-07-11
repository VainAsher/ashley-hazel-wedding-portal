import { useMemo, useState, type FormEvent } from 'react'

import { formatCurrency } from '@/lib/format'
import { AdminLayout } from '@/components/AdminLayout'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import {
  BudgetApiError,
  useBudgetCategories,
  useBudgetItems,
  useBudgetSummary,
  useCreateBudgetItem,
  useDeleteBudgetItem,
  useUpdateBudgetItem,
  type BudgetItem,
  type BudgetItemPayload,
} from '@/hooks/useBudget'
import { useVendors } from '@/hooks/useVendors'

const NONE_VALUE = '__none__'

type DialogMode = 'create' | 'edit'

interface BudgetFormState {
  wedding_id: string
  category_id: string
  vendor_id: string
  description: string
  estimated_cost: string
  actual_cost: string
  paid: boolean
  payment_date: string
  notes: string
}

function emptyFormState(): BudgetFormState {
  return {
    wedding_id: '1',
    category_id: '',
    vendor_id: '',
    description: '',
    estimated_cost: '',
    actual_cost: '',
    paid: false,
    payment_date: '',
    notes: '',
  }
}

function formStateFromItem(item: BudgetItem): BudgetFormState {
  return {
    wedding_id: String(item.wedding_id),
    category_id: item.category_id === null ? '' : String(item.category_id),
    vendor_id: item.vendor_id === null ? '' : String(item.vendor_id),
    description: item.description ?? '',
    estimated_cost: item.estimated_cost === null ? '' : String(item.estimated_cost),
    actual_cost: item.actual_cost === null ? '' : String(item.actual_cost),
    paid: item.paid,
    payment_date: item.payment_date ?? '',
    notes: item.notes ?? '',
  }
}

function optionalText(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function optionalNumber(value: string): number | null {
  if (value.trim() === '') {
    return null
  }
  return Number(value)
}

function validate(form: BudgetFormState): string | null {
  if (!Number(form.wedding_id) || Number(form.wedding_id) < 1) {
    return 'Wedding ID is required.'
  }
  if (!form.description.trim()) {
    return 'Description is required.'
  }
  if (form.estimated_cost.trim() && Number(form.estimated_cost) < 0) {
    return 'Estimated cost must be 0 or greater.'
  }
  if (form.actual_cost.trim() && Number(form.actual_cost) < 0) {
    return 'Actual cost must be 0 or greater.'
  }
  return null
}

function buildPayload(form: BudgetFormState): BudgetItemPayload {
  return {
    wedding_id: Number(form.wedding_id),
    category_id: form.category_id === '' ? null : Number(form.category_id),
    vendor_id: form.vendor_id === '' ? null : Number(form.vendor_id),
    description: optionalText(form.description),
    estimated_cost: optionalNumber(form.estimated_cost),
    actual_cost: optionalNumber(form.actual_cost),
    paid: form.paid,
    payment_date: optionalText(form.payment_date),
    notes: optionalText(form.notes),
  }
}


function displayValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '-'
  }
  return String(value)
}

export function Budget() {
  const { data: items, isLoading, isError, error } = useBudgetItems()
  const { data: summary } = useBudgetSummary()
  const { data: categories } = useBudgetCategories()
  const { data: vendors } = useVendors()

  const createMutation = useCreateBudgetItem()
  const updateMutation = useUpdateBudgetItem()
  const deleteMutation = useDeleteBudgetItem()

  const [dialogMode, setDialogMode] = useState<DialogMode | null>(null)
  const [editingItem, setEditingItem] = useState<BudgetItem | null>(null)
  const [form, setForm] = useState<BudgetFormState>(emptyFormState)
  const [formError, setFormError] = useState<string | null>(null)

  const [itemToDelete, setItemToDelete] = useState<BudgetItem | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [feedback, setFeedback] = useState<string | null>(null)

  const itemList = items ?? []
  const itemCount = itemList.length
  const categoryList = categories ?? []
  const vendorList = vendors ?? []

  const isSaving = createMutation.isPending || updateMutation.isPending

  const dialogTitle = useMemo(
    () => (dialogMode === 'edit' ? 'Edit Budget Item' : 'Add Budget Item'),
    [dialogMode],
  )

  const updateField = <K extends keyof BudgetFormState>(key: K, value: BudgetFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const openCreateDialog = () => {
    setFeedback(null)
    setFormError(null)
    setEditingItem(null)
    setForm(emptyFormState())
    setDialogMode('create')
  }

  const openEditDialog = (item: BudgetItem) => {
    setFeedback(null)
    setFormError(null)
    setEditingItem(item)
    setForm(formStateFromItem(item))
    setDialogMode('edit')
  }

  const closeDialog = () => {
    setDialogMode(null)
    setEditingItem(null)
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
      if (dialogMode === 'edit' && editingItem) {
        await updateMutation.mutateAsync({ id: editingItem.id, payload })
        setFeedback('Budget item updated successfully.')
      } else {
        await createMutation.mutateAsync(payload)
        setFeedback('Budget item added successfully.')
      }
      closeDialog()
    } catch (err) {
      const fallback =
        dialogMode === 'edit' ? 'Failed to update budget item' : 'Failed to add budget item'
      setFormError(err instanceof BudgetApiError ? err.message : fallback)
    }
  }

  const requestDelete = (item: BudgetItem) => {
    setFeedback(null)
    setDeleteError(null)
    setItemToDelete(item)
  }

  const cancelDelete = () => {
    setItemToDelete(null)
    setDeleteError(null)
  }

  const confirmDelete = async () => {
    if (!itemToDelete) {
      return
    }

    try {
      await deleteMutation.mutateAsync(itemToDelete.id)
      setFeedback('Budget item deleted successfully.')
      setItemToDelete(null)
    } catch (err) {
      setDeleteError(err instanceof BudgetApiError ? err.message : 'Failed to delete budget item')
    }
  }

  return (
    <AdminLayout
      title="Budget"
      breadcrumb={[{ label: 'Dashboard', href: '/admin' }, { label: 'Budget' }]}
    >
      <div className="grid grid-cols-1 gap-4">
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-gray-600 m-0">Total estimated</p>
              <p className="text-2xl font-semibold text-gray-900 m-0 mt-1">
                {formatCurrency(summary?.total_estimated)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-gray-600 m-0">Total actual</p>
              <p className="text-2xl font-semibold text-gray-900 m-0 mt-1">
                {formatCurrency(summary?.total_actual)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-gray-600 m-0">Total paid</p>
              <p className="text-2xl font-semibold text-gray-900 m-0 mt-1">
                {formatCurrency(summary?.total_paid)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-gray-600 m-0">Remaining</p>
              <p className="text-2xl font-semibold text-gray-900 m-0 mt-1">
                {formatCurrency(summary?.remaining)}
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 m-0">Budget</h2>
            <p className="text-sm text-gray-600 m-0 mt-1">{itemCount} line items</p>
          </div>
          <Button type="button" onClick={openCreateDialog}>
            Add Item
          </Button>
        </section>

        {feedback && (
          <Alert variant="success" role="status" aria-live="polite">
            {feedback}
          </Alert>
        )}

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
          <div className="text-sm text-gray-600 border border-gray-200 rounded-md p-4">
            No budget items found.
          </div>
        )}

        {!isLoading && !isError && itemCount > 0 && (
          <div className="rounded-md border border-gray-200">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Estimated</TableHead>
                  <TableHead>Actual</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Payment Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itemList.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium text-gray-900">
                      {displayValue(item.description)}
                    </TableCell>
                    <TableCell>{displayValue(item.category_name)}</TableCell>
                    <TableCell>{displayValue(item.vendor_name)}</TableCell>
                    <TableCell>{formatCurrency(item.estimated_cost)}</TableCell>
                    <TableCell>{formatCurrency(item.actual_cost)}</TableCell>
                    <TableCell>
                      <Badge variant={item.paid ? 'success' : 'neutral'}>
                        {item.paid ? 'Paid' : 'Unpaid'}
                      </Badge>
                    </TableCell>
                    <TableCell>{displayValue(item.payment_date)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          aria-label={`Edit ${item.description ?? 'item'}`}
                          onClick={() => openEditDialog(item)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          aria-label={`Delete ${item.description ?? 'item'}`}
                          onClick={() => requestDelete(item)}
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
                ? 'Update the budget item details and save your changes.'
                : 'Enter the budget item details to track planned and actual spending.'}
            </DialogDescription>
          </DialogHeader>

          <form noValidate onSubmit={handleSubmit} className="grid gap-4">
            {formError && <Alert variant="destructive">{formError}</Alert>}

            <div className="grid gap-2">
              <Label htmlFor="budget-wedding-id">Wedding ID</Label>
              <Input
                id="budget-wedding-id"
                type="number"
                min={1}
                value={form.wedding_id}
                onChange={(event) => updateField('wedding_id', event.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="budget-description">Description</Label>
              <Input
                id="budget-description"
                value={form.description}
                onChange={(event) => updateField('description', event.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="budget-category">Category</Label>
              <Select
                value={form.category_id === '' ? NONE_VALUE : form.category_id}
                onValueChange={(value) =>
                  updateField('category_id', value === NONE_VALUE ? '' : value)
                }
              >
                <SelectTrigger id="budget-category" aria-label="Category">
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
              <Label htmlFor="budget-vendor">Vendor</Label>
              <Select
                value={form.vendor_id === '' ? NONE_VALUE : form.vendor_id}
                onValueChange={(value) =>
                  updateField('vendor_id', value === NONE_VALUE ? '' : value)
                }
              >
                <SelectTrigger id="budget-vendor" aria-label="Vendor">
                  <SelectValue placeholder="Select vendor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>None</SelectItem>
                  {vendorList.map((vendor) => (
                    <SelectItem key={vendor.id} value={String(vendor.id)}>
                      {vendor.vendor_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="budget-estimated">Estimated cost</Label>
                <Input
                  id="budget-estimated"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.estimated_cost}
                  onChange={(event) => updateField('estimated_cost', event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="budget-actual">Actual cost</Label>
                <Input
                  id="budget-actual"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.actual_cost}
                  onChange={(event) => updateField('actual_cost', event.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="budget-paid"
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300"
                checked={form.paid}
                onChange={(event) => updateField('paid', event.target.checked)}
              />
              <Label htmlFor="budget-paid">Paid</Label>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="budget-payment-date">Payment date</Label>
              <Input
                id="budget-payment-date"
                type="date"
                value={form.payment_date}
                onChange={(event) => updateField('payment_date', event.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="budget-notes">Notes</Label>
              <Input
                id="budget-notes"
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
                    ? 'Save Item'
                    : 'Add Item'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={itemToDelete !== null} onOpenChange={(open) => (!open ? cancelDelete() : undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Budget Item</DialogTitle>
            <DialogDescription>
              {itemToDelete
                ? `Delete ${itemToDelete.description ?? 'this item'}? This action cannot be undone.`
                : 'Delete this budget item?'}
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
