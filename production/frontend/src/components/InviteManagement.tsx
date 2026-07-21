import { useState, useEffect, type FormEvent } from 'react'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

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

// Native <select> elements (not the shadcn Select) — the coordinator/couple
// role, guest, and party pickers here are exercised by Playwright's
// selectOption(), which only works against a real <select>. Styled to match
// Input's look regardless.
const NATIVE_SELECT_CLASS =
  'flex h-10 w-full max-w-xs rounded-md border border-input bg-white px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm'

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

  const [inviteToDelete, setInviteToDelete] = useState<Invite | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

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
      const res = await fetch(`/api/invites/${linkingInviteId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guest_id: linkingGuestId }),
      })

      if (!res.ok) throw new Error('Failed to link guest')

      const updated = await res.json()
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

  const requestDelete = (invite: Invite) => {
    setError(null)
    setDeleteError(null)
    setInviteToDelete(invite)
  }

  const cancelDelete = () => {
    setInviteToDelete(null)
    setDeleteError(null)
  }

  const confirmDeleteInvite = async () => {
    if (!inviteToDelete) return
    setDeleting(true)
    setDeleteError(null)

    try {
      const res = await fetch(`/api/invites/${inviteToDelete.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!res.ok) throw new Error('Failed to delete invite')

      setInvites((current) => current.filter((i) => i.id !== inviteToDelete.id))
      setSuccess('Invite deleted')
      setInviteToDelete(null)

      // Auto-clear success message after 3 seconds
      setTimeout(() => {
        setSuccess(null)
      }, 3000)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Error deleting invite')
    } finally {
      setDeleting(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setSuccess(`Copied: ${text}`)
  }

  const getUnlinkedGuests = () =>
    guests.filter((g) => !invites.some((i) => i.guest_id === g.id))

  return (
    <div className="grid gap-6">
      {error && <Alert variant="destructive">{error}</Alert>}
      {success && (
        <Alert variant="success" role="status" aria-live="polite">
          {success}
        </Alert>
      )}

      {/* Generate Invite Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Generate New Invite</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <form onSubmit={generateInvite} className="flex flex-wrap items-end gap-3">
            <div className="grid gap-2">
              <Label htmlFor="role-select">Role</Label>
              <select
                id="role-select"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className={NATIVE_SELECT_CLASS}
                disabled={generating}
              >
                <option value="guest">Guest</option>
                <option value="coordinator">Coordinator</option>
                <option value="couple">Couple</option>
              </select>
            </div>
            <Button type="submit" disabled={generating}>
              {generating ? 'Generating...' : 'Generate Code'}
            </Button>
          </form>

          {/* Wave 3 item 14 D1: guest "wedding party" flags. */}
          {role === 'guest' && (
            <fieldset className="grid gap-3 rounded-md border border-gray-200 p-4">
              <legend className="px-1 text-xs font-semibold text-gray-700">
                Wedding party (optional)
              </legend>
              <div className="flex gap-4" role="radiogroup" aria-label="Wedding party">
                {(['none', 'stag', 'hen'] as const).map((value) => (
                  <label key={value} className="flex items-center gap-1.5 text-sm">
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
                  <label className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={partyAdmin}
                      disabled={atCapacity && !partyAdmin}
                      onChange={(e) => setPartyAdmin(e.target.checked)}
                    />
                    {`Make this guest a ${PARTY_ADMIN_TITLE[party]}`}
                    {atCapacity && !partyAdmin && (
                      <span className="italic text-gray-500">
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
            <fieldset className="grid gap-3 rounded-md border border-gray-200 p-4">
              <legend className="px-1 text-xs font-semibold text-gray-700">
                Individual identity (optional)
              </legend>
              <div className="grid gap-2">
                <Label htmlFor="partner-label-input">Partner label</Label>
                <Input
                  id="partner-label-input"
                  type="text"
                  value={partnerLabel}
                  onChange={(e) => setPartnerLabel(e.target.value)}
                  placeholder="e.g. Ashley"
                  className="max-w-xs"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="associated-party-select">Their own party</Label>
                <select
                  id="associated-party-select"
                  value={associatedParty}
                  onChange={(e) => setAssociatedParty(e.target.value as 'none' | 'stag' | 'hen')}
                  className={NATIVE_SELECT_CLASS}
                >
                  <option value="none">None</option>
                  <option value="stag">Stag Do</option>
                  <option value="hen">Hen Do</option>
                </select>
              </div>
            </fieldset>
          )}
        </CardContent>
      </Card>

      {/* Invites List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Invites ({invites.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-gray-600">Loading invites...</p>
          ) : invites.length === 0 ? (
            <p className="text-sm text-gray-600">No invites yet</p>
          ) : (
            <div className="rounded-md border border-gray-200">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Guest</TableHead>
                    <TableHead>Wedding Party</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invites.map((invite) => {
                    const linkedGuest = guests.find((g) => g.id === invite.guest_id)
                    return (
                      <TableRow key={invite.id}>
                        <TableCell>
                          <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs">
                            {invite.code}
                          </code>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="ml-1 h-8 w-8"
                            onClick={() => copyToClipboard(invite.code)}
                            title="Copy to clipboard"
                          >
                            📋
                          </Button>
                        </TableCell>
                        <TableCell>{invite.role}</TableCell>
                        <TableCell>
                          {linkedGuest ? (
                            <span>{linkedGuest.name}</span>
                          ) : invite.household_name ? (
                            <span className="italic text-gray-500">{invite.household_name}</span>
                          ) : (
                            <span className="italic text-gray-500">Unlinked</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {invite.role === 'guest' && invite.party && (
                            <span>
                              {invite.party === 'stag' ? 'Stag Do' : 'Hen Do'}
                              {invite.party_admin && (
                                <span className="italic text-gray-500">
                                  {' '}
                                  ({invite.party_title || PARTY_ADMIN_TITLE[invite.party]})
                                </span>
                              )}
                            </span>
                          )}
                          {invite.role === 'couple' && invite.associated_party && (
                            <span className="italic text-gray-500">
                              {invite.partner_label ? `${invite.partner_label} — ` : ''}
                              {invite.associated_party === 'stag' ? 'Stag Do' : 'Hen Do'}
                            </span>
                          )}
                          {((invite.role === 'guest' && !invite.party) ||
                            (invite.role === 'couple' && !invite.associated_party)) && (
                            <span className="italic text-gray-500">—</span>
                          )}
                        </TableCell>
                        <TableCell>{new Date(invite.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {!linkedGuest && getUnlinkedGuests().length > 0 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => {
                                  setLinkingInviteId(invite.id)
                                  setLinkingGuestId(null)
                                }}
                                title="Link to guest"
                              >
                                🔗
                              </Button>
                            )}
                            {(invite.role === 'guest' || invite.role === 'couple') && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openPartyEditor(invite)}
                                title="Edit wedding party details"
                              >
                                🎉
                              </Button>
                            )}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-800 hover:text-red-800"
                              onClick={() => requestDelete(invite)}
                              title="Delete invite"
                            >
                              🗑️
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Link Guest dialog */}
      <Dialog
        open={linkingInviteId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setLinkingInviteId(null)
            setLinkingGuestId(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Guest to Invite</DialogTitle>
          </DialogHeader>

          <div className="grid gap-2">
            <Label htmlFor="guest-select">Select Guest</Label>
            <select
              id="guest-select"
              value={linkingGuestId ?? ''}
              onChange={(e) => setLinkingGuestId(parseInt(e.target.value))}
              className={NATIVE_SELECT_CLASS}
            >
              <option value="">Choose a guest...</option>
              {getUnlinkedGuests().map((guest) => (
                <option key={guest.id} value={guest.id}>
                  {guest.name} {guest.email && `(${guest.email})`}
                </option>
              ))}
            </select>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setLinkingInviteId(null)
                setLinkingGuestId(null)
              }}
            >
              Cancel
            </Button>
            <Button type="button" onClick={() => void linkGuestToInvite()} disabled={!linkingGuestId}>
              Link Guest
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Wedding Party Editor dialog (Wave 3 item 14 D1) */}
      <Dialog
        open={editingPartyInvite !== null}
        onOpenChange={(open) => (!open ? setEditingPartyInvite(null) : undefined)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Wedding Party Details</DialogTitle>
          </DialogHeader>

          {editingPartyInvite?.role === 'guest' ? (
            <>
              <div className="flex gap-4" role="radiogroup" aria-label="Wedding party">
                {(['none', 'stag', 'hen'] as const).map((value) => (
                  <label key={value} className="flex items-center gap-1.5 text-sm">
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
              {editParty !== 'none' && editingPartyInvite && (() => {
                const holders = currentPartyAdmins(editParty).filter(
                  (h) => h.id !== editingPartyInvite.id,
                )
                const atCapacity = holders.length >= MAX_PARTY_ADMINS_PER_PARTY
                return (
                  <label className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={editPartyAdmin}
                      disabled={atCapacity && !editPartyAdmin}
                      onChange={(e) => setEditPartyAdmin(e.target.checked)}
                    />
                    {`Make this guest a ${PARTY_ADMIN_TITLE[editParty]}`}
                    {atCapacity && !editPartyAdmin && (
                      <span className="italic text-gray-500">
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
              <div className="grid gap-2">
                <Label htmlFor="edit-partner-label-input">Partner label</Label>
                <Input
                  id="edit-partner-label-input"
                  type="text"
                  value={editPartnerLabel}
                  onChange={(e) => setEditPartnerLabel(e.target.value)}
                  placeholder="e.g. Ashley"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-associated-party-select">Their own party</Label>
                <select
                  id="edit-associated-party-select"
                  value={editAssociatedParty}
                  onChange={(e) =>
                    setEditAssociatedParty(e.target.value as 'none' | 'stag' | 'hen')
                  }
                  className={NATIVE_SELECT_CLASS}
                >
                  <option value="none">None</option>
                  <option value="stag">Stag Do</option>
                  <option value="hen">Hen Do</option>
                </select>
              </div>
            </>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setEditingPartyInvite(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void savePartyEdits()} disabled={editSaving}>
              {editSaving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog
        open={inviteToDelete !== null}
        onOpenChange={(open) => (!open ? cancelDelete() : undefined)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Invite</DialogTitle>
            <DialogDescription>
              {inviteToDelete
                ? `Delete invite code ${inviteToDelete.code}? This action cannot be undone.`
                : 'Delete this invite?'}
            </DialogDescription>
          </DialogHeader>

          {deleteError && <Alert variant="destructive">{deleteError}</Alert>}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={cancelDelete} disabled={deleting}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void confirmDeleteInvite()}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
