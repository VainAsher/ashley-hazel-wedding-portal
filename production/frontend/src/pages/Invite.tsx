import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { AuthApiError, fetchCurrentUser, loginWithInviteCode } from '../api/auth'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Alert } from '../components/ui/alert'

function inviteErrorMessage(error: unknown): string {
  if (error instanceof AuthApiError && error.status === 401) {
    return 'Code not found'
  }

  if (error instanceof AuthApiError) {
    return error.message
  }

  return 'Unable to reach the server. Try again.'
}

export function Invite() {
  const navigate = useNavigate()
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const trimmedCode = inviteCode.trim()
    if (!trimmedCode) {
      setError('Invite code is required.')
      return
    }

    setSubmitting(true)
    try {
      await loginWithInviteCode(trimmedCode)
      const user = await fetchCurrentUser()
      navigate(user.role === 'guest' ? '/rsvp' : '/admin')
    } catch (err) {
      setError(inviteErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="grid items-start min-h-[calc(100vh-52px)] p-5">
      <section className="border border-[#d6d9df] rounded-md grid gap-[18px] max-w-[420px] p-5 w-full">
        <div className="grid gap-1.5">
          <h1 className="text-2xl leading-tight font-semibold">Enter Invite Code</h1>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-3">
          <label htmlFor="invite-code" className="text-sm font-bold text-[#374151]">
            Invite Code
          </label>
          <Input
            autoComplete="off"
            id="invite-code"
            name="inviteCode"
            onChange={(event) => setInviteCode(event.target.value)}
            type="text"
            value={inviteCode}
          />

          {error && (
            <Alert variant="destructive">
              {error}
            </Alert>
          )}

          <Button disabled={submitting} type="submit">
            {submitting ? 'Checking...' : 'Enter'}
          </Button>
        </form>
      </section>
    </main>
  )
}
