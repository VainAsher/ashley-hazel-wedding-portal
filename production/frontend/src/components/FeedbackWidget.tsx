import { useState, type FormEvent } from 'react'

import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FeedbackApiError, useCreateFeedback, type FeedbackType } from '@/hooks/useFeedback'
import { cn } from '@/lib/utils'

interface FeedbackContext {
  page: string
  role: string | null
  viewport: string
}

const TYPE_OPTIONS: Array<{ value: FeedbackType; label: string; icon: string }> = [
  { value: 'bug', label: 'Bug', icon: '🐞' },
  { value: 'idea', label: 'Idea', icon: '💡' },
]

/**
 * Floating "Feedback" pill (bottom-right, both guest and admin layouts).
 *
 * Deliberately fetch-free until opened: the only network call is the POST
 * when someone presses Send, so mounting this on every page costs nothing.
 */
export function FeedbackWidget() {
  const { user } = useAuth()
  const createMutation = useCreateFeedback()

  const [open, setOpen] = useState(false)
  const [type, setType] = useState<FeedbackType>('bug')
  const [message, setMessage] = useState('')
  const [context, setContext] = useState<FeedbackContext | null>(null)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (nextOpen) {
      // Snapshot the context the moment the dialog opens — page path, the
      // signed-in role, and viewport size. Nothing else is collected.
      setContext({
        page: window.location.pathname,
        role: user?.role ?? null,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
      })
    } else {
      setType('bug')
      setMessage('')
      setSent(false)
      setError(null)
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!message.trim()) {
      setError('Please write a quick note first — even one line helps.')
      return
    }

    try {
      await createMutation.mutateAsync({
        type,
        message: message.trim(),
        page: context?.page ?? null,
        role: context?.role ?? null,
        viewport: context?.viewport ?? null,
      })
      setSent(true)
    } catch (err) {
      setError(
        err instanceof FeedbackApiError
          ? err.message
          : 'Unable to send your feedback right now — please try again.',
      )
    }
  }

  const contextLine = context
    ? [context.page, context.role, context.viewport].filter(Boolean).join(' · ')
    : ''

  return (
    <>
      {/* Icon-only on phones: the full pill covered footer links and
          right-aligned submit buttons at narrow widths. */}
      <button
        type="button"
        aria-label="Send feedback"
        onClick={() => handleOpenChange(true)}
        className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-full bg-plum-night/95 p-3 text-sm font-medium text-cream shadow-lg ring-1 ring-gold/60 backdrop-blur transition-colors hover:bg-plum hover:text-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-gold sm:px-4 sm:py-2.5"
      >
        <span aria-hidden="true" className="text-base leading-none">
          💬
        </span>
        <span className="hidden sm:inline">Feedback</span>
      </button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md" aria-describedby={undefined}>
          {sent ? (
            <div className="grid gap-4 py-2 text-center" role="status">
              <span aria-hidden="true" className="text-3xl">
                💛
              </span>
              <DialogTitle className="text-plum">Thank you!</DialogTitle>
              <p className="m-0 text-sm text-gray-600">
                Your note is on its way to Ashley &amp; Hazel — every little bit
                makes the big day better.
              </p>
              <div className="flex justify-center gap-2">
                <Button type="button" variant="outline" onClick={() => {
                  setSent(false)
                  setMessage('')
                  setError(null)
                }}>
                  Send another
                </Button>
                <Button type="button" onClick={() => handleOpenChange(false)}>
                  Close
                </Button>
              </div>
            </div>
          ) : (
            <form className="grid gap-4" onSubmit={(event) => void handleSubmit(event)}>
              <DialogHeader>
                <DialogTitle>Spotted something?</DialogTitle>
                <DialogDescription>
                  Found a glitch or had a bright idea? Tell us — it goes straight
                  to the couple's to-do list.
                </DialogDescription>
              </DialogHeader>

              <div
                role="group"
                aria-label="Feedback type"
                className="grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1"
              >
                {TYPE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={type === option.value}
                    onClick={() => setType(option.value)}
                    className={cn(
                      'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                      type === option.value
                        ? 'bg-plum text-cream shadow'
                        : 'text-gray-600 hover:text-plum',
                    )}
                  >
                    <span aria-hidden="true" className="mr-1.5">
                      {option.icon}
                    </span>
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="grid gap-1.5">
                <label htmlFor="feedback-message" className="text-sm font-medium">
                  What happened, or what would make this better?
                </label>
                <textarea
                  id="feedback-message"
                  value={message}
                  maxLength={2000}
                  rows={4}
                  onChange={(event) => setMessage(event.target.value)}
                  className="w-full resize-y rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-plum"
                  placeholder={
                    type === 'bug'
                      ? 'e.g. The RSVP button does nothing on my phone…'
                      : 'e.g. It would be lovely if the schedule showed a map…'
                  }
                />
              </div>

              {contextLine && (
                <p className="m-0 text-xs text-gray-400">
                  Sent with: {contextLine}
                </p>
              )}

              {error && (
                <p className="m-0 text-sm text-red-600" role="alert">
                  {error}
                </p>
              )}

              <div className="flex justify-end">
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Sending…' : 'Send'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
