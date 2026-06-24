import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { AuthApiError } from '../api/auth'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Alert } from '../components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { AuthLayout } from '../components/AuthLayout'

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
  const { login } = useAuth()
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
      // Route through AuthContext so the shared user (and the layout header
      // that reads it) updates on login — not just this page's local fetch.
      const user = await login(trimmedCode)
      navigate(user.role === 'guest' ? '/dashboard' : '/admin')
    } catch (err) {
      setError(inviteErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout title="Enter Invite Code">
      <Card>
        <CardHeader>
          <CardTitle>Welcome</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="invite-code">
                Invite Code
              </Label>
              <Input
                autoComplete="off"
                id="invite-code"
                name="inviteCode"
                onChange={(event) => setInviteCode(event.target.value)}
                placeholder="Enter your invite code"
                type="text"
                value={inviteCode}
              />
            </div>

            {error && (
              <Alert variant="destructive">
                {error}
              </Alert>
            )}

            <Button disabled={submitting} type="submit" className="w-full">
              {submitting ? 'Checking...' : 'Enter'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </AuthLayout>
  )
}
