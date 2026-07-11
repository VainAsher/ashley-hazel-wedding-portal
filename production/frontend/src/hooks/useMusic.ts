import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  backfillPreviews,
  deleteSongRequest,
  fetchAllSongRequests,
  fetchNowPlaying,
  fetchSongWall,
  matchPreview,
  mergeSongRequests,
  reactToSong,
  setNowPlaying,
  submitSongRequest,
  unreactToSong,
  updateSongRequest,
  type AdminSongRequest,
  type NowPlayingState,
  type SongRequestCreate,
  type SongRequestUpdate,
  type SongWall,
  type SongWallItem,
} from '@/api/music'

export type {
  AdminSongRequest,
  MusicExportFormat,
  NowPlayingState,
  PreviewBackfillResult,
  ReactionState,
  SongRequest,
  SongRequestCreate,
  SongRequestStatus,
  SongRequestUpdate,
  SongWall,
  SongWallItem,
} from '@/api/music'
export { downloadExport, MusicApiError } from '@/api/music'

export const SONG_WALL_QUERY_KEY = ['music', 'wall'] as const
export const ADMIN_SONG_REQUESTS_QUERY_KEY = ['music', 'admin'] as const
export const NOW_PLAYING_QUERY_KEY = ['music', 'now-playing'] as const

export function useSongWall() {
  return useQuery<SongWall>({
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

/**
 * Toggle this member's ♥ on a wall song, optimistically: the cached wall is
 * patched immediately, rolled back on error, and reconciled on settle.
 */
export function useToggleReaction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (song: SongWallItem): Promise<void> => {
      if (song.reacted_by_me) {
        await unreactToSong(song.id)
      } else {
        await reactToSong(song.id)
      }
    },
    onMutate: async (song: SongWallItem) => {
      await queryClient.cancelQueries({ queryKey: SONG_WALL_QUERY_KEY })
      const previous = queryClient.getQueryData<SongWall>(SONG_WALL_QUERY_KEY)

      const toggle = (item: SongWallItem): SongWallItem =>
        item.id === song.id
          ? {
              ...item,
              reacted_by_me: !song.reacted_by_me,
              reaction_count: Math.max(
                0,
                item.reaction_count + (song.reacted_by_me ? -1 : 1),
              ),
            }
          : item

      queryClient.setQueryData<SongWall>(SONG_WALL_QUERY_KEY, (wall) =>
        wall
          ? {
              songs: wall.songs.map(toggle),
              now_playing: wall.now_playing ? toggle(wall.now_playing) : null,
            }
          : wall,
      )
      return { previous }
    },
    onError: (_error, _song, context) => {
      if (context?.previous) {
        queryClient.setQueryData(SONG_WALL_QUERY_KEY, context.previous)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: SONG_WALL_QUERY_KEY })
    },
  })
}

export function useAllSongRequests() {
  return useQuery<AdminSongRequest[]>({
    queryKey: ADMIN_SONG_REQUESTS_QUERY_KEY,
    queryFn: () => fetchAllSongRequests(),
  })
}

export function useNowPlaying() {
  return useQuery<NowPlayingState>({
    queryKey: NOW_PLAYING_QUERY_KEY,
    queryFn: () => fetchNowPlaying(),
  })
}

export function useSetNowPlaying() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (songRequestId: number | null) => setNowPlaying(songRequestId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: NOW_PLAYING_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: SONG_WALL_QUERY_KEY })
    },
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
