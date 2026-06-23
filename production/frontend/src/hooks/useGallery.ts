import { useQuery } from '@tanstack/react-query'

import { fetchGalleryPhotos, type GalleryPhoto } from '@/api/gallery'

export type { GalleryPhoto } from '@/api/gallery'
export { GalleryApiError } from '@/api/gallery'

export const GALLERY_QUERY_KEY = ['gallery'] as const

export function useGallery() {
  return useQuery<GalleryPhoto[]>({
    queryKey: GALLERY_QUERY_KEY,
    queryFn: () => fetchGalleryPhotos(),
  })
}
