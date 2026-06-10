import { BrowserRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom'

import { Guests } from './pages/Guests'

function Home() {
  return (
    <main style={homeStyle}>
      <h1 style={titleStyle}>Wedding Dashboard</h1>
      <div style={summaryGridStyle}>
        <section style={summaryPanelStyle}>
          <span style={summaryLabelStyle}>Guest Management</span>
          <NavLink style={actionLinkStyle} to="/guests">
            Open Guests
          </NavLink>
        </section>
      </div>
    </main>
  )
}

function App() {
  return (
    <BrowserRouter>
      <div style={appStyle}>
        <nav aria-label="Primary" style={navStyle}>
          <NavLink
            style={({ isActive }) => ({
              ...navLinkStyle,
              ...(isActive ? activeNavLinkStyle : null),
            })}
            to="/"
          >
            Home
          </NavLink>
          <NavLink
            style={({ isActive }) => ({
              ...navLinkStyle,
              ...(isActive ? activeNavLinkStyle : null),
            })}
            to="/guests"
          >
            Guests
          </NavLink>
        </nav>

        <Routes>
          <Route element={<Home />} path="/" />
          <Route element={<Guests />} path="/guests" />
          <Route element={<Navigate replace to="/" />} path="*" />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

const appStyle = {
  color: '#1f2933',
  fontFamily: 'Arial, sans-serif',
  minHeight: '100vh',
}

const navStyle = {
  alignItems: 'center',
  borderBottom: '1px solid #d6d9df',
  display: 'flex',
  gap: '4px',
  minHeight: '52px',
  padding: '0 20px',
}

const navLinkStyle = {
  borderBottomColor: 'transparent',
  borderBottomStyle: 'solid',
  borderBottomWidth: '3px',
  color: '#47505f',
  fontSize: '14px',
  fontWeight: 700,
  padding: '16px 12px 13px',
  textDecoration: 'none',
}

const activeNavLinkStyle = {
  borderBottomColor: '#1f6f5b',
  color: '#1f2933',
}

const homeStyle = {
  display: 'grid',
  gap: '18px',
  padding: '20px',
}

const titleStyle = {
  fontSize: '28px',
  lineHeight: 1.2,
  margin: 0,
}

const summaryGridStyle = {
  display: 'grid',
  gap: '12px',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
}

const summaryPanelStyle = {
  border: '1px solid #d6d9df',
  borderRadius: '6px',
  display: 'grid',
  gap: '12px',
  padding: '16px',
}

const summaryLabelStyle = {
  color: '#586272',
  fontSize: '13px',
  fontWeight: 700,
}

const actionLinkStyle = {
  color: '#1f6f5b',
  fontSize: '16px',
  fontWeight: 700,
}

export default App
