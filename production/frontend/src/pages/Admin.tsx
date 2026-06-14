import { useContext } from 'react'
import { AuthContext } from '../context/AuthContext'
import { InviteManagement } from '../components/InviteManagement'

export function Admin() {
  const auth = useContext(AuthContext)
  const weddingId = auth?.session?.wedding_id

  if (!weddingId) {
    return (
      <main style={pageStyle}>
        <section style={panelStyle}>
          <h1 style={titleStyle}>Admin Dashboard</h1>
          <p>Loading...</p>
        </section>
      </main>
    )
  }

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <h1 style={titleStyle}>Admin Dashboard</h1>
      </header>
      <InviteManagement weddingId={weddingId} />
    </main>
  )
}

const pageStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr',
  minHeight: 'calc(100vh - 52px)',
}

const headerStyle = {
  borderBottom: '1px solid #d6d9df',
  padding: '20px',
}

const titleStyle = {
  fontSize: '28px',
  fontWeight: 700,
  lineHeight: 1.2,
  margin: 0,
}

const panelStyle = {
  border: '1px solid #d6d9df',
  borderRadius: '6px',
  display: 'grid',
  gap: '18px',
  maxWidth: '640px',
  padding: '20px',
  width: '100%',
}
