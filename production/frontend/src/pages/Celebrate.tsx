import { useState } from 'react'

import { Heart, Image as ImageIcon, Music2 } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../components/ui/dialog'
import { usePageTitle } from '../hooks/usePageTitle'
import { useBlessings } from '../hooks/useBlessings'
import { useApprovedGallery } from '../hooks/useGallery'
import { useSongWall } from '../hooks/useMusic'
import { BlessingsContent } from './Blessings'
import { GalleryContent } from './Gallery'
import { MusicContent, songDisplayTitle } from './Music'

type CelebrateModal = 'blessings' | 'music' | 'gallery' | null

function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

function LauncherCard({
  icon: Icon,
  title,
  teaser,
  onOpen,
}: {
  icon: typeof Heart
  title: string
  teaser: string
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open ${title}: ${teaser}`}
      className="block w-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <Card className="h-full transition-shadow hover:shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Icon className="h-5 w-5 text-plum" aria-hidden="true" />
            {title}
          </CardTitle>
          <CardDescription>{teaser}</CardDescription>
        </CardHeader>
      </Card>
    </button>
  )
}

const MODAL_DIALOG_CLASSNAME = 'max-h-[85vh] max-w-[96vw] overflow-y-auto sm:max-w-3xl'

// Consolidates Blessings, Dancefloor, and Gallery onto one screen as
// launcher cards that open their existing content in a modal, replacing
// what used to be three separate paged-deck pages. No GuestLayout wrapper --
// App.tsx routes directly to this (both in scroll mode, via the shared
// PagedGuestLayoutRoute's <Outlet/>, and in paged mode, mounted inside
// PagedGuestDeck).
export function CelebrateContent() {
  usePageTitle('Celebrate')
  const [openModal, setOpenModal] = useState<CelebrateModal>(null)

  // Same React Query cache keys the modals' own *Content components use --
  // this doesn't duplicate a fetch, it just subscribes to (and, on first
  // mount here, kicks off) the same cached query so the teaser line has data
  // before a guest ever opens a modal.
  const { data: blessings } = useBlessings()
  const { data: wall } = useSongWall()
  const { data: photos } = useApprovedGallery()

  const musicTeaser = wall?.now_playing
    ? `Now playing — ${songDisplayTitle(wall.now_playing)}`
    : pluralize(wall?.songs.length ?? 0, 'song')

  return (
    <div className="max-w-4xl mx-auto w-full grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Celebrate</CardTitle>
          <CardDescription>
            Blessings, the dancefloor, and the photo gallery — all in one place.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* 7-column grid: the outer column on each side is a reserved
          margin/notification rail, leaving a 5-wide working area for the
          three launcher cards. */}
      <div className="grid grid-cols-7 gap-4">
        <div className="col-start-2 col-span-5 grid gap-4 sm:grid-cols-3">
          <LauncherCard
            icon={Heart}
            title="Blessings"
            teaser={pluralize(blessings?.length ?? 0, 'blessing')}
            onOpen={() => setOpenModal('blessings')}
          />
          <LauncherCard
            icon={Music2}
            title="Dancefloor"
            teaser={musicTeaser}
            onOpen={() => setOpenModal('music')}
          />
          <LauncherCard
            icon={ImageIcon}
            title="Gallery"
            teaser={pluralize(photos?.length ?? 0, 'photo')}
            onOpen={() => setOpenModal('gallery')}
          />
        </div>
      </div>

      <Dialog open={openModal === 'blessings'} onOpenChange={(open) => !open && setOpenModal(null)}>
        <DialogContent className={MODAL_DIALOG_CLASSNAME}>
          <DialogTitle className="sr-only">Blessings</DialogTitle>
          <DialogDescription className="sr-only">
            Leave a message for the happy couple.
          </DialogDescription>
          <BlessingsContent />
        </DialogContent>
      </Dialog>

      <Dialog open={openModal === 'music'} onOpenChange={(open) => !open && setOpenModal(null)}>
        <DialogContent className={MODAL_DIALOG_CLASSNAME}>
          <DialogTitle className="sr-only">Dancefloor</DialogTitle>
          <DialogDescription className="sr-only">
            Request a song and see what everyone else picked.
          </DialogDescription>
          <MusicContent />
        </DialogContent>
      </Dialog>

      <Dialog open={openModal === 'gallery'} onOpenChange={(open) => !open && setOpenModal(null)}>
        <DialogContent className={MODAL_DIALOG_CLASSNAME}>
          <DialogTitle className="sr-only">Gallery</DialogTitle>
          <DialogDescription className="sr-only">
            Browse approved photos and share your own.
          </DialogDescription>
          <GalleryContent />
        </DialogContent>
      </Dialog>
    </div>
  )
}
