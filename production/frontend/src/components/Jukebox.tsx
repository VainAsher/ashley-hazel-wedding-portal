import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Music2, Pause, Play, SkipBack, SkipForward } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { SongRequest } from '@/hooks/useMusic'

/**
 * The Dancefloor jukebox: loops 30-second previews of the approved playlist.
 *
 * Songs without a matched preview are simply left out of the queue; a track
 * that fails to load is skipped. Playback starts from a user tap (browser
 * autoplay policy). Styled after the prototype's "Currently playing" widget.
 */
export function Jukebox({ songs }: { songs: SongRequest[] }) {
  const queue = useMemo(
    () => songs.filter((song): song is SongRequest & { preview_url: string } =>
      Boolean(song.preview_url),
    ),
    [songs],
  )

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [index, setIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)

  const current = queue.length > 0 ? queue[index % queue.length] : null

  const goTo = useCallback(
    (offset: number) => {
      if (queue.length === 0) {
        return
      }
      setProgress(0)
      setIndex((value) => (value + offset + queue.length) % queue.length)
    },
    [queue.length],
  )

  // Swap the source when the track changes; keep playing if we already were.
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !current) {
      return
    }
    if (audio.src !== current.preview_url) {
      audio.src = current.preview_url
      setProgress(0)
      if (isPlaying) {
        audio.play().catch(() => setIsPlaying(false))
      }
    }
    // isPlaying intentionally not a dependency: play/pause has its own handler.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current])

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio || !current) {
      return
    }
    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
    }
  }

  if (!current) {
    return null
  }

  const displayTitle = current.artist
    ? `${current.title} — ${current.artist}`
    : current.title

  return (
    <section
      aria-label="Jukebox"
      className="rounded-3xl border-2 border-gold bg-plum p-5 text-cream shadow-xl"
    >
      <p className="m-0 text-xs font-extrabold uppercase tracking-[0.18em] text-gold">
        Now playing
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-4">
        {current.artwork_url ? (
          <img
            src={current.artwork_url}
            alt=""
            className="h-16 w-16 flex-shrink-0 rounded-xl object-cover ring-2 ring-gold/60"
          />
        ) : (
          <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-xl bg-cream/10 ring-2 ring-gold/60">
            <Music2 className="h-7 w-7 text-gold" aria-hidden="true" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="m-0 truncate font-display text-lg font-bold" data-testid="jukebox-title">
            {displayTitle}
          </p>
          <p className="m-0 truncate text-sm text-cream/80">
            Requested by {current.requested_by}
          </p>
          {current.dedication && (
            <p className="m-0 truncate text-sm italic text-cream/70">
              “{current.dedication}”
            </p>
          )}
        </div>

        <div className="flex flex-shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-cream hover:bg-cream/15 hover:text-gold"
            onClick={() => goTo(-1)}
            aria-label="Previous song"
          >
            <SkipBack aria-hidden="true" />
          </Button>
          <Button
            type="button"
            size="icon"
            className="h-12 w-12 rounded-full"
            onClick={togglePlay}
            aria-label={isPlaying ? 'Pause the jukebox' : 'Play the jukebox'}
          >
            {isPlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-cream hover:bg-cream/15 hover:text-gold"
            onClick={() => goTo(1)}
            aria-label="Next song"
          >
            <SkipForward aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* 30-second progress bar */}
      <div
        className="mt-4 h-1.5 overflow-hidden rounded-full bg-cream/15"
        role="progressbar"
        aria-label="Preview progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
      >
        <div
          className="h-full bg-gold transition-[width] duration-300 ease-linear"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <p className="m-0 mt-3 text-right text-[11px] text-cream/50">
        {index + 1} of {queue.length} · 30-second previews via Apple Music
      </p>

      <audio
        ref={audioRef}
        data-testid="jukebox-audio"
        preload="none"
        onEnded={() => goTo(1)}
        onError={() => {
          // A rotted preview URL shouldn't stall the party — skip it.
          if (queue.length > 1) {
            goTo(1)
          } else {
            setIsPlaying(false)
          }
        }}
        onTimeUpdate={(event) => {
          const audio = event.currentTarget
          if (audio.duration > 0) {
            setProgress(audio.currentTime / audio.duration)
          }
        }}
      />
    </section>
  )
}
