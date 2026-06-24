import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  deleteGalleryItem,
  fetchApprovedGallery,
  fetchGallery,
  submitGalleryItem,
  updateGalleryItem,
  uploadGalleryItem,
  type GalleryItem,
  type GalleryUpdatePayload,
  type GalleryUploadInput,
} from '@/api/gallery'

export type {
  GalleryItem,
  GalleryStatus,
  GalleryUpdatePayload,
  GalleryUploadInput,
} from '@/api/gallery'
export { GalleryApiError } from '@/api/gallery'

export const GALLERY_QUERY_KEY = ['gallery'] as const
export const APPROVED_GALLERY_QUERY_KEY = ['gallery', 'approved'] as const

export function useGallery() {
  return useQuery<GalleryItem[]>({
    queryKey: GALLERY_QUERY_KEY,
    queryFn: () => fetchGallery(),
  })
}

export function useApprovedGallery() {
  return useQuery<GalleryItem[]>({
    queryKey: APPROVED_GALLERY_QUERY_KEY,
    queryFn: () => fetchApprovedGallery(),
  })
}

export function useSubmitGalleryItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: GalleryUploadInput) => submitGalleryItem(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: APPROVED_GALLERY_QUERY_KEY })
    },
  })
}

export function useUploadGalleryItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: GalleryUploadInput) => uploadGalleryItem(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: GALLERY_QUERY_KEY })
    },
  })
}

export function useUpdateGalleryItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: GalleryUpdatePayload }) =>
      updateGalleryItem(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: GALLERY_QUERY_KEY })
    },
  })
}

export function useDeleteGalleryItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => deleteGalleryItem(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: GALLERY_QUERY_KEY })
    },
  })
}
