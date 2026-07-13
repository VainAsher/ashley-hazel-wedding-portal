import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
} from 'react'

import { ChevronLeft, ChevronRight, Image as ImageIcon, Pause, Play } from 'lucide-react'

import { GuestLayout } from '../components/GuestLayout'
import { Alert } from '../components/ui/alert'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../components/ui/dialog'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { usePageTitle } from '../hooks/usePageTitle'
import {
  GalleryApiError,
  useApprovedGallery,
  useSubmitGalleryItem,
  type GalleryItem,
} from '../hooks/useGallery'

const PAGE_SIZE = 24
const SLIDESHOW_INTERVAL_MS = 4000

// Bulk-loaded photos carry their camera filename as a title
// (e.g. "20260613_120148.jpg", "IMG_1068.JPG"). Show a friendly date
// instead of the filename where we can recover one, nothing otherwise.
const TIMESTAMP_FILENAME = /^(20\d{2})(\d{2})(\d{2})_\d{6}\.\w+$/
const CAMERA_FILENAME = /^(IMG|DSC|PXL|DCIM|WhatsApp Image)[-_ ]?.*\.\w+$/i

function displayLabel(photo: GalleryItem): string | null {
  const title = photo.title?.trim() ?? ''
  if (!title) {
    return null
  }

  const timestamp = TIMESTAMP_FILENAME.exec(title)
  if (timestamp) {
    const [, year, month, day] = timestamp
    const parsed = new Date(`${year}-${month}-${day}T00:00:00`)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    }
    return null
  }

  if (CAMERA_FILENAME.test(title)) {
    return null
  }

  return title
}

function altText(photo: GalleryItem): string {
  return displayLabel(photo) ?? photo.caption?.trim() ?? 'Wedding photo shared by a guest'
}

function GalleryGrid({
  photos,
  onOpen,
}: {
  photos: GalleryItem[]
  onOpen: (index: number) => void
}) {
  return (
    <section
      aria-label="Photo gallery"
      className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
    >
      {photos.map((photo, index) => {
        const label = displayLabel(photo)
        const caption = photo.caption?.trim()
        const isVideo = photo.content_type?.startsWith('video/') ?? false

        return (
          <Card key={photo.id} className="flex flex-col overflow-hidden">
            <figure className="m-0 flex flex-1 flex-col">
              <button
                type="button"
                onClick={() => onOpen(index)}
                className="block w-full cursor-zoom-in border-0 bg-transparent p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label={`View photo full size: ${altText(photo)}`}
              >
                {isVideo ? (
                  <div className="flex aspect-square w-full items-center justify-center bg-gray-900">
                    <Play className="h-10 w-10 text-white" aria-hidden="true" />
                  </div>
                ) : (
                  <img
                    src={photo.thumb_url ?? photo.url}
                    alt={altText(photo)}
                    loading="lazy"
                    decoding="async"
                    className="aspect-square w-full object-cover"
                  />
                )}
              </button>
              {(label || caption) && (
                <figcaption className="flex flex-1 flex-col gap-1 p-3">
                  {label && <span className="text-sm font-semibold text-gray-900">{label}</span>}
                  {caption && <span className="text-sm text-gray-600">{caption}</span>}
                </figcaption>
              )}
            </figure>
          </Card>
        )
      })}
    </section>
  )
}

function Lightbox({
  photos,
  index,
  onClose,
  onNavigate,
}: {
  photos: GalleryItem[]
  index: number
  onClose: () => void
  onNavigate: (index: number) => void
}) {
  const [isPlaying, setIsPlaying] = useState(false)

  const goTo = useCallback(
    (offset: number) => {
      onNavigate((index + offset + photos.length) % photos.length)
    },
    [index, onNavigate, photos.length],
  )

  const currentIsVideo = photos[index]?.content_type?.startsWith('video/') ?? false

  useEffect(() => {
    // Don't auto-advance mid-playback while a video slide is showing —
    // only advance the slideshow timer for photo slides.
    if (!isPlaying || currentIsVideo) {
      return
    }
    const timer = setInterval(() => goTo(1), SLIDESHOW_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [isPlaying, currentIsVideo, goTo])

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      goTo(1)
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      goTo(-1)
    }
  }

  const photo = photos[index]
  if (!photo) {
    return null
  }

  const label = displayLabel(photo)
  const caption = photo.caption?.trim()
  const isVideo = photo.content_type?.startsWith('video/') ?? false

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        onKeyDown={handleKeyDown}
        className="max-w-[96vw] gap-2 border-none bg-black/95 p-2 text-white sm:max-w-5xl sm:p-4 [&>button]:text-white"
      >
        <DialogTitle className="sr-only">
          {label ? `Photo: ${label}` : 'Wedding photo'}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Use the left and right arrow keys to move between photos.
        </DialogDescription>

        <div className="flex min-h-[50vh] items-center justify-center">
          {isVideo ? (
            <video
              key={photo.id}
              src={photo.url}
              controls
              autoPlay={false}
              className="mx-auto max-h-[78vh] w-auto max-w-full object-contain"
            >
              Sorry, your browser can&apos;t play this video.
            </video>
          ) : (
            <img
              src={photo.url}
              alt={altText(photo)}
              className="mx-auto max-h-[78vh] w-auto max-w-full object-contain"
            />
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 text-sm">
            {label && <p className="m-0 truncate font-medium">{label}</p>}
            {caption && <p className="m-0 truncate text-gray-300">{caption}</p>}
            <p className="m-0 text-xs text-gray-400">
              {index + 1} of {photos.length}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 hover:text-white"
              onClick={() => goTo(-1)}
              aria-label="Previous photo"
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 hover:text-white"
              onClick={() => setIsPlaying((playing) => !playing)}
              aria-label={isPlaying ? 'Pause slideshow' : 'Play slideshow'}
            >
              {isPlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 hover:text-white"
              onClick={() => goTo(1)}
              aria-label="Next photo"
            >
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function Gallery() {
  usePageTitle('Gallery')
  const { data: photos, isLoading, isError, error } = useApprovedGallery()
  const submitMutation = useSubmitGalleryItem()

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [caption, setCaption] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const photoList = photos ?? []
  const visiblePhotos = photoList.slice(0, visibleCount)
  const remaining = photoList.length - visiblePhotos.length

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
                  accept="image/*,video/mp4"
                  onChange={handleFileChange}
                  aria-describedby="guest-gallery-file-hint"
                />
                <p id="guest-gallery-file-hint" className="m-0 text-xs text-gray-500">
                  Photos or short videos (MP4), up to 150 MB.
                </p>
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
          <>
            <GalleryGrid photos={visiblePhotos} onOpen={setLightboxIndex} />

            {remaining > 0 && (
              <div className="flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                >
                  Show more photos ({remaining} remaining)
                </Button>
              </div>
            )}
          </>
        )}

        {lightboxIndex !== null && (
          <Lightbox
            photos={photoList}
            index={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
            onNavigate={setLightboxIndex}
          />
        )}
      </div>
    </GuestLayout>
  )
}
