import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useParams } from 'react-router-dom'

import { GuestLayout } from '@/components/GuestLayout'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { usePageTitle } from '@/hooks/usePageTitle'
import {
  PartyApiError,
  useCreatePartyMessage,
  useModeratePartyMessage,
  usePartySummary,
  useSetPartyReveal,
  useUpdatePartyInfo,
  type PartyMessage,
  type PartyName,
} from '@/hooks/useParty'

const PARTY_TITLE: Record<PartyName, string> = {
  stag: 'Stag Do',
  hen: 'Hen Do',
}

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

function RevealBanner({ party }: { party: PartyName }) {
  const { data: summary } = usePartySummary(party)
  const revealMutation = useSetPartyReveal(party)
  const [error, setError] = useState<string | null>(null)

  const banner = summary?.reveal_banner
  if (!banner) {
    return null
  }

  const toggle = async () => {
    setError(null)
    try {
      await revealMutation.mutateAsync({
        inviteId: banner.subject_invite_id,
        revealed: !banner.revealed,
      })
    } catch (err) {
      setError(err instanceof PartyApiError ? err.message : 'Unable to update the reveal.')
    }
  }

  return (
    <Card className="border-gold/60 bg-gold/5">
      <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
        <p className="m-0 text-sm text-gray-700">
          {banner.revealed
            ? `${banner.subject_name} can now see this ${PARTY_TITLE[party]}.`
            : `${banner.subject_name} hasn't seen this yet — reveal it to them?`}
        </p>
        <div className="flex items-center gap-3">
          {error && <Alert variant="destructive">{error}</Alert>}
          <Button
            type="button"
            variant={banner.revealed ? 'outline' : 'default'}
            size="sm"
            disabled={revealMutation.isPending}
            onClick={() => void toggle()}
          >
            {revealMutation.isPending
              ? 'Saving...'
              : banner.revealed
                ? 'Hide again'
                : 'Reveal it to them'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function DetailsCard({ party, isPartyAdmin }: { party: PartyName; isPartyAdmin: boolean }) {
  const { data: summary } = usePartySummary(party)
  const updateMutation = useUpdatePartyInfo(party)
  const [editing, setEditing] = useState(false)
  const [details, setDetails] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setDetails(summary?.info.details ?? '')
  }, [summary?.info.details])

  const save = async () => {
    setError(null)
    try {
      await updateMutation.mutateAsync(details.trim() || null)
      setEditing(false)
    } catch (err) {
      setError(err instanceof PartyApiError ? err.message : 'Unable to save details.')
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>{PARTY_TITLE[party]} Details</CardTitle>
          <CardDescription>The plan so far.</CardDescription>
        </div>
        {isPartyAdmin && !editing && (
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {error && <Alert variant="destructive">{error}</Alert>}
        {editing ? (
          <div className="grid gap-3">
            <Label htmlFor="party-details-textarea" className="sr-only">
              Party details
            </Label>
            <textarea
              id="party-details-textarea"
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              rows={4}
              placeholder="Date, venue, the plan..."
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-base resize-vertical"
            />
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                disabled={updateMutation.isPending}
                onClick={() => void save()}
              >
                {updateMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : summary?.info.details ? (
          <p className="text-sm text-gray-700 m-0 whitespace-pre-wrap">{summary.info.details}</p>
        ) : (
          <p className="text-sm text-gray-500 m-0 italic">No details yet.</p>
        )}
      </CardContent>
    </Card>
  )
}

function MembersCard({ party }: { party: PartyName }) {
  const { data: summary } = usePartySummary(party)
  const members = summary?.members ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Who&apos;s in</CardTitle>
      </CardHeader>
      <CardContent>
        {members.length === 0 ? (
          <p className="text-sm text-gray-500 m-0 italic">No one flagged in yet.</p>
        ) : (
          <ul className="m-0 grid gap-2 pl-0" style={{ listStyle: 'none' }}>
            {members.map((member) => (
              <li key={member.invite_id} className="flex items-center gap-2 text-sm">
                <span className="text-gray-900">{member.name}</span>
                {member.party_admin && (
                  <Badge variant="success">{member.party_title || 'Party Admin'}</Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function MessageRow({
  message,
  isPartyAdmin,
  onModerate,
  moderating,
}: {
  message: PartyMessage
  isPartyAdmin: boolean
  onModerate: (message: PartyMessage, patch: { hidden?: boolean; pinned?: boolean }) => void
  moderating: boolean
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            {message.author_name}
            {message.pinned && <Badge variant="success">Pinned</Badge>}
            {message.hidden && <Badge variant="warning">Hidden</Badge>}
          </CardTitle>
          <CardDescription>{formatDate(message.created_at)}</CardDescription>
        </div>
        {isPartyAdmin && (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={moderating}
              aria-label={`${message.pinned ? 'Unpin' : 'Pin'} message from ${message.author_name}`}
              onClick={() => onModerate(message, { pinned: !message.pinned })}
            >
              {message.pinned ? 'Unpin' : 'Pin'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={moderating}
              aria-label={`${message.hidden ? 'Unhide' : 'Hide'} message from ${message.author_name}`}
              onClick={() => onModerate(message, { hidden: !message.hidden })}
            >
              {message.hidden ? 'Unhide' : 'Hide'}
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-700 m-0 whitespace-pre-wrap">{message.message}</p>
      </CardContent>
    </Card>
  )
}

function MessageBoard({ party, isPartyAdmin }: { party: PartyName; isPartyAdmin: boolean }) {
  const { data: summary, isLoading, isError, error } = usePartySummary(party)
  const createMutation = useCreatePartyMessage(party)
  const moderateMutation = useModeratePartyMessage(party)

  const [message, setMessage] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const messages = summary?.messages ?? []

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitError(null)

    const trimmed = message.trim()
    if (!trimmed) {
      setSubmitError('Please write something before posting.')
      return
    }

    try {
      await createMutation.mutateAsync(trimmed)
      setMessage('')
    } catch (err) {
      setSubmitError(err instanceof PartyApiError ? err.message : 'Unable to post your message.')
    }
  }

  const handleModerate = async (
    target: PartyMessage,
    patch: { hidden?: boolean; pinned?: boolean },
  ) => {
    setActionError(null)
    try {
      await moderateMutation.mutateAsync({ messageId: target.id, payload: patch })
    } catch (err) {
      setActionError(err instanceof PartyApiError ? err.message : 'Unable to update this message.')
    }
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Message board</CardTitle>
        </CardHeader>
        <CardContent>
          <form noValidate onSubmit={(e) => void handleSubmit(e)} className="grid gap-3">
            {submitError && <Alert variant="destructive">{submitError}</Alert>}
            <Label htmlFor="party-message-textarea" className="sr-only">
              Message
            </Label>
            <textarea
              id="party-message-textarea"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Say something to the group..."
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-base resize-vertical"
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Posting...' : 'Post message'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {actionError && <Alert variant="destructive">{actionError}</Alert>}

      {isLoading && (
        <div role="status" className="text-sm text-gray-600 border border-gray-200 rounded-md p-4">
          Loading messages...
        </div>
      )}

      {isError && !isLoading && (
        <Alert variant="destructive">
          {error instanceof Error ? error.message : 'Unable to load messages.'}
        </Alert>
      )}

      {!isLoading && !isError && messages.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center text-sm text-gray-600">
            No messages yet — be the first to say something.
          </CardContent>
        </Card>
      )}

      {!isLoading &&
        !isError &&
        messages.map((item) => (
          <MessageRow
            key={item.id}
            message={item}
            isPartyAdmin={isPartyAdmin}
            onModerate={(target, patch) => void handleModerate(target, patch)}
            moderating={moderateMutation.isPending}
          />
        ))}
    </div>
  )
}

export function Party() {
  const params = useParams<{ party: string }>()
  const party = params.party === 'stag' || params.party === 'hen' ? params.party : null

  usePageTitle(party ? PARTY_TITLE[party] : 'Party')

  const { data: summary, isLoading, isError, error } = usePartySummary(party ?? 'stag')

  if (!party) {
    return <Navigate replace to="/dashboard" />
  }

  return (
    <GuestLayout>
      <div className="max-w-3xl mx-auto w-full grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{PARTY_TITLE[party]}</CardTitle>
            <CardDescription>A private space, just for the {PARTY_TITLE[party]} crew.</CardDescription>
          </CardHeader>
        </Card>

        {isLoading && (
          <div role="status" className="text-sm text-gray-600 border border-gray-200 rounded-md p-4">
            Loading...
          </div>
        )}

        {isError && !isLoading && (
          <Alert variant="destructive">
            {error instanceof Error ? error.message : 'Unable to load this party.'}
          </Alert>
        )}

        {!isLoading && !isError && summary && (
          <>
            <RevealBanner party={party} />
            <DetailsCard party={party} isPartyAdmin={summary.is_party_admin} />
            <MembersCard party={party} />
            <MessageBoard party={party} isPartyAdmin={summary.is_party_admin} />
          </>
        )}
      </div>
    </GuestLayout>
  )
}
