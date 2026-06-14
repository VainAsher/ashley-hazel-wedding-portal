export function Admin() {
  return (
    <main style={pageStyle}>
      <section style={panelStyle}>
        <h1 style={titleStyle}>Admin Dashboard</h1>
      </section>
    </main>
  )
}

const pageStyle = {
  display: 'grid',
  minHeight: 'calc(100vh - 52px)',
  padding: '20px',
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

const titleStyle = {
  fontSize: '28px',
  lineHeight: 1.2,
  margin: 0,
}
