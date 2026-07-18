import { useEffect, useState, type FormEvent } from 'react'

import { Heart } from 'lucide-react'

import { fetchCurrentUser } from '../api/auth'
import { MentionHighlightedText } from '../components/mentions/MentionHighlight'
import { MentionTextarea } from '../components/mentions/MentionTextarea'
import { Alert } from '../components/ui/alert'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import {
  BlessingsApiError,
  useBlessings,
  useCreateBlessing,
  type Blessing,
} from '../hooks/useBlessings'
import { useMentionsDirectory, type MentionDirectoryEntry } from '../hooks/useMentions'

function formatDate(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function BlessingCard({
  blessing,
  mentionDirectory,
}: {
  blessing: Blessing
  mentionDirectory: MentionDirectoryEntry[]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{blessing.author_name}</CardTitle>
        <CardDescription>{formatDate(blessing.created_at)}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-700 m-0 whitespace-pre-wrap">
          <MentionHighlightedText text={blessing.message} directory={mentionDirectory} />
        </p>
      </CardContent>
    </Card>
  )
}

// Mounted inside a modal by CelebrateContent (see Celebrate.tsx), which owns
// this route's document title -- no usePageTitle call here, since unmounting
// on modal close would otherwise reset the tab title to the generic site
// default instead of back to "Celebrate".
export function BlessingsContent() {
  const { data: blessings, isLoading, isError, error } = useBlessings()
  const createMutation = useCreateBlessing()
  const { data: mentionDirectory } = useMentionsDirectory('general')

  const [authorName, setAuthorName] = useState('')
  const [message, setMessage] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    fetchCurrentUser()
      .then((user) => {
        if (mounted && user.name) {
          setAuthorName(user.name)
        }
      })
      .catch(() => {
        // Name stays editable/empty if we cannot prefill it.
      })
    return () => {
      mounted = false
    }
  }, [])

  const blessingList = blessings ?? []

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitError(null)
    setFeedback(null)

    const trimmedMessage = message.trim()
    if (!trimmedMessage) {
      setSubmitError('Please write a blessing before submitting.')
      return
    }

    const trimmedName = authorName.trim()

    try {
      await createMutation.mutateAsync({
        author_name: trimmedName || null,
        message: trimmedMessage,
      })
      setFeedback('Thank you! Your blessing has been shared.')
      setMessage('')
    } catch (err) {
      setSubmitError(
        err instanceof BlessingsApiError ? err.message : 'Unable to post your blessing.',
      )
    }
  }

  const isSubmitting = createMutation.isPending

  return (
    <div className="max-w-3xl mx-auto w-full grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Blessings</CardTitle>
            <CardDescription>Leave a message for the happy couple.</CardDescription>
          </CardHeader>
        </Card>

        {feedback && (
          <Alert variant="success" role="status" aria-live="polite">
            {feedback}
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sign the guestbook</CardTitle>
          </CardHeader>
          <CardContent>
            <form noValidate onSubmit={handleSubmit} className="grid gap-4">
              {submitError && <Alert variant="destructive">{submitError}</Alert>}

              <div className="grid gap-2">
                <Label htmlFor="blessing-author">Your name</Label>
                <Input
                  id="blessing-author"
                  value={authorName}
                  onChange={(event) => setAuthorName(event.target.value)}
                  placeholder="Your name"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="blessing-message">Message</Label>
                <MentionTextarea
                  id="blessing-message"
                  scope="general"
                  value={message}
                  onChange={setMessage}
                  rows={4}
                  maxLength={1000}
                  placeholder="Share your well wishes... (@ to mention someone)"
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-base resize-vertical focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Posting...' : 'Post blessing'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {isLoading && (
          <Card>
            <CardContent className="pt-6">
              <div role="status" className="text-gray-600 text-sm">
                Loading blessings...
              </div>
            </CardContent>
          </Card>
        )}

        {isError && !isLoading && (
          <Alert variant="destructive">
            {error instanceof Error ? error.message : 'Unable to load blessings.'}
          </Alert>
        )}

        {!isLoading && !isError && blessingList.length === 0 && (
          <Card className="flex flex-col items-center justify-center gap-3 p-10 text-center">
            <Heart className="h-10 w-10 text-gray-400" aria-hidden="true" />
            <div>
              <h3 className="text-base font-semibold text-gray-900 m-0">No blessings yet</h3>
              <p className="text-sm text-gray-600 m-0 mt-1">
                Be the first to leave a message for the couple.
              </p>
            </div>
          </Card>
        )}

        {!isLoading && !isError && blessingList.length > 0 && (
          <section aria-label="Blessings" className="grid gap-4">
            {blessingList.map((blessing) => (
              <BlessingCard
                key={blessing.id}
                blessing={blessing}
                mentionDirectory={mentionDirectory ?? []}
              />
            ))}
          </section>
        )}
    </div>
  )
}

