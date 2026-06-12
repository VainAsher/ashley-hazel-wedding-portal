import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { AuthApiError, loginWithInviteCode } from '../api/auth'

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
      navigate('/rsvp')
    } catch (err) {
      setError(inviteErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main style={pageStyle}>
      <section style={panelStyle}>
        <div style={headerStyle}>
          <h1 style={titleStyle}>Enter Invite Code</h1>
        </div>

        <form onSubmit={handleSubmit} style={formStyle}>
          <label htmlFor="invite-code" style={labelStyle}>
            Invite Code
          </label>
          <input
            autoComplete="off"
            id="invite-code"
            name="inviteCode"
            onChange={(event) => setInviteCode(event.target.value)}
            style={inputStyle}
            type="text"
            value={inviteCode}
          />

          {error && (
            <div role="alert" style={errorStyle}>
              {error}
            </div>
          )}

          <button disabled={submitting} style={primaryButtonStyle} type="submit">
            {submitting ? 'Checking...' : 'Continue'}
          </button>
        </form>
      </section>
    </main>
  )
}

const pageStyle = {
  alignItems: 'start',
  display: 'grid',
  minHeight: 'calc(100vh - 52px)',
  padding: '20px',
}

const panelStyle = {
  border: '1px solid #d6d9df',
  borderRadius: '6px',
  display: 'grid',
  gap: '18px',
  maxWidth: '420px',
  padding: '20px',
  width: '100%',
}

const headerStyle = {
  display: 'grid',
  gap: '6px',
}

const titleStyle = {
  fontSize: '26px',
  lineHeight: 1.2,
  margin: 0,
}

const formStyle = {
  display: 'grid',
  gap: '12px',
}

const labelStyle = {
  color: '#374151',
  fontSize: '14px',
  fontWeight: 700,
}

const inputStyle = {
  border: '1px solid #aeb6c2',
  borderRadius: '4px',
  fontSize: '16px',
  padding: '10px',
}

const primaryButtonStyle = {
  background: '#1f6f5b',
  border: '1px solid #1f6f5b',
  borderRadius: '4px',
  color: '#ffffff',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: 700,
  minHeight: '42px',
  padding: '10px 14px',
}

const errorStyle = {
  background: '#fef2f2',
  border: '1px solid #fecaca',
  borderRadius: '4px',
  color: '#991b1b',
  fontSize: '14px',
  padding: '10px',
}
