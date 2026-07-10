import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  backfillPreviews,
  deleteSongRequest,
  fetchAllSongRequests,
  fetchSongWall,
  matchPreview,
  mergeSongRequests,
  submitSongRequest,
  updateSongRequest,
  type SongRequest,
  type SongRequestCreate,
  type SongRequestUpdate,
} from '@/api/music'

export type {
  MusicExportFormat,
  PreviewBackfillResult,
  SongRequest,
  SongRequestCreate,
  SongRequestStatus,
  SongRequestUpdate,
} from '@/api/music'
export { downloadExport, MusicApiError } from '@/api/music'

export const SONG_WALL_QUERY_KEY = ['music', 'wall'] as const
export const ADMIN_SONG_REQUESTS_QUERY_KEY = ['music', 'admin'] as const

export function useSongWall() {
  return useQuery<SongRequest[]>({
    queryKey: SONG_WALL_QUERY_KEY,
    queryFn: () => fetchSongWall(),
  })
}

export function useSubmitSongRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: SongRequestCreate) => submitSongRequest(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SONG_WALL_QUERY_KEY })
    },
  })
}

export function useAllSongRequests() {
  return useQuery<SongRequest[]>({
    queryKey: ADMIN_SONG_REQUESTS_QUERY_KEY,
    queryFn: () => fetchAllSongRequests(),
  })
}

// Admin mutations invalidate the wall too — moderation changes what guests see.
function useInvalidateSongRequests() {
  const queryClient = useQueryClient()

  return () => {
    void queryClient.invalidateQueries({ queryKey: ADMIN_SONG_REQUESTS_QUERY_KEY })
    void queryClient.invalidateQueries({ queryKey: SONG_WALL_QUERY_KEY })
  }
}

export function useUpdateSongRequest() {
  const invalidate = useInvalidateSongRequests()

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: SongRequestUpdate }) =>
      updateSongRequest(id, payload),
    onSuccess: invalidate,
  })
}

export function useDeleteSongRequest() {
  const invalidate = useInvalidateSongRequests()

  return useMutation({
    mutationFn: (id: number) => deleteSongRequest(id),
    onSuccess: invalidate,
  })
}

export function useMergeSongRequests() {
  const invalidate = useInvalidateSongRequests()

  return useMutation({
    mutationFn: ({ id, duplicateIds }: { id: number; duplicateIds: number[] }) =>
      mergeSongRequests(id, duplicateIds),
    onSuccess: invalidate,
  })
}

export function useMatchPreview() {
  const invalidate = useInvalidateSongRequests()

  return useMutation({
    mutationFn: (id: number) => matchPreview(id),
    onSuccess: invalidate,
  })
}

export function useBackfillPreviews() {
  const invalidate = useInvalidateSongRequests()

  return useMutation({
    mutationFn: () => backfillPreviews(),
    onSuccess: invalidate,
  })
}
