const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export interface GalleryPhoto {
  id: number
  wedding_id: number
  url: string
  caption: string | null
  uploaded_at: string | null
}

export class GalleryApiError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'GalleryApiError'
    this.status = status
  }
}

// TODO: wire to backend API
export function fetchGalleryPhotos(): Promise<GalleryPhoto[]> {
  void API_BASE_URL
  return Promise.resolve([])
}
