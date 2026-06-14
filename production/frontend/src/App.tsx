import { BrowserRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom'

import { Guests } from './pages/Guests'
import { Invite } from './pages/Invite'
import { RSVP } from './pages/RSVP'

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
            to="/invite"
          >
            Invite
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
          <Route element={<Navigate replace to="/invite" />} path="/" />
          <Route element={<Invite />} path="/invite" />
          <Route element={<RSVP />} path="/rsvp" />
          <Route element={<Guests />} path="/guests" />
          <Route element={<Navigate replace to="/invite" />} path="*" />
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

export default App
