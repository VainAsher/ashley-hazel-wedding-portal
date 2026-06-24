import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'

import { ImageIcon } from 'lucide-react'

import { AdminLayout } from '@/components/AdminLayout'
import { Alert } from '@/components/ui/alert'
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
  useUploadGalleryItem,
  type GalleryItem,
  type GalleryStatus,
} from '@/hooks/useGallery'

const STATUS_STYLES: Record<GalleryStatus, string> = {
  approved: 'bg-green-100 text-green-800',
  pending: 'bg-amber-100 text-amber-800',
  rejected: 'bg-red-100 text-red-800',
}

function StatusBadge({ status }: { status: GalleryStatus }) {
  const className = STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-700'
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${className}`}
    >
      {status}
    </span>
  )
}

export function Gallery() {
  const { data: photos, isLoading, isError, error } = useGallery()

  const uploadMutation = useUploadGalleryItem()
  const deleteMutation = useDeleteGalleryItem()

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [caption, setCaption] = useState('')
  const [uploadError, setUploadError] = useState<string | null>(null)

  const [photoToDelete, setPhotoToDelete] = useState<GalleryItem | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [feedback, setFeedback] = useState<string | null>(null)

  const photoList = photos ?? []
  const photoCount = photoList.length

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
            <h2 className="text-xl font-semibold text-gray-900 m-0">Photos</h2>
            <p className="text-sm text-gray-600 m-0 mt-1">{photoCount} photos</p>
          </div>
        </section>

        {feedback && (
          <Alert variant="success" role="status" aria-live="polite">
            {feedback}
          </Alert>
        )}

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

        {!isLoading && !isError && photoCount === 0 && (
          <Card className="flex flex-col items-center justify-center gap-3 p-10 text-center">
            <ImageIcon className="h-10 w-10 text-gray-400" aria-hidden="true" />
            <div>
              <h3 className="text-base font-semibold text-gray-900 m-0">No photos yet</h3>
              <p className="text-sm text-gray-600 m-0 mt-1">
                Photos uploaded for the wedding gallery will appear here.
              </p>
            </div>
          </Card>
        )}

        {!isLoading && !isError && photoCount > 0 && (
          <section
            aria-label="Photo gallery"
            className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
          >
            {photoList.map((photo) => (
              <Card key={photo.id} className="flex flex-col overflow-hidden">
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
                  <div className="mt-auto pt-1">
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
            ))}
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
