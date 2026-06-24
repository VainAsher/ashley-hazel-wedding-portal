import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'

import { ImageIcon } from 'lucide-react'

import { AdminLayout } from '@/components/AdminLayout'
import { Alert } from '@/components/ui/alert'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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
  GalleryApiError,
  useDeleteGalleryItem,
  useGallery,
  useUpdateGalleryItem,
  useUploadGalleryItem,
  type GalleryItem,
  type GalleryStatus,
} from '@/hooks/useGallery'

const STATUS_VARIANT: Record<GalleryStatus, BadgeProps['variant']> = {
  approved: 'success',
  pending: 'warning',
  rejected: 'danger',
}

type StatusFilter = 'all' | GalleryStatus

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

function StatusBadge({ status }: { status: GalleryStatus }) {
  return (
    <Badge variant={STATUS_VARIANT[status] ?? 'neutral'} className="capitalize">
      {status}
    </Badge>
  )
}

export function Gallery() {
  const { data: photos, isLoading, isError, error } = useGallery()

  const uploadMutation = useUploadGalleryItem()
  const deleteMutation = useDeleteGalleryItem()
  const updateMutation = useUpdateGalleryItem()

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [caption, setCaption] = useState('')
  const [uploadError, setUploadError] = useState<string | null>(null)

  const [photoToDelete, setPhotoToDelete] = useState<GalleryItem | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [feedback, setFeedback] = useState<string | null>(null)
  const [moderateError, setModerateError] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<number | null>(null)

  const [filter, setFilter] = useState<StatusFilter>('all')

  const photoList = photos ?? []

  const counts = useMemo(() => {
    const base = { all: photoList.length, pending: 0, approved: 0, rejected: 0 }
    for (const photo of photoList) {
      base[photo.status] += 1
    }
    return base
  }, [photoList])

  const visiblePhotos = useMemo(
    () => (filter === 'all' ? photoList : photoList.filter((photo) => photo.status === filter)),
    [photoList, filter],
  )

  const isUploading = uploadMutation.isPending

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setUploadError(null)
    setFeedback(null)
    setFile(event.target.files?.[0] ?? null)
  }

  const resetUploadForm = () => {
    setFile(null)
    setTitle('')
    setCaption('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setUploadError(null)

    if (!file) {
      setUploadError('Please select an image to upload.')
      return
    }

    try {
      await uploadMutation.mutateAsync({ file, title, caption })
      setFeedback('Photo uploaded successfully.')
      resetUploadForm()
    } catch (err) {
      setUploadError(err instanceof GalleryApiError ? err.message : 'Failed to upload photo')
    }
  }

  const moderate = async (photo: GalleryItem, status: GalleryStatus) => {
    setFeedback(null)
    setModerateError(null)
    setPendingId(photo.id)

    try {
      await updateMutation.mutateAsync({ id: photo.id, payload: { status } })
      setFeedback(
        status === 'approved'
          ? `${photoLabel(photo)} approved.`
          : `${photoLabel(photo)} rejected.`,
      )
    } catch (err) {
      setModerateError(err instanceof GalleryApiError ? err.message : 'Failed to update photo')
    } finally {
      setPendingId(null)
    }
  }

  const requestDelete = (photo: GalleryItem) => {
    setFeedback(null)
    setDeleteError(null)
    setPhotoToDelete(photo)
  }

  const cancelDelete = () => {
    setPhotoToDelete(null)
    setDeleteError(null)
  }

  const confirmDelete = async () => {
    if (!photoToDelete) {
      return
    }

    try {
      await deleteMutation.mutateAsync(photoToDelete.id)
      setFeedback('Photo deleted successfully.')
      setPhotoToDelete(null)
    } catch (err) {
      setDeleteError(err instanceof GalleryApiError ? err.message : 'Failed to delete photo')
    }
  }

  const photoLabel = (photo: GalleryItem) => photo.title?.trim() || `Photo ${photo.id}`

  return (
    <AdminLayout
      title="Gallery"
      breadcrumb={[{ label: 'Dashboard', href: '/admin' }, { label: 'Gallery' }]}
    >
      <div className="grid gap-4">
        <section className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 m-0">Moderation Queue</h2>
            <p className="text-sm text-gray-600 m-0 mt-1">
              {counts.all} photos · {counts.pending} pending review
            </p>
          </div>
        </section>

        {feedback && (
          <Alert variant="success" role="status" aria-live="polite">
            {feedback}
          </Alert>
        )}

        {moderateError && <Alert variant="destructive">{moderateError}</Alert>}

        <Card className="p-4">
          <form noValidate onSubmit={handleUpload} className="grid gap-4">
            <div>
              <h3 className="text-base font-semibold text-gray-900 m-0">Upload a photo</h3>
              <p className="text-sm text-gray-600 m-0 mt-1">
                Add a new image to the wedding gallery.
              </p>
            </div>

            {uploadError && <Alert variant="destructive">{uploadError}</Alert>}

            <div className="grid gap-2">
              <Label htmlFor="gallery-file">Image</Label>
              <Input
                ref={fileInputRef}
                id="gallery-file"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="gallery-title">Title</Label>
                <Input
                  id="gallery-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="gallery-caption">Caption</Label>
                <Input
                  id="gallery-caption"
                  value={caption}
                  onChange={(event) => setCaption(event.target.value)}
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={isUploading}>
                {isUploading ? 'Uploading...' : 'Upload'}
              </Button>
            </div>
          </form>
        </Card>

        <section
          aria-label="Filter by status"
          className="flex flex-wrap gap-2"
          role="group"
        >
          {FILTERS.map((option) => (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={filter === option.value ? 'default' : 'outline'}
              aria-pressed={filter === option.value}
              onClick={() => setFilter(option.value)}
            >
              {option.label} ({counts[option.value]})
            </Button>
          ))}
        </section>

        {isLoading && (
          <div role="status" className="text-sm text-gray-600 border border-gray-200 rounded-md p-4">
            Loading photos...
          </div>
        )}

        {isError && !isLoading && (
          <Alert variant="destructive">
            {error instanceof Error ? error.message : 'Failed to load photos'}
          </Alert>
        )}

        {!isLoading && !isError && visiblePhotos.length === 0 && (
          <Card className="flex flex-col items-center justify-center gap-3 p-10 text-center">
            <ImageIcon className="h-10 w-10 text-gray-400" aria-hidden="true" />
            <div>
              <h3 className="text-base font-semibold text-gray-900 m-0">
                {filter === 'all' ? 'No photos yet' : `No ${filter} photos`}
              </h3>
              <p className="text-sm text-gray-600 m-0 mt-1">
                {filter === 'all'
                  ? 'Photos uploaded for the wedding gallery will appear here.'
                  : 'Try a different status filter.'}
              </p>
            </div>
          </Card>
        )}

        {!isLoading && !isError && visiblePhotos.length > 0 && (
          <section
            aria-label="Photo gallery"
            className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
          >
            {visiblePhotos.map((photo) => {
              const isRowPending = pendingId === photo.id && updateMutation.isPending
              return (
                <Card
                  key={photo.id}
                  className={`flex flex-col overflow-hidden${
                    photo.status === 'pending' ? ' ring-2 ring-amber-400' : ''
                  }`}
                >
                  <img
                    src={photo.url}
                    alt={photoLabel(photo)}
                    className="aspect-square w-full object-cover"
                  />
                  <div className="flex flex-1 flex-col gap-2 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-gray-900 m-0">
                        {photoLabel(photo)}
                      </h3>
                      <StatusBadge status={photo.status} />
                    </div>
                    {photo.caption && (
                      <p className="text-sm text-gray-600 m-0">{photo.caption}</p>
                    )}
                    <div className="mt-auto flex flex-wrap gap-2 pt-1">
                      {photo.status !== 'approved' && (
                        <Button
                          type="button"
                          variant="default"
                          size="sm"
                          aria-label={`Approve ${photoLabel(photo)}`}
                          disabled={isRowPending}
                          onClick={() => void moderate(photo, 'approved')}
                        >
                          Approve
                        </Button>
                      )}
                      {photo.status !== 'rejected' && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          aria-label={`Reject ${photoLabel(photo)}`}
                          disabled={isRowPending}
                          onClick={() => void moderate(photo, 'rejected')}
                        >
                          Reject
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        aria-label={`Delete ${photoLabel(photo)}`}
                        onClick={() => requestDelete(photo)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </Card>
              )
            })}
          </section>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog
        open={photoToDelete !== null}
        onOpenChange={(open) => (!open ? cancelDelete() : undefined)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Photo</DialogTitle>
            <DialogDescription>
              {photoToDelete
                ? `Delete ${photoLabel(photoToDelete)}? This action cannot be undone.`
                : 'Delete this photo?'}
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
