const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export type SongRequestStatus = 'pending' | 'approved' | 'rejected' | 'blocked'

export interface SongRequest {
  id: number
  wedding_id: number
  title: string
  artist: string | null
  source_url: string | null
  dedication: string | null
  requested_by: string
  status: SongRequestStatus
  pinned: boolean
  position: number | null
  resolved_title: string | null
  resolved_artist: string | null
  artwork_url: string | null
  spotify_track_id: string | null
  preview_url: string | null
  created_at: string
}

/** A wall song plus this member's reaction state (Dancefloor v2). */
export interface SongWallItem extends SongRequest {
  reaction_count: number
  reacted_by_me: boolean
}

/** Wall payload: the approved songs plus the couple's now-playing pick. */
export interface SongWall {
  songs: SongWallItem[]
  now_playing: SongWallItem | null
}

/** Admin moderation row — reaction count included as a curation signal. */
export interface AdminSongRequest extends SongRequest {
  reaction_count: number
}

export interface ReactionState {
  reaction_count: number
  reacted_by_me: boolean
}

export interface NowPlayingState {
  now_playing: SongWallItem | null
}

export interface SongRequestCreate {
  title: string
  artist?: string | null
  source_url?: string | null
  dedication?: string | null
}

export interface SongRequestUpdate {
  title?: string
  artist?: string | null
  dedication?: string | null
  status?: SongRequestStatus
  pinned?: boolean
  position?: number | null
  // Explicit null clears a mismatched jukebox preview.
  preview_url?: string | null
}

export interface PreviewBackfillResult {
  matched: number
  missed: number
}

export type MusicExportFormat = 'csv' | 'text'

export class MusicApiError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'MusicApiError'
    this.status = status
  }
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  const payload = await response.json().catch(() => null)
  if (payload && typeof payload === 'object' && 'detail' in payload) {
    const detail = (payload as { detail: unknown }).detail
    if (typeof detail === 'string') {
      return detail
    }
  }

  return fallback
}

export async function fetchSongWall(apiBaseUrl = API_BASE_URL): Promise<SongWall> {
  const response = await fetch(`${apiBaseUrl}/api/music/requests/wall`, {
    credentials: 'include',
  })

  if (!response.ok) {
    throw new MusicApiError(
      await readErrorMessage(response, 'Unable to load the song wall.'),
      response.status,
    )
  }

  return response.json() as Promise<SongWall>
}

export async function reactToSong(
  id: number,
  apiBaseUrl = API_BASE_URL,
): Promise<ReactionState> {
  const response = await fetch(`${apiBaseUrl}/api/music/requests/${id}/react`, {
    credentials: 'include',
    method: 'POST',
  })

  if (!response.ok) {
    throw new MusicApiError(
      await readErrorMessage(response, 'Unable to react to this song.'),
      response.status,
    )
  }

  return response.json() as Promise<ReactionState>
}

export async function unreactToSong(id: number, apiBaseUrl = API_BASE_URL): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/api/music/requests/${id}/react`, {
    credentials: 'include',
    method: 'DELETE',
  })

  if (!response.ok) {
    throw new MusicApiError(
      await readErrorMessage(response, 'Unable to remove your reaction.'),
      response.status,
    )
  }
}

export async function fetchNowPlaying(apiBaseUrl = API_BASE_URL): Promise<NowPlayingState> {
  const response = await fetch(`${apiBaseUrl}/api/music/now-playing`, {
    credentials: 'include',
  })

  if (!response.ok) {
    throw new MusicApiError(
      await readErrorMessage(response, 'Unable to load the now-playing song.'),
      response.status,
    )
  }

  return response.json() as Promise<NowPlayingState>
}

export async function setNowPlaying(
  songRequestId: number | null,
  apiBaseUrl = API_BASE_URL,
): Promise<NowPlayingState> {
  const response = await fetch(`${apiBaseUrl}/api/music/now-playing`, {
    body: JSON.stringify({ song_request_id: songRequestId }),
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    method: 'PUT',
  })

  if (!response.ok) {
    throw new MusicApiError(
      await readErrorMessage(response, 'Unable to update the now-playing song.'),
      response.status,
    )
  }

  return response.json() as Promise<NowPlayingState>
}

export async function submitSongRequest(
  payload: SongRequestCreate,
  apiBaseUrl = API_BASE_URL,
): Promise<SongRequest> {
  const response = await fetch(`${apiBaseUrl}/api/music/requests`, {
    body: JSON.stringify(payload),
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })

  if (!response.ok) {
    throw new MusicApiError(
      await readErrorMessage(response, 'Unable to submit your song request.'),
      response.status,
    )
  }

  return response.json() as Promise<SongRequest>
}

export async function fetchAllSongRequests(
  apiBaseUrl = API_BASE_URL,
): Promise<AdminSongRequest[]> {
  const response = await fetch(`${apiBaseUrl}/api/music/requests`, {
    credentials: 'include',
  })

  if (!response.ok) {
    throw new MusicApiError(
      await readErrorMessage(response, 'Unable to load song requests.'),
      response.status,
    )
  }

  return response.json() as Promise<AdminSongRequest[]>
}

export async function updateSongRequest(
  id: number,
  payload: SongRequestUpdate,
  apiBaseUrl = API_BASE_URL,
): Promise<SongRequest> {
  const response = await fetch(`${apiBaseUrl}/api/music/requests/${id}`, {
    body: JSON.stringify(payload),
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    method: 'PATCH',
  })

  if (!response.ok) {
    throw new MusicApiError(
      await readErrorMessage(response, 'Unable to update this song request.'),
      response.status,
    )
  }

  return response.json() as Promise<SongRequest>
}

export async function deleteSongRequest(
  id: number,
  apiBaseUrl = API_BASE_URL,
): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/api/music/requests/${id}`, {
    credentials: 'include',
    method: 'DELETE',
  })

  if (!response.ok) {
    throw new MusicApiError(
      await readErrorMessage(response, 'Unable to delete this song request.'),
      response.status,
    )
  }
}

export async function mergeSongRequests(
  id: number,
  duplicateIds: number[],
  apiBaseUrl = API_BASE_URL,
): Promise<SongRequest> {
  const response = await fetch(`${apiBaseUrl}/api/music/requests/${id}/merge`, {
    body: JSON.stringify({ duplicate_ids: duplicateIds }),
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })

  if (!response.ok) {
    throw new MusicApiError(
      await readErrorMessage(response, 'Unable to merge these song requests.'),
      response.status,
    )
  }

  return response.json() as Promise<SongRequest>
}

export async function matchPreview(
  id: number,
  apiBaseUrl = API_BASE_URL,
): Promise<SongRequest> {
  const response = await fetch(`${apiBaseUrl}/api/music/requests/${id}/match-preview`, {
    credentials: 'include',
    method: 'POST',
  })

  if (!response.ok) {
    throw new MusicApiError(
      await readErrorMessage(response, 'Unable to match a preview for this song.'),
      response.status,
    )
  }

  return response.json() as Promise<SongRequest>
}

export async function backfillPreviews(
  apiBaseUrl = API_BASE_URL,
): Promise<PreviewBackfillResult> {
  const response = await fetch(`${apiBaseUrl}/api/music/previews/backfill`, {
    credentials: 'include',
    method: 'POST',
  })

  if (!response.ok) {
    throw new MusicApiError(
      await readErrorMessage(response, 'Unable to match previews.'),
      response.status,
    )
  }

  return response.json() as Promise<PreviewBackfillResult>
}

export async function downloadExport(
  format: MusicExportFormat,
  apiBaseUrl = API_BASE_URL,
): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/api/music/export?format=${format}`, {
    credentials: 'include',
  })

  if (!response.ok) {
    throw new MusicApiError(
      await readErrorMessage(response, 'Unable to download the export.'),
      response.status,
    )
  }

  const blob = await response.blob()
  const disposition = response.headers.get('Content-Disposition') ?? ''
  const filenameMatch = disposition.match(/filename="?([^";]+)"?/)
  const filename =
    filenameMatch?.[1] ?? (format === 'csv' ? 'wedding-playlist.csv' : 'dj-pack.txt')

  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Revoke on the next tick so the browser has started the download.
  setTimeout(() => URL.revokeObjectURL(url), 1_000)
}
