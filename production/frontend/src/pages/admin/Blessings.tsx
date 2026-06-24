import { useMemo, useState } from 'react'

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
  BlessingsApiError,
  useAllBlessings,
  useDeleteBlessing,
  useModerateBlessing,
  type BlessingAdmin,
} from '@/hooks/useBlessings'

type VisibilityFilter = 'all' | 'visible' | 'hidden'

function formatDate(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function Blessings() {
  const { data: blessings, isLoading, isError, error } = useAllBlessings()

  const moderateMutation = useModerateBlessing()
  const deleteMutation = useDeleteBlessing()

  const [filter, setFilter] = useState<VisibilityFilter>('all')
  const [blessingToDelete, setBlessingToDelete] = useState<BlessingAdmin | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const blessingList = blessings ?? []

  const counts = useMemo(() => {
    const visible = blessingList.filter((blessing) => !blessing.hidden).length
    return {
      all: blessingList.length,
      visible,
      hidden: blessingList.length - visible,
    }
  }, [blessingList])

  const filteredBlessings = useMemo(() => {
    if (filter === 'visible') {
      return blessingList.filter((blessing) => !blessing.hidden)
    }
    if (filter === 'hidden') {
      return blessingList.filter((blessing) => blessing.hidden)
    }
    return blessingList
  }, [blessingList, filter])

  const blessingCount = filteredBlessings.length

  const handleModerate = async (blessing: BlessingAdmin) => {
    setFeedback(null)
    setActionError(null)

    try {
      await moderateMutation.mutateAsync({ id: blessing.id, hidden: !blessing.hidden })
      setFeedback(blessing.hidden ? 'Blessing is now visible.' : 'Blessing is now hidden.')
    } catch (err) {
      setActionError(
        err instanceof BlessingsApiError ? err.message : 'Failed to update blessing',
      )
    }
  }

  const requestDelete = (blessing: BlessingAdmin) => {
    setFeedback(null)
    setActionError(null)
    setDeleteError(null)
    setBlessingToDelete(blessing)
  }

  const cancelDelete = () => {
    setBlessingToDelete(null)
    setDeleteError(null)
  }

  const confirmDelete = async () => {
    if (!blessingToDelete) {
      return
    }

    try {
      await deleteMutation.mutateAsync(blessingToDelete.id)
      setFeedback('Blessing deleted successfully.')
      setBlessingToDelete(null)
    } catch (err) {
      setDeleteError(
        err instanceof BlessingsApiError ? err.message : 'Failed to delete blessing',
      )
    }
  }

  return (
    <AdminLayout
      title="Blessings"
      breadcrumb={[{ label: 'Dashboard', href: '/admin' }, { label: 'Blessings' }]}
    >
      <div className="grid gap-4">
        <section className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 m-0">Blessings</h2>
            <p className="text-sm text-gray-600 m-0 mt-1">
              {counts.all} total, {counts.visible} visible, {counts.hidden} hidden
            </p>
          </div>
          <div className="grid gap-1">
            <Label htmlFor="visibility-filter" className="sr-only">
              Filter by visibility
            </Label>
            <Select
              value={filter}
              onValueChange={(value) => setFilter(value as VisibilityFilter)}
            >
              <SelectTrigger
                id="visibility-filter"
                aria-label="Filter by visibility"
                className="w-40"
              >
                <SelectValue placeholder="All blessings" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All ({counts.all})</SelectItem>
                <SelectItem value="visible">Visible ({counts.visible})</SelectItem>
                <SelectItem value="hidden">Hidden ({counts.hidden})</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </section>

        {feedback && (
          <Alert variant="success" role="status" aria-live="polite">
            {feedback}
          </Alert>
        )}

        {actionError && <Alert variant="destructive">{actionError}</Alert>}

        {isLoading && (
          <div
            role="status"
            className="text-sm text-gray-600 border border-gray-200 rounded-md p-4"
          >
            Loading blessings...
          </div>
        )}

        {isError && !isLoading && (
          <Alert variant="destructive">
            {error instanceof Error ? error.message : 'Failed to load blessings'}
          </Alert>
        )}

        {!isLoading && !isError && blessingCount === 0 && (
          <div className="text-sm text-gray-600 border border-gray-200 rounded-md p-4">
            No blessings found.
          </div>
        )}

        {!isLoading && !isError && blessingCount > 0 && (
          <div className="rounded-md border border-gray-200">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Author</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBlessings.map((blessing) => (
                  <TableRow key={blessing.id}>
                    <TableCell className="font-medium text-gray-900">
                      {blessing.author_name}
                    </TableCell>
                    <TableCell>{blessing.message}</TableCell>
                    <TableCell>{formatDate(blessing.created_at)}</TableCell>
                    <TableCell>
                      <Badge variant={blessing.hidden ? 'warning' : 'success'}>
                        {blessing.hidden ? 'Hidden' : 'Visible'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          aria-label={`${blessing.hidden ? 'Unhide' : 'Hide'} blessing from ${blessing.author_name}`}
                          disabled={moderateMutation.isPending}
                          onClick={() => void handleModerate(blessing)}
                        >
                          {blessing.hidden ? 'Unhide' : 'Hide'}
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          aria-label={`Delete blessing from ${blessing.author_name}`}
                          onClick={() => requestDelete(blessing)}
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

      {/* Delete confirmation dialog */}
      <Dialog
        open={blessingToDelete !== null}
        onOpenChange={(open) => (!open ? cancelDelete() : undefined)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Blessing</DialogTitle>
            <DialogDescription>
              {blessingToDelete
                ? `Delete the blessing from ${blessingToDelete.author_name}? This action cannot be undone.`
                : 'Delete this blessing?'}
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
