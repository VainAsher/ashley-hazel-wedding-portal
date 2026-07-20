import { useState, useEffect, type FormEvent } from 'react'

type PartyValue = 'stag' | 'hen' | null

interface Invite {
  id: number
  code: string
  wedding_id: number
  role: string
  guest_id: number | null
  household_name: string | null
  created_at: string
  party?: PartyValue
  party_admin?: boolean
  party_title?: string | null
  partner_label?: string | null
  associated_party?: PartyValue
}

interface Guest {
  id: number
  name: string
  email: string | null
}

const PARTY_ADMIN_TITLE: Record<'stag' | 'hen', string> = {
  stag: 'Best Man',
  hen: 'Maid of Honour',
}

// The couple can name up to this many Best Man/Maid of Honour per party
// (see MAX_PARTY_ADMINS_PER_PARTY in app/api/invites.py — keep in sync).
const MAX_PARTY_ADMINS_PER_PARTY = 2

function partyAdminHolderLabel(invite: Invite, guests: Guest[]): string {
  return (
    invite.household_name ||
    guests.find((g) => g.id === invite.guest_id)?.name ||
    'someone'
  )
}

export function InviteManagement({ weddingId }: { weddingId: number }) {
  const [invites, setInvites] = useState<Invite[]>([])
  const [guests, setGuests] = useState<Guest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [role, setRole] = useState<string>('guest')
  const [generating, setGenerating] = useState(false)

  // Wave 3 item 14 D1: "wedding party" flags for a new guest invite.
  const [party, setParty] = useState<'none' | 'stag' | 'hen'>('none')
  const [partyAdmin, setPartyAdmin] = useState(false)
  // Individual couple identity fields for a new couple invite.
  const [partnerLabel, setPartnerLabel] = useState('')
  const [associatedParty, setAssociatedParty] = useState<'none' | 'stag' | 'hen'>('none')

  const [linkingInviteId, setLinkingInviteId] = useState<number | null>(null)
  const [linkingGuestId, setLinkingGuestId] = useState<number | null>(null)

  // Party fields editor (guest party/party_admin or couple identity fields).
  const [editingPartyInvite, setEditingPartyInvite] = useState<Invite | null>(null)
  const [editParty, setEditParty] = useState<'none' | 'stag' | 'hen'>('none')
  const [editPartyAdmin, setEditPartyAdmin] = useState(false)
  const [editPartnerLabel, setEditPartnerLabel] = useState('')
  const [editAssociatedParty, setEditAssociatedParty] = useState<'none' | 'stag' | 'hen'>('none')
  const [editSaving, setEditSaving] = useState(false)

  // Load invites and guests on mount
  useEffect(() => {
    const load = async () => {
      try {
        await Promise.all([loadInvites(), loadGuests()])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [weddingId])

  const loadInvites = async () => {
    try {
      const res = await fetch(`/api/invites?wedding_id=${weddingId}`, {
        credentials: 'include',
      })
      if (res.status === 403) {
        throw new Error(
          'Only the couple can view and manage invitation codes.',
        )
      }
      if (!res.ok) throw new Error('Failed to load invites')
      const data = await res.json()
      setInvites(data)
      return data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading invites')
      return []
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
      return data
    } catch (err) {
      console.error('Error loading guests:', err)
      return []
    }
  }

  // The guest(s) currently holding Best Man/Maid of Honour for a party (up
  // to MAX_PARTY_ADMINS_PER_PARTY) — used to show capacity messaging.
  const currentPartyAdmins = (target: 'stag' | 'hen') =>
    invites.filter((invite) => invite.party === target && invite.party_admin)

  const generateInvite = async (e: FormEvent) => {
    e.preventDefault()
    setGenerating(true)
    setError(null)
    setSuccess(null)

    try {
      const body: Record<string, unknown> = { wedding_id: weddingId, role }
      if (role === 'guest' && party !== 'none') {
        body.party = party
        body.party_admin = partyAdmin
      }
      if (role === 'couple') {
        if (partnerLabel.trim()) body.partner_label = partnerLabel.trim()
        if (associatedParty !== 'none') body.associated_party = associatedParty
      }

      const res = await fetch('/api/invites', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || 'Failed to generate invite')
      }

      const newInvite = await res.json()
      setInvites([newInvite, ...invites])
      setSuccess(`Invite code generated: ${newInvite.code}`)
      setRole('guest')
      setParty('none')
      setPartyAdmin(false)
      setPartnerLabel('')
      setAssociatedParty('none')

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

  const openPartyEditor = (invite: Invite) => {
    setEditingPartyInvite(invite)
    setEditParty((invite.party as 'stag' | 'hen' | undefined) ?? 'none')
    setEditPartyAdmin(invite.party_admin ?? false)
    setEditPartnerLabel(invite.partner_label ?? '')
    setEditAssociatedParty((invite.associated_party as 'stag' | 'hen' | undefined) ?? 'none')
  }

  const savePartyEdits = async () => {
    if (!editingPartyInvite) return
    setEditSaving(true)
    setError(null)

    try {
      const body: Record<string, unknown> =
        editingPartyInvite.role === 'guest'
          ? {
              party: editParty === 'none' ? null : editParty,
              party_admin: editParty === 'none' ? false : editPartyAdmin,
            }
          : {
              partner_label: editPartnerLabel.trim() || null,
              associated_party: editAssociatedParty === 'none' ? null : editAssociatedParty,
            }

      const res = await fetch(`/api/invites/${editingPartyInvite.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || 'Failed to update invite')
      }

      const updated = await res.json()
      setInvites((current) => current.map((i) => (i.id === updated.id ? updated : i)))
      setSuccess('Wedding party details updated')
      setEditingPartyInvite(null)

      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error updating invite')
    } finally {
      setEditSaving(false)
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
            <label htmlFor="role-select" style={labelStyle}>Role</label>
            <select
              id="role-select"
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

        {/* Wave 3 item 14 D1: guest "wedding party" flags. */}
        {role === 'guest' && (
          <fieldset style={partyFieldsetStyle}>
            <legend style={partyLegendStyle}>Wedding party (optional)</legend>
            <div style={radioGroupStyle} role="radiogroup" aria-label="Wedding party">
              {(['none', 'stag', 'hen'] as const).map((value) => (
                <label key={value} style={radioLabelStyle}>
                  <input
                    type="radio"
                    name="new-invite-party"
                    value={value}
                    checked={party === value}
                    onChange={() => {
                      setParty(value)
                      if (value === 'none') setPartyAdmin(false)
                    }}
                  />
                  {value === 'none' ? 'None' : value === 'stag' ? 'Stag Do' : 'Hen Do'}
                </label>
              ))}
            </div>
            {party !== 'none' && (() => {
              const holders = currentPartyAdmins(party)
              const atCapacity = holders.length >= MAX_PARTY_ADMINS_PER_PARTY
              return (
                <label style={{ ...radioLabelStyle, marginTop: '8px' }}>
                  <input
                    type="checkbox"
                    checked={partyAdmin}
                    disabled={atCapacity && !partyAdmin}
                    onChange={(e) => setPartyAdmin(e.target.checked)}
                  />
                  {`Make this guest a ${PARTY_ADMIN_TITLE[party]}`}
                  {atCapacity && !partyAdmin && (
                    <span style={mutedStyle}>
                      {' '}
                      — already has {MAX_PARTY_ADMINS_PER_PARTY}:{' '}
                      {holders.map((h) => partyAdminHolderLabel(h, guests)).join(' & ')}
                    </span>
                  )}
                </label>
              )
            })()}
          </fieldset>
        )}

        {/* Wave 3 item 14 D1: individual couple identity fields. */}
        {role === 'couple' && (
          <fieldset style={partyFieldsetStyle}>
            <legend style={partyLegendStyle}>Individual identity (optional)</legend>
            <div style={formGroupStyle}>
              <label htmlFor="partner-label-input" style={labelStyle}>
                Partner label
              </label>
              <input
                id="partner-label-input"
                type="text"
                value={partnerLabel}
                onChange={(e) => setPartnerLabel(e.target.value)}
                placeholder="e.g. Ashley"
                style={inputStyle}
              />
            </div>
            <div style={formGroupStyle}>
              <label htmlFor="associated-party-select" style={labelStyle}>
                Their own party
              </label>
              <select
                id="associated-party-select"
                value={associatedParty}
                onChange={(e) => setAssociatedParty(e.target.value as 'none' | 'stag' | 'hen')}
                style={inputStyle}
              >
                <option value="none">None</option>
                <option value="stag">Stag Do</option>
                <option value="hen">Hen Do</option>
              </select>
            </div>
          </fieldset>
        )}
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
                <th style={tableCellStyle}>Wedding Party</th>
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
                      {invite.role === 'guest' && invite.party && (
                        <span>
                          {invite.party === 'stag' ? 'Stag Do' : 'Hen Do'}
                          {invite.party_admin && (
                            <span style={mutedStyle}> ({invite.party_title || PARTY_ADMIN_TITLE[invite.party]})</span>
                          )}
                        </span>
                      )}
                      {invite.role === 'couple' && invite.associated_party && (
                        <span style={mutedStyle}>
                          {invite.partner_label ? `${invite.partner_label} — ` : ''}
                          {invite.associated_party === 'stag' ? 'Stag Do' : 'Hen Do'}
                        </span>
                      )}
                      {((invite.role === 'guest' && !invite.party) ||
                        (invite.role === 'couple' && !invite.associated_party)) && (
                        <span style={mutedStyle}>—</span>
                      )}
                    </td>
                    <td style={tableCellStyle}>
                      {new Date(invite.created_at).toLocaleDateString()}
                    </td>
                    <td style={tableCellActionsStyle}>
                      {!linkedGuest && getUnlinkedGuests().length > 0 && (
                        <button
                          onClick={() => {
                            setLinkingInviteId(invite.id)
                            setLinkingGuestId(null)
                          }}
                          style={buttonSmallStyle}
                          title="Link to guest"
                        >
                          🔗
                        </button>
                      )}
                      {(invite.role === 'guest' || invite.role === 'couple') && (
                        <button
                          onClick={() => openPartyEditor(invite)}
                          style={buttonSmallStyle}
                          title="Edit wedding party details"
                        >
                          🎉
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
        <div style={modalOverlayStyle} onClick={(e) => {
          if (e.target === e.currentTarget) {
            setLinkingInviteId(null)
            setLinkingGuestId(null)
          }
        }}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <h3 style={modalTitleStyle}>Link Guest to Invite</h3>

            <div style={formGroupStyle}>
              <label htmlFor="guest-select" style={labelStyle}>Select Guest</label>
              <select
                id="guest-select"
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
                onClick={() => {
                  setLinkingInviteId(null)
                  setLinkingGuestId(null)
                }}
                style={buttonSecondaryStyle}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Wedding Party Editor Modal (Wave 3 item 14 D1) */}
      {editingPartyInvite && (
        <div
          style={modalOverlayStyle}
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingPartyInvite(null)
          }}
        >
          <div
            style={modalStyle}
            role="dialog"
            aria-modal="true"
            aria-label="Edit Wedding Party Details"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={modalTitleStyle}>Edit Wedding Party Details</h3>

            {editingPartyInvite.role === 'guest' ? (
              <>
                <div
                  style={radioGroupStyle}
                  role="radiogroup"
                  aria-label="Wedding party"
                >
                  {(['none', 'stag', 'hen'] as const).map((value) => (
                    <label key={value} style={radioLabelStyle}>
                      <input
                        type="radio"
                        name="edit-invite-party"
                        value={value}
                        checked={editParty === value}
                        onChange={() => {
                          setEditParty(value)
                          if (value === 'none') setEditPartyAdmin(false)
                        }}
                      />
                      {value === 'none' ? 'None' : value === 'stag' ? 'Stag Do' : 'Hen Do'}
                    </label>
                  ))}
                </div>
                {editParty !== 'none' && (() => {
                  const holders = currentPartyAdmins(editParty).filter(
                    (h) => h.id !== editingPartyInvite.id,
                  )
                  const atCapacity = holders.length >= MAX_PARTY_ADMINS_PER_PARTY
                  return (
                    <label style={{ ...radioLabelStyle, marginTop: '8px' }}>
                      <input
                        type="checkbox"
                        checked={editPartyAdmin}
                        disabled={atCapacity && !editPartyAdmin}
                        onChange={(e) => setEditPartyAdmin(e.target.checked)}
                      />
                      {`Make this guest a ${PARTY_ADMIN_TITLE[editParty]}`}
                      {atCapacity && !editPartyAdmin && (
                        <span style={mutedStyle}>
                          {' '}
                          — already has {MAX_PARTY_ADMINS_PER_PARTY}:{' '}
                          {holders.map((h) => partyAdminHolderLabel(h, guests)).join(' & ')}
                        </span>
                      )}
                    </label>
                  )
                })()}
              </>
            ) : (
              <>
                <div style={formGroupStyle}>
                  <label htmlFor="edit-partner-label-input" style={labelStyle}>
                    Partner label
                  </label>
                  <input
                    id="edit-partner-label-input"
                    type="text"
                    value={editPartnerLabel}
                    onChange={(e) => setEditPartnerLabel(e.target.value)}
                    placeholder="e.g. Ashley"
                    style={inputStyle}
                  />
                </div>
                <div style={formGroupStyle}>
                  <label htmlFor="edit-associated-party-select" style={labelStyle}>
                    Their own party
                  </label>
                  <select
                    id="edit-associated-party-select"
                    value={editAssociatedParty}
                    onChange={(e) =>
                      setEditAssociatedParty(e.target.value as 'none' | 'stag' | 'hen')
                    }
                    style={inputStyle}
                  >
                    <option value="none">None</option>
                    <option value="stag">Stag Do</option>
                    <option value="hen">Hen Do</option>
                  </select>
                </div>
              </>
            )}

            <div style={modalButtonsStyle}>
              <button
                onClick={savePartyEdits}
                style={buttonPrimaryStyle}
                disabled={editSaving}
              >
                {editSaving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => setEditingPartyInvite(null)}
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

const partyFieldsetStyle = {
  border: '1px solid #e5e7eb',
  borderRadius: '4px',
  display: 'grid',
  gap: '10px',
  marginTop: '16px',
  padding: '12px 14px',
}

const partyLegendStyle = {
  color: '#374151',
  fontSize: '13px',
  fontWeight: 700,
  padding: '0 4px',
}

const radioGroupStyle = {
  display: 'flex',
  gap: '16px',
}

const radioLabelStyle = {
  alignItems: 'center',
  display: 'flex',
  fontSize: '14px',
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
  zIndex: 10000,
  pointerEvents: 'auto' as const,
}

const modalStyle = {
  backgroundColor: '#ffffff',
  borderRadius: '6px',
  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
  padding: '24px',
  maxWidth: '400px',
  width: '90%',
  pointerEvents: 'auto' as const,
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
