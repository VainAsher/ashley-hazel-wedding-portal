const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export type GalleryStatus = 'pending' | 'approved' | 'rejected'

export interface GalleryItem {
  id: number
  wedding_id: number
  title: string | null
  caption: string | null
  file_path: string
  thumb_path: string | null
  content_type: string | null
  file_size: number | null
  status: GalleryStatus
  created_at: string | null
  url: string
  thumb_url: string | null
}

export interface GalleryUploadInput {
  file: File
  title?: string | null
  caption?: string | null
}

export interface GalleryUpdatePayload {
  title?: string | null
  caption?: string | null
  status?: GalleryStatus
}

export class GalleryApiError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'GalleryApiError'
    this.status = status
  }
}

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === 'string') {
    return payload
  }

  if (!payload || typeof payload !== 'object') {
    return fallback
  }

  const detail = 'detail' in payload ? (payload as { detail: unknown }).detail : null
  if (typeof detail === 'string') {
    return detail
  }

  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (item && typeof item === 'object' && 'msg' in item) {
          return String((item as { msg: unknown }).msg)
        }
        return String(item)
      })
      .join(', ')
  }

  return fallback
}

async function request<T>(
  path: string,
  options: RequestInit,
  fallbackError: string,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    ...options,
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    throw new GalleryApiError(extractErrorMessage(payload, fallbackError), response.status)
  }

  return payload as T
}

function jsonRequest<T>(path: string, options: RequestInit, fallbackError: string): Promise<T> {
  return request<T>(
    path,
    {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    },
    fallbackError,
  )
}

export function fetchGallery(): Promise<GalleryItem[]> {
  return request<GalleryItem[]>('/api/gallery', { method: 'GET' }, 'Failed to load gallery')
}

export function fetchApprovedGallery(): Promise<GalleryItem[]> {
  return request<GalleryItem[]>(
    '/api/gallery/approved',
    { method: 'GET' },
    'Failed to load gallery',
  )
}

export function submitGalleryItem(input: GalleryUploadInput): Promise<GalleryItem> {
  const formData = new FormData()
  formData.append('file', input.file)

  const title = input.title?.trim()
  if (title) {
    formData.append('title', title)
  }

  const caption = input.caption?.trim()
  if (caption) {
    formData.append('caption', caption)
  }

  // Do NOT set Content-Type — the browser sets the multipart boundary.
  return request<GalleryItem>(
    '/api/gallery/submit',
    { method: 'POST', body: formData },
    'Failed to submit photo',
  )
}

export function uploadGalleryItem(input: GalleryUploadInput): Promise<GalleryItem> {
  const formData = new FormData()
  formData.append('file', input.file)

  const title = input.title?.trim()
  if (title) {
    formData.append('title', title)
  }

  const caption = input.caption?.trim()
  if (caption) {
    formData.append('caption', caption)
  }

  // Do NOT set Content-Type — the browser sets the multipart boundary.
  return request<GalleryItem>(
    '/api/gallery',
    { method: 'POST', body: formData },
    'Failed to upload photo',
  )
}

export function updateGalleryItem(
  id: number,
  payload: GalleryUpdatePayload,
): Promise<GalleryItem> {
  return jsonRequest<GalleryItem>(
    `/api/gallery/${id}`,
    { method: 'PATCH', body: JSON.stringify(payload) },
    'Failed to update photo',
  )
}

export async function deleteGalleryItem(id: number): Promise<void> {
  await request<unknown>(`/api/gallery/${id}`, { method: 'DELETE' }, 'Failed to delete photo')
}
