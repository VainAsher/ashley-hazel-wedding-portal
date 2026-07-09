import { useEffect, useState, type FormEvent } from 'react'

import { Music2 } from 'lucide-react'

import { fetchCurrentUser } from '../api/auth'
import { GuestLayout } from '../components/GuestLayout'
import { usePageTitle } from '../hooks/usePageTitle'
import { Alert } from '../components/ui/alert'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import {
  MusicApiError,
  useSongWall,
  useSubmitSongRequest,
  type SongRequest,
} from '../hooks/useMusic'

function optionalText(value: string): string | null {
  const trimmed = value.trim()
  return trimmed || null
}

function SongCard({ song }: { song: SongRequest }) {
  const displayTitle = song.artist ? `${song.title} — ${song.artist}` : song.title

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {song.pinned && (
            <span title="Pinned" className="text-gold mr-1.5">
              ★
            </span>
          )}
          {displayTitle}
        </CardTitle>
        <CardDescription>Requested by {song.requested_by}</CardDescription>
      </CardHeader>
      {song.dedication && (
        <CardContent>
          <p className="text-sm text-gray-700 italic m-0 whitespace-pre-wrap">{song.dedication}</p>
        </CardContent>
      )}
    </Card>
  )
}

export function Music() {
  usePageTitle('Dancefloor')
  const { data: songs, isLoading, isError, error } = useSongWall()
  const submitMutation = useSubmitSongRequest()

  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [link, setLink] = useState('')
  const [dedication, setDedication] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [phase, setPhase] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    fetchCurrentUser()
      .then((user) => {
        if (mounted) {
          setPhase(user.wedding_phase ?? 'live')
        }
      })
      .catch(() => {
        // If we cannot read the phase, keep the form available — the backend
        // still enforces the phase gate on submission.
        if (mounted) {
          setPhase('live')
        }
      })
    return () => {
      mounted = false
    }
  }, [])

  const songList = songs ?? []
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
    <GuestLayout>
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
                  <textarea
                    id="song-dedication"
                    value={dedication}
                    onChange={(event) => setDedication(event.target.value)}
                    rows={3}
                    maxLength={500}
                    placeholder="A dedication or message (optional)"
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
              <SongCard key={song.id} song={song} />
            ))}
          </section>
        )}
      </div>
    </GuestLayout>
  )
}
