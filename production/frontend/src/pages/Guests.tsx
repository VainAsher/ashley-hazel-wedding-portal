import { useRef, useState } from 'react'

import { GuestForm } from '../components/GuestForm'
import { GuestList, type GuestListHandle } from '../components/GuestList'

export function Guests() {
  const listRef = useRef<GuestListHandle>(null)
  const [showForm, setShowForm] = useState(false)
  const [guestCount, setGuestCount] = useState(0)

  const handleGuestCreated = () => {
    setShowForm(false)
    void listRef.current?.refresh()
  }

  return (
    <main style={pageStyle}>
      <section style={headerStyle}>
        <div>
          <h1 style={titleStyle}>Guest Management</h1>
          <p style={metaStyle}>{guestCount} guests</p>
        </div>

        <button
          onClick={() => setShowForm((current) => !current)}
          style={showForm ? secondaryButtonStyle : primaryButtonStyle}
          type="button"
        >
          {showForm ? 'Cancel' : 'Add Guest'}
        </button>
      </section>

      {showForm && (
        <section style={sectionStyle}>
          <GuestForm onSuccess={handleGuestCreated} />
        </section>
      )}

      <section style={sectionStyle}>
        <GuestList ref={listRef} onCountChange={setGuestCount} />
      </section>
    </main>
  )
}

const pageStyle = {
  display: 'grid',
  gap: '18px',
  padding: '20px',
}

const headerStyle = {
  alignItems: 'center',
  display: 'flex',
  gap: '14px',
  justifyContent: 'space-between',
}

const titleStyle = {
  color: '#1f2933',
  fontSize: '28px',
  lineHeight: 1.2,
  margin: 0,
}

const metaStyle = {
  color: '#586272',
  fontSize: '14px',
  margin: '4px 0 0',
}

const sectionStyle = {
  minWidth: 0,
}

const primaryButtonStyle = {
  background: '#1f6f5b',
  border: '1px solid #1f6f5b',
  borderRadius: '4px',
  color: '#fff',
  cursor: 'pointer',
  font: 'inherit',
  fontWeight: 700,
  padding: '10px 14px',
  whiteSpace: 'nowrap' as const,
}

const secondaryButtonStyle = {
  ...primaryButtonStyle,
  background: '#fff',
  color: '#1f6f5b',
}
