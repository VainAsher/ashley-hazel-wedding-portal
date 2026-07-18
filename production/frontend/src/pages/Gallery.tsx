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

// The primary photo/video display -- one photo at a time (hero), not a
// grid. Plain markup, not a Dialog: this is the default view of the page
// now (see GalleryContent below), and when Gallery is mounted inside the
// Celebrate hub's own modal, nesting a second Dialog here would double
// focus-trap/scroll-lock. Keyboard nav is scoped to this element's own
// focus (tabIndex + onKeyDown) rather than a window-level listener, so it
// doesn't fight the paged deck's own arrow-key slide navigation.
function GalleryViewer({
  photos,
  index,
  onNavigate,
}: {
  photos: GalleryItem[]
  index: number
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
    <div
      onKeyDown={handleKeyDown}
      tabIndex={0}
      className="grid gap-2 rounded-2xl bg-black/95 p-2 text-white outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-4"
    >
      <div className="flex min-h-[50vh] items-center justify-center">
        {isVideo ? (
          <video
            key={photo.id}
            src={photo.url}
            controls
            autoPlay={false}
            className="mx-auto max-h-[60vh] w-auto max-w-full object-contain"
          >
            Sorry, your browser can&apos;t play this video.
          </video>
        ) : (
          <img
            src={photo.url}
            alt={altText(photo)}
            className="mx-auto max-h-[60vh] w-auto max-w-full object-contain"
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
    </div>
  )
}

// Secondary navigation for the hero above -- a scrollable strip of
// thumbnails standing in for the old full grid.
function GalleryFilmstrip({
  photos,
  activeIndex,
  onSelect,
}: {
  photos: GalleryItem[]
  activeIndex: number
  onSelect: (index: number) => void
}) {
  return (
    <div aria-label="Photo filmstrip" className="flex gap-2 overflow-x-auto pb-1">
      {photos.map((photo, index) => {
        const isVideo = photo.content_type?.startsWith('video/') ?? false
        const active = index === activeIndex

        return (
          <button
            key={photo.id}
            type="button"
            onClick={() => onSelect(index)}
            aria-current={active}
            aria-label={`View photo ${index + 1} of ${photos.length}: ${altText(photo)}`}
            className={`block flex-shrink-0 overflow-hidden rounded-lg border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              active ? 'border-gold' : 'border-transparent'
            }`}
          >
            {isVideo ? (
              <div className="flex h-14 w-14 items-center justify-center bg-gray-900">
                <Play className="h-5 w-5 text-white" aria-hidden="true" />
              </div>
            ) : (
              <img
                src={photo.thumb_url ?? photo.url}
                alt=""
                loading="lazy"
                decoding="async"
                className="h-14 w-14 object-cover"
              />
            )}
          </button>
        )
      })}
    </div>
  )
}

// Mounted inside a modal by CelebrateContent (see Celebrate.tsx), which owns
// this route's document title -- no usePageTitle call here, since unmounting
// on modal close would otherwise reset the tab title to the generic site
// default instead of back to "Celebrate".
export function GalleryContent() {
  const { data: photos, isLoading, isError, error } = useApprovedGallery()
  const submitMutation = useSubmitGalleryItem()

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [caption, setCaption] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  const photoList = photos ?? []
  const safeIndex = photoList.length > 0 ? Math.min(activeIndex, photoList.length - 1) : 0

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
      setSubmitError(err instanceof GalleryApiError ? err.message : 'Unable to submit your photo.')
    }
  }

  const isSubmitting = submitMutation.isPending

  return (
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
          {error instanceof Error ? error.message : 'Unable to load photos.'}
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
        <div className="grid gap-3">
          <GalleryViewer photos={photoList} index={safeIndex} onNavigate={setActiveIndex} />
          <GalleryFilmstrip photos={photoList} activeIndex={safeIndex} onSelect={setActiveIndex} />
        </div>
      )}

      <details className="rounded-lg">
        <summary className="cursor-pointer list-none rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-plum [&::-webkit-details-marker]:hidden">
          Share a photo
        </summary>
        <Card className="mt-2">
          <CardHeader>
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
                    placeholder="Add a title (optional)"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="guest-gallery-caption">Caption</Label>
                  <Input
                    id="guest-gallery-caption"
                    value={caption}
                    onChange={(event) => setCaption(event.target.value)}
                    placeholder="Add a caption (optional)"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Sharing...' : 'Share photo'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </details>
    </div>
  )
}
