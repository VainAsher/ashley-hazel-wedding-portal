import { Card, CardContent } from '@/components/ui/card'
import type { ProfileDirectoryEntry } from '@/hooks/useProfiles'

// Shared with src/pages/WeddingParty.tsx's public directory (Wave 3 item
// 15) — extracted so Party.tsx (item 14 D3) can render the same cards
// filtered to just its own party's members, without duplicating markup.

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

function initials(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) {
    return '?'
  }
  return trimmed
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function ProfileAvatar({ name, photoUrl }: { name: string; photoUrl: string | null }) {
  if (photoUrl) {
    return (
      <img
        src={`${API_BASE_URL}${photoUrl}`}
        alt=""
        className="h-16 w-16 flex-shrink-0 rounded-full object-cover ring-2 ring-gold"
      />
    )
  }
  return (
    <div
      aria-hidden="true"
      className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-plum text-lg font-semibold text-cream ring-2 ring-gold"
    >
      {initials(name)}
    </div>
  )
}

export function ProfileCard({ entry }: { entry: ProfileDirectoryEntry }) {
  return (
    <Card className="flex h-full flex-col">
      <CardContent className="flex flex-1 flex-col gap-3 pt-6">
        <div className="flex items-center gap-4">
          <ProfileAvatar name={entry.display_name} photoUrl={entry.photo_url} />
          <div className="min-w-0">
            <h3 className="m-0 truncate text-base font-semibold text-gray-900">
              {entry.display_name}
            </h3>
            {entry.role_title && (
              <p className="m-0 truncate text-sm text-plum">{entry.role_title}</p>
            )}
          </div>
        </div>
        {entry.best_known_for && (
          <p className="m-0 text-sm text-gray-600">
            <strong>Known for:</strong> {entry.best_known_for}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
