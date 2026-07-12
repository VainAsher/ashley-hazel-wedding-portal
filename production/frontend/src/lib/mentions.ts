/**
 * @mentions (Wave 3 item 16, closes the wave). See docs/specs/MENTIONS.md.
 *
 * Mirrors the backend's `extract_mentioned_invite_ids`
 * (production/backend/app/utils/mentions.py) exactly: for each `@` in text,
 * greedily match the longest directory display name that starts
 * immediately after it (case-insensitive). This is the ONE shared parsing
 * function used by both the autocomplete (MentionTextarea) and the
 * rendered-highlight views (blessings wall, song wall, party message
 * board) -- never trust anything except a fresh match against the live,
 * scoped directory.
 */

export interface MentionDirectoryEntry {
  invite_id: number
  display_name: string
}

function orderedByLongestName(directory: MentionDirectoryEntry[]): MentionDirectoryEntry[] {
  return [...directory].sort((a, b) => b.display_name.length - a.display_name.length)
}

export function extractMentionedInviteIds(
  text: string,
  directory: MentionDirectoryEntry[],
): Set<number> {
  if (!text || directory.length === 0) {
    return new Set()
  }

  const ordered = orderedByLongestName(directory)
  const lowerText = text.toLowerCase()
  const found = new Set<number>()

  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== '@') {
      continue
    }
    const remainder = lowerText.slice(index + 1)
    const match = ordered.find(
      (entry) => entry.display_name && remainder.startsWith(entry.display_name.toLowerCase()),
    )
    if (match) {
      found.add(match.invite_id)
    }
  }
  return found
}

export interface MentionSegment {
  text: string
  isMention: boolean
}

/** Splits `text` into plain/highlighted segments using the same longest-match
 * rule as `extractMentionedInviteIds`, for rendering. */
export function segmentMentions(
  text: string,
  directory: MentionDirectoryEntry[],
): MentionSegment[] {
  if (!text || directory.length === 0) {
    return text ? [{ text, isMention: false }] : []
  }

  const ordered = orderedByLongestName(directory)
  const lowerText = text.toLowerCase()
  const segments: MentionSegment[] = []
  let plainStart = 0
  let cursor = 0

  while (cursor < text.length) {
    if (text[cursor] !== '@') {
      cursor += 1
      continue
    }
    const remainder = lowerText.slice(cursor + 1)
    const match = ordered.find(
      (entry) => entry.display_name && remainder.startsWith(entry.display_name.toLowerCase()),
    )
    if (!match) {
      cursor += 1
      continue
    }
    if (cursor > plainStart) {
      segments.push({ text: text.slice(plainStart, cursor), isMention: false })
    }
    const matchEnd = cursor + 1 + match.display_name.length
    segments.push({ text: text.slice(cursor, matchEnd), isMention: true })
    cursor = matchEnd
    plainStart = matchEnd
  }

  if (plainStart < text.length) {
    segments.push({ text: text.slice(plainStart), isMention: false })
  }
  return segments
}
