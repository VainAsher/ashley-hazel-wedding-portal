import { useState, type FormEvent } from 'react'

import { Heart, Music2 } from 'lucide-react'

import { useAuth } from '../contexts/AuthContext'
import { Jukebox } from '../components/Jukebox'
import { MentionHighlightedText } from '../components/mentions/MentionHighlight'
import { MentionTextarea } from '../components/mentions/MentionTextarea'
import { Alert } from '../components/ui/alert'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { useMentionsDirectory, type MentionDirectoryEntry } from '../hooks/useMentions'
import {
  MusicApiError,
  useSongWall,
  useSubmitSongRequest,
  useToggleReaction,
  type SongWallItem,
} from '../hooks/useMusic'

function optionalText(value: string): string | null {
  const trimmed = value.trim()
  return trimmed || null
}

export function songDisplayTitle(song: SongWallItem): string {
  return song.artist ? `${song.title} — ${song.artist}` : song.title
}

function SongCard({
  song,
  mentionDirectory,
}: {
  song: SongWallItem
  mentionDirectory: MentionDirectoryEntry[]
}) {
  const toggleReaction = useToggleReaction()

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="grid gap-1.5 min-w-0">
            <CardTitle className="text-base">
              {song.pinned && (
                <span title="Pinned" className="text-gold mr-1.5">
                  ★
                </span>
              )}
              {songDisplayTitle(song)}
            </CardTitle>
            <CardDescription>Requested by {song.requested_by}</CardDescription>
          </div>
          <button
            type="button"
            aria-pressed={song.reacted_by_me}
            aria-label={
              song.reacted_by_me
                ? `Remove your heart from ${song.title}`
                : `Give a heart to ${song.title}`
            }
            onClick={() => toggleReaction.mutate(song)}
            className={`flex flex-shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
              song.reacted_by_me
                ? 'border-gold bg-plum text-gold'
                : 'border-gray-300 bg-background text-gray-600 hover:border-plum hover:text-plum'
            }`}
          >
            <Heart
              aria-hidden="true"
              className={`h-4 w-4 ${song.reacted_by_me ? 'fill-current' : ''}`}
            />
            <span data-testid="reaction-count">{song.reaction_count}</span>
          </button>
        </div>
      </CardHeader>
      {song.dedication && (
        <CardContent>
          <p className="text-sm text-gray-700 italic m-0 whitespace-pre-wrap">
            <MentionHighlightedText text={song.dedication} directory={mentionDirectory} />
          </p>
        </CardContent>
      )}
    </Card>
  )
}

/** The couple's wedding-day pick — shown above the jukebox while it is set. */
function NowPlayingCard({ song }: { song: SongWallItem }) {
  return (
    <section
      aria-label="Currently playing"
      className="rounded-3xl border-2 border-gold bg-plum p-5 text-cream shadow-xl"
    >
      <p className="m-0 text-xs font-extrabold uppercase tracking-[0.18em] text-gold">
        <span className="mr-1.5 inline-block animate-pulse" aria-hidden="true">
          ♪
        </span>
        Currently playing
      </p>
      <div className="mt-3 flex items-center gap-4">
        {song.artwork_url ? (
          <img
            src={song.artwork_url}
            alt=""
            className="h-16 w-16 flex-shrink-0 rounded-xl object-cover ring-2 ring-gold/60"
          />
        ) : (
          <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-xl bg-cream/10 ring-2 ring-gold/60">
            <Music2 className="h-7 w-7 animate-pulse text-gold" aria-hidden="true" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p
            className="m-0 truncate font-display text-lg font-bold"
            data-testid="now-playing-title"
          >
            {songDisplayTitle(song)}
          </p>
          <p className="m-0 truncate text-sm text-cream/80">Picked by Ashley &amp; Hazel</p>
        </div>
      </div>
    </section>
  )
}

// Mounted inside a modal by CelebrateContent (see Celebrate.tsx), which owns
// this route's document title -- no usePageTitle call here, since unmounting
// on modal close would otherwise reset the tab title to the generic site
// default instead of back to "Celebrate".
export function MusicContent() {
  const { data: wall, isLoading, isError, error } = useSongWall()
  const submitMutation = useSubmitSongRequest()
  const { data: mentionDirectory } = useMentionsDirectory('general')

  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [link, setLink] = useState('')
  const [dedication, setDedication] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  // Wedding phase comes from the shared auth context (single /api/auth/me
  // query) instead of a page-level fetch. If we cannot read the phase, keep
  // the form available — the backend still enforces the phase gate on
  // submission.
  const { weddingPhase, loading: authLoading } = useAuth()
  const phase = authLoading ? null : weddingPhase ?? 'live'

  const songList = wall?.songs ?? []
  const nowPlaying = wall?.now_playing ?? null
  const requestsOpen = phase === 'live'
  const requestsClosed = phase !== null && phase !== 'live'

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitError(null)
    setFeedback(null)

    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setSubmitError('Please enter a song title.')
      return
    }

    try {
      await submitMutation.mutateAsync({
        title: trimmedTitle,
        artist: optionalText(artist),
        source_url: optionalText(link),
        dedication: optionalText(dedication),
      })
      setFeedback('Thanks! Your song request is with Ashley & Hazel.')
      setTitle('')
      setArtist('')
      setLink('')
      setDedication('')
    } catch (err) {
      setSubmitError(
        err instanceof MusicApiError ? err.message : 'Unable to submit your song request.',
      )
    }
  }

  const isSubmitting = submitMutation.isPending

  return (
      <div className="max-w-3xl mx-auto w-full grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Dancefloor</CardTitle>
            <CardDescription>
              Help build the wedding soundtrack — request a song and see what everyone else
              picked.
            </CardDescription>
          </CardHeader>
        </Card>

        {nowPlaying && <NowPlayingCard song={nowPlaying} />}

        {songList.length > 0 && <Jukebox songs={songList} />}

        {feedback && (
          <Alert variant="success" role="status" aria-live="polite">
            {feedback}
          </Alert>
        )}

        {requestsClosed && (
          <Card>
            <CardContent className="pt-6">
              <div role="status" className="text-gray-700 text-sm">
                Song requests aren&apos;t open yet — check back soon.
              </div>
            </CardContent>
          </Card>
        )}

        {requestsOpen && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Request a song</CardTitle>
            </CardHeader>
            <CardContent>
              <form noValidate onSubmit={handleSubmit} className="grid gap-4">
                {submitError && <Alert variant="destructive">{submitError}</Alert>}

                <div className="grid gap-2">
                  <Label htmlFor="song-title">Song title</Label>
                  <Input
                    id="song-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    maxLength={255}
                    placeholder="Song title"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="song-artist">Artist</Label>
                  <Input
                    id="song-artist"
                    value={artist}
                    onChange={(event) => setArtist(event.target.value)}
                    maxLength={255}
                    placeholder="Artist (optional)"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="song-link">Link</Label>
                  <Input
                    id="song-link"
                    value={link}
                    onChange={(event) => setLink(event.target.value)}
                    maxLength={500}
                    placeholder="Spotify or YouTube link (optional)"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="song-dedication">Dedication</Label>
                  <MentionTextarea
                    id="song-dedication"
                    scope="general"
                    value={dedication}
                    onChange={setDedication}
                    rows={3}
                    maxLength={500}
                    placeholder="A dedication or message (optional, @ to mention someone)"
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-base resize-vertical focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <p className="text-xs text-gray-600 m-0">
                    Dedications appear publicly on the song wall.
                  </p>
                </div>

                <div className="flex justify-end">
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Sending...' : 'Request song'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {isLoading && (
          <Card>
            <CardContent className="pt-6">
              <div role="status" className="text-gray-600 text-sm">
                Loading the song wall...
              </div>
            </CardContent>
          </Card>
        )}

        {isError && !isLoading && (
          <Alert variant="destructive">
            {error instanceof Error ? error.message : 'Unable to load the song wall.'}
          </Alert>
        )}

        {!isLoading && !isError && songList.length === 0 && (
          <Card className="flex flex-col items-center justify-center gap-3 p-10 text-center">
            <Music2 className="h-10 w-10 text-gray-400" aria-hidden="true" />
            <p className="text-sm text-gray-600 m-0">
              No songs yet — be the first to get the dancefloor going!
            </p>
          </Card>
        )}

        {!isLoading && !isError && songList.length > 0 && (
          <section aria-label="Song wall" className="grid gap-4">
            {songList.map((song) => (
              <SongCard key={song.id} song={song} mentionDirectory={mentionDirectory ?? []} />
            ))}
          </section>
        )}
      </div>
  )
}

