const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export type PartyName = 'stag' | 'hen'

export interface PartyAccess {
  stag: boolean
  hen: boolean
}

export interface PartyMember {
  invite_id: number
  name: string
  party_admin: boolean
  party_title: string | null
}

export interface PartyInfo {
  details: string | null
  updated_at: string | null
}

export interface PartyMessage {
  id: number
  author_name: string
  author_invite_id: number
  message: string
  hidden: boolean
  pinned: boolean
  created_at: string
}

export interface PartyRevealBanner {
  subject_invite_id: number
  subject_name: string
  revealed: boolean
}

export interface PartySummary {
  party: PartyName
  is_party_admin: boolean
  info: PartyInfo
  members: PartyMember[]
  messages: PartyMessage[]
  reveal_banner: PartyRevealBanner | null
}

export class PartyApiError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'PartyApiError'
    this.status = status
  }
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  const payload = await response.json().catch(() => null)
  if (payload && typeof payload === 'object' && 'detail' in payload) {
    const detail = (payload as { detail: unknown }).detail
    if (typeof detail === 'string') {
      return detail
    }
  }
  return fallback
}

export async function fetchPartyAccess(apiBaseUrl = API_BASE_URL): Promise<PartyAccess> {
  const response = await fetch(`${apiBaseUrl}/api/party/access`, { credentials: 'include' })
  if (!response.ok) {
    throw new PartyApiError(
      await readErrorMessage(response, 'Unable to load party access.'),
      response.status,
    )
  }
  return response.json() as Promise<PartyAccess>
}

export async function fetchPartySummary(
  party: PartyName,
  apiBaseUrl = API_BASE_URL,
): Promise<PartySummary> {
  const response = await fetch(`${apiBaseUrl}/api/party/${party}/summary`, {
    credentials: 'include',
  })
  if (!response.ok) {
    throw new PartyApiError(
      await readErrorMessage(response, 'Unable to load this party.'),
      response.status,
    )
  }
  return response.json() as Promise<PartySummary>
}

export async function createPartyMessage(
  party: PartyName,
  message: string,
  apiBaseUrl = API_BASE_URL,
): Promise<PartyMessage> {
  const response = await fetch(`${apiBaseUrl}/api/party/${party}/messages`, {
    body: JSON.stringify({ message }),
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })
  if (!response.ok) {
    throw new PartyApiError(
      await readErrorMessage(response, 'Unable to post your message.'),
      response.status,
    )
  }
  return response.json() as Promise<PartyMessage>
}

export async function moderatePartyMessage(
  party: PartyName,
  messageId: number,
  payload: { hidden?: boolean; pinned?: boolean },
  apiBaseUrl = API_BASE_URL,
): Promise<PartyMessage> {
  const response = await fetch(`${apiBaseUrl}/api/party/${party}/messages/${messageId}`, {
    body: JSON.stringify(payload),
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    method: 'PATCH',
  })
  if (!response.ok) {
    throw new PartyApiError(
      await readErrorMessage(response, 'Unable to update this message.'),
      response.status,
    )
  }
  return response.json() as Promise<PartyMessage>
}

export async function updatePartyInfo(
  party: PartyName,
  details: string | null,
  apiBaseUrl = API_BASE_URL,
): Promise<PartyInfo> {
  const response = await fetch(`${apiBaseUrl}/api/party/${party}/info`, {
    body: JSON.stringify({ details }),
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    method: 'PUT',
  })
  if (!response.ok) {
    throw new PartyApiError(
      await readErrorMessage(response, 'Unable to save party details.'),
      response.status,
    )
  }
  return response.json() as Promise<PartyInfo>
}

export async function setPartyReveal(
  party: PartyName,
  inviteId: number,
  revealed: boolean,
  apiBaseUrl = API_BASE_URL,
): Promise<{ party: PartyName; invite_id: number; revealed: boolean }> {
  const response = await fetch(`${apiBaseUrl}/api/party/${party}/reveal`, {
    body: JSON.stringify({ invite_id: inviteId, revealed }),
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    method: 'PATCH',
  })
  if (!response.ok) {
    throw new PartyApiError(
      await readErrorMessage(response, 'Unable to update the reveal.'),
      response.status,
    )
  }
  return response.json() as Promise<{ party: PartyName; invite_id: number; revealed: boolean }>
}
