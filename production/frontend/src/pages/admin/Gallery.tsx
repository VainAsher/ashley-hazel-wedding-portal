import { ImageIcon } from 'lucide-react'

import { AdminLayout } from '@/components/AdminLayout'
import { Alert } from '@/components/ui/alert'
import { Card } from '@/components/ui/card'
import { useGallery } from '@/hooks/useGallery'

export function Gallery() {
  const { data: photos, isLoading, isError, error } = useGallery()

  const photoList = photos ?? []
  const photoCount = photoList.length

  return (
    <AdminLayout
      title="Gallery"
      breadcrumb={[{ label: 'Dashboard', href: '/admin' }, { label: 'Gallery' }]}
    >
      <div className="grid gap-4">
        <section className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 m-0">Photos</h2>
            <p className="text-sm text-gray-600 m-0 mt-1">{photoCount} photos</p>
          </div>
        </section>

        {isLoading && (
          <div role="status" className="text-sm text-gray-600 border border-gray-200 rounded-md p-4">
            Loading photos...
          </div>
        )}

        {isError && !isLoading && (
          <Alert variant="destructive">
            {error instanceof Error ? error.message : 'Failed to load photos'}
          </Alert>
        )}

        {!isLoading && !isError && photoCount === 0 && (
          <Card className="flex flex-col items-center justify-center gap-3 p-10 text-center">
            <ImageIcon className="h-10 w-10 text-gray-400" aria-hidden="true" />
            <div>
              <h3 className="text-base font-semibold text-gray-900 m-0">No photos yet</h3>
              <p className="text-sm text-gray-600 m-0 mt-1">
                Photos uploaded for the wedding gallery will appear here.
              </p>
            </div>
          </Card>
        )}

        {!isLoading && !isError && photoCount > 0 && (
          <section
            aria-label="Photo gallery"
            className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
          >
            {photoList.map((photo) => (
              <Card key={photo.id} className="overflow-hidden">
                <img
                  src={photo.url}
                  alt={photo.caption ?? 'Wedding gallery photo'}
                  className="aspect-square w-full object-cover"
                />
                {photo.caption && (
                  <p className="p-2 text-sm text-gray-600 m-0">{photo.caption}</p>
                )}
              </Card>
            ))}
          </section>
        )}
      </div>
    </AdminLayout>
  )
}
