import { useEffect, useMemo, useRef, useState, type TextareaHTMLAttributes } from 'react'

import { useMentionsDirectory } from '@/hooks/useMentions'
import type { MentionScope } from '@/api/mentions'

interface ActiveQuery {
  start: number
  query: string
}

/** Finds the `@word` (if any) the cursor is currently sitting inside of --
 * the nearest unescaped `@` before the cursor with no whitespace between it
 * and the cursor. Returns null when the cursor isn't in a mention-in-
 * progress (no `@`, or whitespace already typed after it). */
function activeMentionQuery(value: string, cursor: number): ActiveQuery | null {
  const upToCursor = value.slice(0, cursor)
  const at = upToCursor.lastIndexOf('@')
  if (at === -1) {
    return null
  }
  const query = upToCursor.slice(at + 1)
  if (/\s/.test(query)) {
    return null
  }
  return { start: at, query }
}

type BaseTextareaProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  'value' | 'onChange'
>

interface MentionTextareaProps extends BaseTextareaProps {
  scope: MentionScope
  value: string
  onChange: (value: string) => void
}

/** A plain `<textarea>` plus `@name` autocomplete: fetches the scope's
 * mentionable directory once per mount (small + rarely changes mid-session,
 * see docs/specs/MENTIONS.md), and on typing `@` + characters shows a
 * dropdown of matching names. Clicking a suggestion inserts
 * `@Display Name ` (space-terminated) at the cursor. */
export function MentionTextarea({
  scope,
  value,
  onChange,
  onBlur,
  ...textareaProps
}: MentionTextareaProps) {
  const { data: directory } = useMentionsDirectory(scope)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [cursor, setCursor] = useState(0)
  const [open, setOpen] = useState(false)

  const active = useMemo(() => activeMentionQuery(value, cursor), [value, cursor])

  const suggestions = useMemo(() => {
    if (!active || !directory) {
      return []
    }
    const query = active.query.toLowerCase()
    return directory
      .filter((entry) => entry.display_name.toLowerCase().includes(query))
      .slice(0, 6)
  }, [active, directory])

  useEffect(() => {
    setOpen(active !== null && suggestions.length > 0)
  }, [active, suggestions.length])

  const syncCursor = (element: HTMLTextAreaElement) => {
    setCursor(element.selectionStart ?? element.value.length)
  }

  const insertMention = (displayName: string) => {
    if (!active) {
      return
    }
    const before = value.slice(0, active.start)
    const after = value.slice(cursor)
    const inserted = `@${displayName} `
    onChange(`${before}${inserted}${after}`)
    setOpen(false)

    // Restore focus + caret just after the inserted mention once the value
    // prop has flowed back down.
    requestAnimationFrame(() => {
      const element = textareaRef.current
      if (element) {
        const position = before.length + inserted.length
        element.focus()
        element.setSelectionRange(position, position)
        setCursor(position)
      }
    })
  }

  return (
    <div className="relative">
      <textarea
        {...textareaProps}
        ref={textareaRef}
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
          syncCursor(event.target)
        }}
        onSelect={(event) => syncCursor(event.currentTarget)}
        onKeyUp={(event) => syncCursor(event.currentTarget)}
        onClick={(event) => syncCursor(event.currentTarget)}
        onBlur={(event) => {
          setOpen(false)
          onBlur?.(event)
        }}
      />
      {open && (
        <ul
          role="listbox"
          aria-label="Mention suggestions"
          className="absolute z-10 mt-1 max-h-48 w-full max-w-xs overflow-y-auto rounded-md border border-input bg-background py-1 shadow-md"
        >
          {suggestions.map((entry) => (
            <li key={entry.invite_id}>
              <button
                type="button"
                role="option"
                aria-selected="false"
                // onMouseDown (not onClick) + preventDefault so the button
                // never steals focus from the textarea -- otherwise the
                // textarea's onBlur would close this dropdown before the
                // click registers.
                onMouseDown={(event) => {
                  event.preventDefault()
                  insertMention(entry.display_name)
                }}
                className="block w-full px-3 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
              >
                {entry.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
