import { useState, useEffect, type FormEvent } from 'react'

interface Invite {
  id: number
  code: string
  wedding_id: number
  role: string
  guest_id: number | null
  household_name: string | null
  created_at: string
}

interface Guest {
  id: number
  name: string
  email: string | null
}

export function InviteManagement({ weddingId }: { weddingId: number }) {
  const [invites, setInvites] = useState<Invite[]>([])
  const [guests, setGuests] = useState<Guest[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [role, setRole] = useState<string>('guest')
  const [generating, setGenerating] = useState(false)

  const [linkingInviteId, setLinkingInviteId] = useState<number | null>(null)
  const [linkingGuestId, setLinkingGuestId] = useState<number | null>(null)

  // Load invites and guests on mount
  useEffect(() => {
    loadInvites()
    loadGuests()
  }, [weddingId])

  const loadInvites = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/invites?wedding_id=${weddingId}`, {
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Failed to load invites')
      const data = await res.json()
      setInvites(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading invites')
    } finally {
      setLoading(false)
    }
  }

  const loadGuests = async () => {
    try {
      const res = await fetch(`/api/guests?wedding_id=${weddingId}`, {
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Failed to load guests')
      const data = await res.json()
      setGuests(data)
    } catch (err) {
      console.error('Error loading guests:', err)
    }
  }

  const generateInvite = async (e: FormEvent) => {
    e.preventDefault()
    setGenerating(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch('/api/invites', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wedding_id: weddingId,
          role,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || 'Failed to generate invite')
      }

      const newInvite = await res.json()
      setInvites([newInvite, ...invites])
      setSuccess(`Invite code generated: ${newInvite.code}`)
      setRole('guest')

      // Auto-clear success message after 3 seconds
      setTimeout(() => {
        setSuccess(null)
      }, 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error generating invite')
    } finally {
      setGenerating(false)
    }
  }

  const linkGuestToInvite = async () => {
    if (!linkingInviteId || !linkingGuestId) return

    try {
      console.log(`Linking guest ${linkingGuestId} to invite ${linkingInviteId}`)
      const res = await fetch(`/api/invites/${linkingInviteId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guest_id: linkingGuestId }),
      })

      if (!res.ok) throw new Error('Failed to link guest')

      const updated = await res.json()
      console.log(`Link response:`, updated)
      setInvites(invites.map((i) => (i.id === linkingInviteId ? updated : i)))
      setSuccess('Guest linked to invite')
      setLinkingInviteId(null)
      setLinkingGuestId(null)

      // Auto-clear success message after 3 seconds
      setTimeout(() => {
        setSuccess(null)
      }, 3000)
    } catch (err) {
      console.error('Error linking guest:', err)
      setError(err instanceof Error ? err.message : 'Error linking guest')
    }
  }

  const deleteInvite = async (inviteId: number) => {
    if (!confirm('Delete this invite?')) return

    try {
      const res = await fetch(`/api/invites/${inviteId}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!res.ok) throw new Error('Failed to delete invite')

      setInvites(invites.filter((i) => i.id !== inviteId))
      setError(null)
      setSuccess('Invite deleted')

      // Auto-clear success message after 3 seconds
      setTimeout(() => {
        setSuccess(null)
      }, 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error deleting invite')
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setSuccess(`Copied: ${text}`)
  }

  const getUnlinkedGuests = () =>
    guests.filter((g) => !invites.some((i) => i.guest_id === g.id))

  return (
    <div style={containerStyle}>
      {/* Error Alert */}
      {error && <div style={alertErrorStyle}>{error}</div>}

      {/* Success Alert */}
      {success && <div style={alertSuccessStyle}>{success}</div>}

      {/* Generate Invite Form */}
      <section style={sectionStyle}>
        <h2 style={titleStyle}>Generate New Invite</h2>
        <form onSubmit={generateInvite} style={formStyle}>
          <div style={formGroupStyle}>
            <label style={labelStyle}>Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              style={inputStyle}
              disabled={generating}
            >
              <option value="guest">Guest</option>
              <option value="coordinator">Coordinator</option>
              <option value="couple">Couple</option>
            </select>
          </div>
          <button
            type="submit"
            style={buttonPrimaryStyle}
            disabled={generating}
          >
            {generating ? 'Generating...' : 'Generate Code'}
          </button>
        </form>
      </section>

      {/* Invites List */}
      <section style={sectionStyle}>
        <h2 style={titleStyle}>
          Invites ({invites.length})
        </h2>

        {loading ? (
          <p>Loading invites...</p>
        ) : invites.length === 0 ? (
          <p>No invites yet</p>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr style={tableHeaderRowStyle}>
                <th style={tableCellStyle}>Code</th>
                <th style={tableCellStyle}>Role</th>
                <th style={tableCellStyle}>Guest</th>
                <th style={tableCellStyle}>Created</th>
                <th style={tableCellStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((invite) => {
                const linkedGuest = guests.find(
                  (g) => g.id === invite.guest_id
                )
                return (
                  <tr key={invite.id} style={tableRowStyle}>
                    <td style={tableCellStyle}>
                      <code style={codeStyle}>{invite.code}</code>
                      <button
                        onClick={() => copyToClipboard(invite.code)}
                        style={buttonSmallStyle}
                        title="Copy to clipboard"
                      >
                        📋
                      </button>
                    </td>
                    <td style={tableCellStyle}>{invite.role}</td>
                    <td style={tableCellStyle}>
                      {linkedGuest ? (
                        <span>{linkedGuest.name}</span>
                      ) : invite.household_name ? (
                        <span style={mutedStyle}>{invite.household_name}</span>
                      ) : (
                        <span style={mutedStyle}>Unlinked</span>
                      )}
                    </td>
                    <td style={tableCellStyle}>
                      {new Date(invite.created_at).toLocaleDateString()}
                    </td>
                    <td style={tableCellActionsStyle}>
                      {!linkedGuest && getUnlinkedGuests().length > 0 && (
                        <button
                          onClick={() => setLinkingInviteId(invite.id)}
                          style={buttonSmallStyle}
                          title="Link to guest"
                        >
                          🔗
                        </button>
                      )}
                      <button
                        onClick={() => deleteInvite(invite.id)}
                        style={buttonDangerSmallStyle}
                        title="Delete invite"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* Link Guest Modal */}
      {linkingInviteId && (
        <div style={modalOverlayStyle} onClick={() => setLinkingInviteId(null)}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <h3 style={modalTitleStyle}>Link Guest to Invite</h3>

            <div style={formGroupStyle}>
              <label style={labelStyle}>Select Guest</label>
              <select
                value={linkingGuestId || ''}
                onChange={(e) => setLinkingGuestId(parseInt(e.target.value))}
                style={inputStyle}
              >
                <option value="">Choose a guest...</option>
                {getUnlinkedGuests().map((guest) => (
                  <option key={guest.id} value={guest.id}>
                    {guest.name} {guest.email && `(${guest.email})`}
                  </option>
                ))}
              </select>
            </div>

            <div style={modalButtonsStyle}>
              <button
                onClick={linkGuestToInvite}
                style={buttonPrimaryStyle}
                disabled={!linkingGuestId}
              >
                Link Guest
              </button>
              <button
                onClick={() => setLinkingInviteId(null)}
                style={buttonSecondaryStyle}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Styles
const containerStyle = {
  display: 'grid',
  gap: '24px',
  padding: '20px',
  maxWidth: '1200px',
  margin: '0 auto',
}

const sectionStyle = {
  border: '1px solid #d6d9df',
  borderRadius: '6px',
  padding: '20px',
  backgroundColor: '#ffffff',
}

const titleStyle = {
  fontSize: '20px',
  fontWeight: 700,
  margin: '0 0 16px 0',
}

const formStyle = {
  display: 'grid',
  gap: '12px',
  gridTemplateColumns: 'auto auto',
  alignItems: 'end',
}

const formGroupStyle = {
  display: 'grid',
  gap: '6px',
}

const labelStyle = {
  color: '#374151',
  fontSize: '14px',
  fontWeight: 700,
}

const inputStyle = {
  border: '1px solid #aeb6c2',
  borderRadius: '4px',
  fontSize: '14px',
  padding: '8px 10px',
  minWidth: '200px',
}

const buttonPrimaryStyle = {
  background: '#1f6f5b',
  border: '1px solid #1f6f5b',
  borderRadius: '4px',
  color: '#ffffff',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: 700,
  minHeight: '36px',
  padding: '8px 14px',
}

const buttonSecondaryStyle = {
  background: '#ffffff',
  border: '1px solid #d6d9df',
  borderRadius: '4px',
  color: '#1f2933',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: 700,
  minHeight: '36px',
  padding: '8px 14px',
}

const buttonSmallStyle = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  fontSize: '16px',
  padding: '4px 8px',
  marginLeft: '4px',
}

const buttonDangerSmallStyle = {
  ...buttonSmallStyle,
  color: '#991b1b',
}

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse' as const,
}

const tableHeaderRowStyle = {
  borderBottom: '2px solid #d6d9df',
  backgroundColor: '#f9fafb',
}

const tableRowStyle = {
  borderBottom: '1px solid #e5e7eb',
}

const tableCellStyle = {
  padding: '12px',
  textAlign: 'left' as const,
  fontSize: '14px',
}

const tableCellActionsStyle = {
  ...tableCellStyle,
  display: 'flex',
  gap: '4px',
}

const codeStyle = {
  backgroundColor: '#f3f4f6',
  borderRadius: '3px',
  fontFamily: 'monospace',
  padding: '2px 4px',
  fontSize: '12px',
}

const mutedStyle = {
  color: '#6b7280',
  fontStyle: 'italic',
}

const alertErrorStyle = {
  backgroundColor: '#fef2f2',
  border: '1px solid #fecaca',
  borderRadius: '4px',
  color: '#991b1b',
  fontSize: '14px',
  padding: '10px',
}

const alertSuccessStyle = {
  backgroundColor: '#f0fdf4',
  border: '1px solid #86efac',
  borderRadius: '4px',
  color: '#166534',
  fontSize: '14px',
  padding: '10px',
}

const modalOverlayStyle = {
  position: 'fixed' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
}

const modalStyle = {
  backgroundColor: '#ffffff',
  borderRadius: '6px',
  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
  padding: '24px',
  maxWidth: '400px',
  width: '90%',
}

const modalTitleStyle = {
  fontSize: '18px',
  fontWeight: 700,
  margin: '0 0 16px 0',
}

const modalButtonsStyle = {
  display: 'flex',
  gap: '12px',
  marginTop: '16px',
  justifyContent: 'flex-end',
}
