import type { Guest } from '@/hooks/useGuests'

const CSV_COLUMNS = [
  'id',
  'wedding_id',
  'name',
  'email',
  'phone',
  'relationship',
  'rsvp_status',
  'meal_choice',
  'dietary_restrictions',
  'plus_one_name',
  'plus_one_rsvp',
  'plus_one_dietary',
  'table_number',
  'seat_number',
  'notes',
] as const

type CsvColumn = (typeof CSV_COLUMNS)[number]

function escapeCsvValue(value: string | number | null): string {
  if (value === null) {
    return ''
  }
  const text = String(value)
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

export function guestsToCsv(guests: Guest[]): string {
  const header = CSV_COLUMNS.join(',')
  const rows = guests.map((guest) =>
    CSV_COLUMNS.map((column: CsvColumn) => escapeCsvValue(guest[column])).join(','),
  )
  return [header, ...rows].join('\r\n')
}

export function guestCsvFilename(guest: Guest): string {
  const slug = guest.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `guest-${slug || guest.id}.csv`
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Revoke on the next tick so the browser has started the download.
  setTimeout(() => URL.revokeObjectURL(url), 1_000)
}
