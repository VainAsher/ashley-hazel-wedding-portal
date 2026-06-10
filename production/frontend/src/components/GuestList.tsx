import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export interface Guest {
  id: number
  wedding_id: number
  name: string
  email: string | null
  phone: string | null
  relationship: string | null
  rsvp_status: 'pending' | 'accepted' | 'declined' | 'tentative'
  dietary_restrictions: string | null
  plus_one_name: string | null
  plus_one_rsvp: 'pending' | 'accepted' | 'declined' | 'tentative' | null
  plus_one_dietary: string | null
  table_number: number | null
  seat_number: number | null
  notes: string | null
  created_at: string | null
  updated_at: string | null
}

interface GuestListProps {
  apiBaseUrl?: string
  onCountChange?: (count: number) => void
}

export interface GuestListHandle {
  refresh: () => Promise<void>
}

function formatValue(value: string | number | null): string {
  if (value === null || value === '') {
    return '-'
  }

  return String(value)
}

export const GuestList = forwardRef<GuestListHandle, GuestListProps>(
  function GuestList({ apiBaseUrl = API_BASE_URL, onCountChange }, ref) {
    const [guests, setGuests] = useState<Guest[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchGuests = useCallback(async () => {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch(`${apiBaseUrl}/api/guests`)
        if (!response.ok) {
          throw new Error(`Failed to load guests (${response.status})`)
        }

        const data = (await response.json()) as Guest[]
        setGuests(data)
        onCountChange?.(data.length)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load guests'
        setError(message)
        onCountChange?.(0)
      } finally {
        setLoading(false)
      }
    }, [apiBaseUrl, onCountChange])

    useImperativeHandle(ref, () => ({ refresh: fetchGuests }), [fetchGuests])

    useEffect(() => {
      void fetchGuests()
    }, [fetchGuests])

    if (loading) {
      return <div style={statusStyle}>Loading guests...</div>
    }

    if (error) {
      return (
        <div role="alert" style={{ ...statusStyle, ...errorStyle }}>
          {error}
        </div>
      )
    }

    if (guests.length === 0) {
      return <div style={statusStyle}>No guests found.</div>
    }

    return (
      <div style={tableWrapStyle}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={headerCellStyle}>Name</th>
              <th style={headerCellStyle}>Email</th>
              <th style={headerCellStyle}>Phone</th>
              <th style={headerCellStyle}>Relationship</th>
              <th style={headerCellStyle}>RSVP</th>
              <th style={headerCellStyle}>Dietary</th>
              <th style={headerCellStyle}>Plus One</th>
              <th style={headerCellStyle}>Plus One RSVP</th>
              <th style={headerCellStyle}>Plus One Dietary</th>
              <th style={headerCellStyle}>Table</th>
              <th style={headerCellStyle}>Seat</th>
              <th style={headerCellStyle}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {guests.map((guest) => (
              <tr key={guest.id}>
                <td style={cellStyle}>{guest.name}</td>
                <td style={cellStyle}>{formatValue(guest.email)}</td>
                <td style={cellStyle}>{formatValue(guest.phone)}</td>
                <td style={cellStyle}>{formatValue(guest.relationship)}</td>
                <td style={cellStyle}>{guest.rsvp_status}</td>
                <td style={cellStyle}>{formatValue(guest.dietary_restrictions)}</td>
                <td style={cellStyle}>{formatValue(guest.plus_one_name)}</td>
                <td style={cellStyle}>{formatValue(guest.plus_one_rsvp)}</td>
                <td style={cellStyle}>{formatValue(guest.plus_one_dietary)}</td>
                <td style={cellStyle}>{formatValue(guest.table_number)}</td>
                <td style={cellStyle}>{formatValue(guest.seat_number)}</td>
                <td style={cellStyle}>{formatValue(guest.notes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  },
)

const statusStyle = {
  border: '1px solid #d6d9df',
  borderRadius: '6px',
  color: '#333',
  padding: '12px 14px',
}

const errorStyle = {
  background: '#fff5f5',
  borderColor: '#d64545',
  color: '#9f1d1d',
}

const tableWrapStyle = {
  overflowX: 'auto',
  width: '100%',
}

const tableStyle = {
  borderCollapse: 'collapse' as const,
  minWidth: '1120px',
  width: '100%',
}

const headerCellStyle = {
  background: '#f4f6f8',
  borderBottom: '2px solid #c8cdd5',
  color: '#1f2933',
  fontSize: '13px',
  fontWeight: 700,
  padding: '10px',
  textAlign: 'left' as const,
  whiteSpace: 'nowrap' as const,
}

const cellStyle = {
  borderBottom: '1px solid #e1e5ea',
  color: '#333',
  fontSize: '14px',
  padding: '10px',
  verticalAlign: 'top' as const,
}
