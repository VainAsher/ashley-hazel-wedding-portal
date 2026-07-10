import { useMemo, useState } from 'react'

import { AdminLayout } from '@/components/AdminLayout'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  downloadExport,
  MusicApiError,
  useAllSongRequests,
  useBackfillPreviews,
  useMatchPreview,
  useMergeSongRequests,
  useUpdateSongRequest,
  type MusicExportFormat,
  type SongRequest,
  type SongRequestStatus,
} from '@/hooks/useMusic'

// Duplicate grouping key: normalised title + artist.
function duplicateKey(request: SongRequest): string {
  return `${request.title.trim().toLowerCase()}|${(request.artist ?? '').trim().toLowerCase()}`
}

function byCreatedAt(a: SongRequest, b: SongRequest): number {
  return a.created_at.localeCompare(b.created_at) || a.id - b.id
}

// Wall order: pinned first, then explicit position, then submission order.
function byWallOrder(a: SongRequest, b: SongRequest): number {
  return (
    Number(b.pinned) - Number(a.pinned) ||
    (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER) ||
    byCreatedAt(a, b)
  )
}

function displayTitle(request: SongRequest): string {
  const title = request.title.trim()
  return request.artist ? `${title} — ${request.artist}` : title
}

function requestLabel(request: SongRequest): string {
  return `${request.title.trim()} (${request.requested_by})`
}

const STATUS_FEEDBACK: Record<SongRequestStatus, string> = {
  pending: 'returned to pending.',
  approved: 'approved.',
  rejected: 'rejected.',
  blocked: 'blocked.',
}

function RequestSummary({ request }: { request: SongRequest }) {
  return (
    <div className="flex items-start gap-3">
      {request.artwork_url && (
        <img
          src={request.artwork_url}
          alt={`Artwork for ${request.title.trim()}`}
          className="h-12 w-12 rounded object-cover"
        />
      )}
      <div className="grid gap-0.5">
        <h3 className="text-sm font-semibold text-gray-900 m-0">
          {request.pinned && (
            <span title="Pinned" className="text-gold mr-1.5">
              ★
            </span>
          )}
          {displayTitle(request)}
        </h3>
        <p className="text-sm text-gray-600 m-0">Requested by {request.requested_by}</p>
        {request.dedication && (
          <p className="text-sm text-gray-700 italic m-0 whitespace-pre-wrap">
            {request.dedication}
          </p>
        )}
        {request.resolved_title && (
          <p className="text-xs text-gray-600 m-0">
            Matched: {request.resolved_title}
            {request.resolved_artist ? ` — ${request.resolved_artist}` : ''}
          </p>
        )}
        {request.source_url && (
          <a
            href={request.source_url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-blue-700 underline"
          >
            Open link
          </a>
        )}
      </div>
    </div>
  )
}

export function Music() {
  const { data: requests, isLoading, isError, error } = useAllSongRequests()

  const updateMutation = useUpdateSongRequest()
  const mergeMutation = useMergeSongRequests()
  const matchMutation = useMatchPreview()
  const backfillMutation = useBackfillPreviews()

  const [feedback, setFeedback] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const requestList = requests ?? []

  const pendingGroups = useMemo(() => {
    const groups = new Map<string, SongRequest[]>()
    const pending = requestList
      .filter((request) => request.status === 'pending')
      .sort(byCreatedAt)
    for (const request of pending) {
      const key = duplicateKey(request)
      const group = groups.get(key)
      if (group) {
        group.push(request)
      } else {
        groups.set(key, [request])
      }
    }
    return [...groups.values()]
  }, [requestList])

  const approved = useMemo(
    () => requestList.filter((request) => request.status === 'approved').sort(byWallOrder),
    [requestList],
  )

  const blocked = useMemo(
    () => requestList.filter((request) => request.status === 'blocked').sort(byCreatedAt),
    [requestList],
  )

  const isMutating =
    updateMutation.isPending ||
    mergeMutation.isPending ||
    matchMutation.isPending ||
    backfillMutation.isPending

  const resetAlerts = () => {
    setFeedback(null)
    setActionError(null)
  }

  const reportError = (err: unknown, fallback: string) => {
    setActionError(err instanceof MusicApiError ? err.message : fallback)
  }

  const changeStatus = async (request: SongRequest, status: SongRequestStatus) => {
    resetAlerts()

    try {
      await updateMutation.mutateAsync({ id: request.id, payload: { status } })
      setFeedback(`${request.title.trim()} ${STATUS_FEEDBACK[status]}`)
    } catch (err) {
      reportError(err, 'Failed to update song request')
    }
  }

  const mergeGroup = async (group: SongRequest[]) => {
    resetAlerts()

    // The group is sorted by created_at, so the first-created row is primary.
    const [primary, ...duplicates] = group

    try {
      await mergeMutation.mutateAsync({
        id: primary.id,
        duplicateIds: duplicates.map((duplicate) => duplicate.id),
      })
      setFeedback(
        `Merged ${duplicates.length} duplicate${duplicates.length === 1 ? '' : 's'} into ${primary.title.trim()}.`,
      )
    } catch (err) {
      reportError(err, 'Failed to merge song requests')
    }
  }

  const togglePin = async (request: SongRequest) => {
    resetAlerts()

    try {
      await updateMutation.mutateAsync({ id: request.id, payload: { pinned: !request.pinned } })
      setFeedback(`${request.title.trim()} ${request.pinned ? 'unpinned' : 'pinned'}.`)
    } catch (err) {
      reportError(err, 'Failed to update song request')
    }
  }

  const moveApproved = async (index: number, direction: -1 | 1) => {
    resetAlerts()

    const target = index + direction
    if (target < 0 || target >= approved.length) {
      return
    }

    // Assign sequential positions in the current wall order (covers rows that
    // have never been positioned), then swap the two affected slots.
    const positions = approved.map((_, slot) => slot + 1)
    ;[positions[index], positions[target]] = [positions[target], positions[index]]
    const changes = approved
      .map((request, slot) => ({ request, position: positions[slot] }))
      .filter(({ request, position }) => request.position !== position)

    try {
      for (const change of changes) {
        await updateMutation.mutateAsync({
          id: change.request.id,
          payload: { position: change.position },
        })
      }
      setFeedback('Playlist order updated.')
    } catch (err) {
      reportError(err, 'Failed to reorder the playlist')
    }
  }

  const findPreview = async (request: SongRequest) => {
    resetAlerts()

    try {
      const updated = await matchMutation.mutateAsync(request.id)
      setFeedback(
        updated.preview_url
          ? `Preview matched for ${request.title.trim()}.`
          : `No preview found for ${request.title.trim()} — try refining the title/artist.`,
      )
    } catch (err) {
      reportError(err, 'Failed to match a preview')
    }
  }

  const clearPreview = async (request: SongRequest) => {
    resetAlerts()

    try {
      await updateMutation.mutateAsync({ id: request.id, payload: { preview_url: null } })
      setFeedback(`Preview cleared for ${request.title.trim()}.`)
    } catch (err) {
      reportError(err, 'Failed to clear the preview')
    }
  }

  const matchAllPreviews = async () => {
    resetAlerts()

    try {
      const result = await backfillMutation.mutateAsync()
      setFeedback(
        `Matched ${result.matched} preview${result.matched === 1 ? '' : 's'}` +
          (result.missed > 0 ? ` (${result.missed} not found).` : '.'),
      )
    } catch (err) {
      reportError(err, 'Failed to match previews')
    }
  }

  const handleExport = async (format: MusicExportFormat) => {
    resetAlerts()

    try {
      await downloadExport(format)
    } catch (err) {
      reportError(err, 'Failed to download the export')
    }
  }

  return (
    <AdminLayout
      title="Music"
      breadcrumb={[{ label: 'Dashboard', href: '/admin' }, { label: 'Music' }]}
    >
      <div className="grid gap-6">
        {feedback && (
          <Alert variant="success" role="status" aria-live="polite">
            {feedback}
          </Alert>
        )}

        {actionError && <Alert variant="destructive">{actionError}</Alert>}

        {isLoading && (
          <div
            role="status"
            className="text-sm text-gray-600 border border-gray-200 rounded-md p-4"
          >
            Loading song requests...
          </div>
        )}

        {isError && !isLoading && (
          <Alert variant="destructive">
            {error instanceof Error ? error.message : 'Unable to load song requests.'}
          </Alert>
        )}

        {!isLoading && !isError && (
          <>
            <section aria-label="Pending requests" className="grid gap-3">
              <h2 className="text-xl font-semibold text-gray-900 m-0">Pending requests</h2>

              {pendingGroups.length === 0 && (
                <div className="text-sm text-gray-600 border border-gray-200 rounded-md p-4">
                  No pending requests.
                </div>
              )}

              {pendingGroups.map((group) => (
                <Card key={duplicateKey(group[0])} className="grid gap-3 p-4">
                  {group.length > 1 && (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge variant="warning">{group.length} duplicates</Badge>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isMutating}
                        onClick={() => void mergeGroup(group)}
                      >
                        Merge {group.length} duplicates
                      </Button>
                    </div>
                  )}

                  {group.map((request) => (
                    <div
                      key={request.id}
                      className="flex flex-wrap items-start justify-between gap-3"
                    >
                      <RequestSummary request={request} />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="default"
                          size="sm"
                          aria-label={`Approve ${requestLabel(request)}`}
                          disabled={isMutating}
                          onClick={() => void changeStatus(request, 'approved')}
                        >
                          Approve
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          aria-label={`Reject ${requestLabel(request)}`}
                          disabled={isMutating}
                          onClick={() => void changeStatus(request, 'rejected')}
                        >
                          Reject
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          aria-label={`Block ${requestLabel(request)}`}
                          disabled={isMutating}
                          onClick={() => void changeStatus(request, 'blocked')}
                        >
                          Block
                        </Button>
                      </div>
                    </div>
                  ))}
                </Card>
              ))}
            </section>

            <section aria-label="Approved playlist" className="grid gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold text-gray-900 m-0">Approved playlist</h2>
                <Badge variant="info">{approved.length} songs</Badge>
              </div>

              {approved.length === 0 && (
                <div className="text-sm text-gray-600 border border-gray-200 rounded-md p-4">
                  No approved songs yet.
                </div>
              )}

              {approved.map((request, index) => (
                <Card
                  key={request.id}
                  className="flex flex-wrap items-start justify-between gap-3 p-4"
                >
                  <div className="grid gap-1.5">
                    <RequestSummary request={request} />
                    <Badge
                      variant={request.preview_url ? 'info' : 'neutral'}
                      className="justify-self-start"
                    >
                      {request.preview_url ? '▶ preview ready' : 'no preview'}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant={request.pinned ? 'default' : 'outline'}
                      size="sm"
                      aria-label={`${request.pinned ? 'Unpin' : 'Pin'} ${requestLabel(request)}`}
                      disabled={isMutating}
                      onClick={() => void togglePin(request)}
                    >
                      {request.pinned ? 'Unpin' : 'Pin'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label={`Move ${requestLabel(request)} up`}
                      disabled={isMutating || index === 0}
                      onClick={() => void moveApproved(index, -1)}
                    >
                      Move up
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label={`Move ${requestLabel(request)} down`}
                      disabled={isMutating || index === approved.length - 1}
                      onClick={() => void moveApproved(index, 1)}
                    >
                      Move down
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label={`Find preview for ${requestLabel(request)}`}
                      disabled={isMutating}
                      onClick={() => void findPreview(request)}
                    >
                      Find preview
                    </Button>
                    {request.preview_url && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-label={`Clear preview for ${requestLabel(request)}`}
                        disabled={isMutating}
                        onClick={() => void clearPreview(request)}
                      >
                        Clear preview
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      aria-label={`Reject ${requestLabel(request)}`}
                      disabled={isMutating}
                      onClick={() => void changeStatus(request, 'rejected')}
                    >
                      Reject
                    </Button>
                  </div>
                </Card>
              ))}
            </section>

            <section aria-label="Do-not-play list" className="grid gap-3">
              <h2 className="text-xl font-semibold text-gray-900 m-0">Do-not-play list</h2>

              {blocked.length === 0 && (
                <div className="text-sm text-gray-600 border border-gray-200 rounded-md p-4">
                  No blocked songs.
                </div>
              )}

              {blocked.map((request) => (
                <Card
                  key={request.id}
                  className="flex flex-wrap items-start justify-between gap-3 p-4"
                >
                  <RequestSummary request={request} />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={`Unblock ${requestLabel(request)}`}
                    disabled={isMutating}
                    onClick={() => void changeStatus(request, 'pending')}
                  >
                    Unblock
                  </Button>
                </Card>
              ))}
            </section>

            <section aria-label="Export" className="grid gap-3">
              <h2 className="text-xl font-semibold text-gray-900 m-0">Export</h2>
              <p className="text-sm text-gray-600 m-0">
                Download the approved playlist and do-not-play list for the DJ.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => void handleExport('csv')}>
                  Download CSV
                </Button>
                <Button type="button" variant="outline" onClick={() => void handleExport('text')}>
                  Download DJ pack (text)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isMutating}
                  onClick={() => void matchAllPreviews()}
                >
                  Match all previews
                </Button>
              </div>
            </section>
          </>
        )}
      </div>
    </AdminLayout>
  )
}
