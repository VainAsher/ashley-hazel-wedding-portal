import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'

import { ImageIcon } from 'lucide-react'

import { GuestLayout } from '../components/GuestLayout'
import { Alert } from '../components/ui/alert'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import {
  GalleryApiError,
  useApprovedGallery,
  useSubmitGalleryItem,
  type GalleryItem,
} from '../hooks/useGallery'

function photoLabel(photo: GalleryItem): string {
  return photo.title?.trim() || `Photo ${photo.id}`
}

export function Gallery() {
  const { data: photos, isLoading, isError, error } = useApprovedGallery()
  const submitMutation = useSubmitGalleryItem()

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [caption, setCaption] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const photoList = photos ?? []

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSubmitError(null)
    setFeedback(null)
    setFile(event.target.files?.[0] ?? null)
  }

  const resetForm = () => {
    setFile(null)
    setTitle('')
    setCaption('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitError(null)
    setFeedback(null)

    if (!file) {
      setSubmitError('Please select a photo to share.')
      return
    }

    try {
      await submitMutation.mutateAsync({ file, title, caption })
      setFeedback('Thanks! Your photo was submitted for approval.')
      resetForm()
    } catch (err) {
      setSubmitError(err instanceof GalleryApiError ? err.message : 'Failed to submit photo')
    }
  }

  const isSubmitting = submitMutation.isPending

  return (
    <GuestLayout>
      <div className="max-w-5xl mx-auto w-full grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Gallery</CardTitle>
            <CardDescription>Browse approved photos and share your own.</CardDescription>
          </CardHeader>
        </Card>

        {feedback && (
          <Alert variant="success" role="status" aria-live="polite">
            {feedback}
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Share a photo</CardTitle>
            <CardDescription>
              Submitted photos are reviewed before they appear in the gallery.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form noValidate onSubmit={handleSubmit} className="grid gap-4">
              {submitError && <Alert variant="destructive">{submitError}</Alert>}

              <div className="grid gap-2">
                <Label htmlFor="guest-gallery-file">Photo</Label>
                <Input
                  ref={fileInputRef}
                  id="guest-gallery-file"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="guest-gallery-title">Title</Label>
                  <Input
                    id="guest-gallery-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="guest-gallery-caption">Caption</Label>
                  <Input
                    id="guest-gallery-caption"
                    value={caption}
                    onChange={(event) => setCaption(event.target.value)}
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Submitting...' : 'Submit'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {isLoading && (
          <Card>
            <CardContent className="pt-6">
              <div role="status" className="text-gray-600 text-sm">
                Loading photos...
              </div>
            </CardContent>
          </Card>
        )}

        {isError && !isLoading && (
          <Alert variant="destructive">
            {error instanceof Error ? error.message : 'Failed to load photos'}
          </Alert>
        )}

        {!isLoading && !isError && photoList.length === 0 && (
          <Card className="flex flex-col items-center justify-center gap-3 p-10 text-center">
            <ImageIcon className="h-10 w-10 text-gray-400" aria-hidden="true" />
            <div>
              <h3 className="text-base font-semibold text-gray-900 m-0">No photos yet</h3>
              <p className="text-sm text-gray-600 m-0 mt-1">
                Approved photos will appear here. Be the first to share one!
              </p>
            </div>
          </Card>
        )}

        {!isLoading && !isError && photoList.length > 0 && (
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
                <div className="flex flex-1 flex-col gap-1 p-3">
                  <h3 className="text-sm font-semibold text-gray-900 m-0">{photoLabel(photo)}</h3>
                  {photo.caption && <p className="text-sm text-gray-600 m-0">{photo.caption}</p>}
                </div>
              </Card>
            ))}
          </section>
        )}
      </div>
    </GuestLayout>
  )
}
