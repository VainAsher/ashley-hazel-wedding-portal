import { Fragment } from 'react'

import { segmentMentions, type MentionDirectoryEntry } from '@/lib/mentions'

/** Renders `text` with `@Display Name` mentions (matched against the given
 * scoped directory, longest-match, case-insensitive -- same rule the
 * backend uses to fire notifications) wrapped in a subtle highlight. Shared
 * by the blessings wall, song wall, and party message board so there is
 * exactly one rendering rule, not three copies. */
export function MentionHighlightedText({
  text,
  directory,
}: {
  text: string
  directory: MentionDirectoryEntry[]
}) {
  const segments = segmentMentions(text, directory)
  return (
    <>
      {segments.map((segment, index) => (
        <Fragment key={index}>
          {segment.isMention ? (
            <span className="font-semibold text-gold">{segment.text}</span>
          ) : (
            segment.text
          )}
        </Fragment>
      ))}
    </>
  )
}
