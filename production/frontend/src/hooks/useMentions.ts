import { useQuery } from '@tanstack/react-query'

import {
  fetchMentionsDirectory,
  type MentionDirectoryEntry,
  type MentionScope,
} from '@/api/mentions'

export type { MentionDirectoryEntry, MentionScope } from '@/api/mentions'
export { MentionsApiError } from '@/api/mentions'

export const mentionsDirectoryQueryKey = (scope: MentionScope) =>
  ['mentions', 'directory', scope] as const

export function useMentionsDirectory(scope: MentionScope) {
  return useQuery<MentionDirectoryEntry[]>({
    queryKey: mentionsDirectoryQueryKey(scope),
    queryFn: () => fetchMentionsDirectory(scope),
    // Small, rarely-changing per session -- fetched once per mount and
    // filtered/matched client-side, per docs/specs/MENTIONS.md.
    staleTime: Infinity,
  })
}
