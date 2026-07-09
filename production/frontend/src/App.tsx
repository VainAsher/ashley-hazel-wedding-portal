import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { HomeRedirect, RequireAdmin, RequireGuest } from './components/AuthRoutes'
import { ThemeApplier } from './hooks/useTheme'
import { Admin } from './pages/Admin'
import { Guests } from './pages/Guests'
import { Invite } from './pages/Invite'
import { RSVP } from './pages/RSVP'

// Admin module pages are route-level code-split so they stay out of the main
// bundle until an admin actually navigates to them.
const Invitations = lazy(() =>
  import('./pages/admin/Invitations').then((m) => ({ default: m.Invitations })),
)
const RsvpAdmin = lazy(() =>
  import('./pages/admin/RsvpAdmin').then((m) => ({ default: m.RsvpAdmin })),
)
const Budget = lazy(() =>
  import('./pages/admin/Budget').then((m) => ({ default: m.Budget })),
)
const Events = lazy(() =>
  import('./pages/admin/Events').then((m) => ({ default: m.Events })),
)
const Timeline = lazy(() =>
  import('./pages/admin/Timeline').then((m) => ({ default: m.Timeline })),
)
const Communications = lazy(() =>
  import('./pages/admin/Communications').then((m) => ({ default: m.Communications })),
)
const Vendors = lazy(() =>
  import('./pages/admin/Vendors').then((m) => ({ default: m.Vendors })),
)
const Gallery = lazy(() =>
  import('./pages/admin/Gallery').then((m) => ({ default: m.Gallery })),
)
const Settings = lazy(() =>
  import('./pages/admin/Settings').then((m) => ({ default: m.Settings })),
)
const GuestGallery = lazy(() =>
  import('./pages/Gallery').then((m) => ({ default: m.Gallery })),
)
const Dashboard = lazy(() =>
  import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })),
)
const Schedule = lazy(() =>
  import('./pages/Schedule').then((m) => ({ default: m.Schedule })),
)
const Blessings = lazy(() =>
  import('./pages/Blessings').then((m) => ({ default: m.Blessings })),
)
const AdminBlessings = lazy(() =>
  import('./pages/admin/Blessings').then((m) => ({ default: m.Blessings })),
)

function guestRoute(element: React.ReactNode) {
  return <RequireGuest>{element}</RequireGuest>
}

function adminRoute(element: React.ReactNode) {
  return <RequireAdmin>{element}</RequireAdmin>
}

function App() {
  return (
    <BrowserRouter>
      <ThemeApplier />
      <div style={appStyle}>
        <Suspense
          fallback={
            <div role="status" className="p-5 text-sm text-[#47505f]">
              Loading...
            </div>
          }
        >
          <Routes>
            <Route element={<HomeRedirect />} path="/" />
            <Route element={<Invite />} path="/invite" />
            <Route
              element={
                <RequireGuest>
                  <RSVP />
                </RequireGuest>
              }
              path="/rsvp"
            />
            <Route
              element={
                <RequireGuest>
                  <GuestGallery />
                </RequireGuest>
              }
              path="/gallery"
            />
            <Route element={guestRoute(<Dashboard />)} path="/dashboard" />
            <Route element={guestRoute(<Schedule />)} path="/schedule" />
            <Route element={guestRoute(<Blessings />)} path="/blessings" />
            <Route element={adminRoute(<AdminBlessings />)} path="/admin/blessings" />
            <Route element={adminRoute(<Admin />)} path="/admin" />
            <Route element={adminRoute(<Guests />)} path="/guests" />
            <Route element={adminRoute(<Invitations />)} path="/admin/invitations" />
            <Route element={adminRoute(<RsvpAdmin />)} path="/admin/rsvp" />
            <Route element={adminRoute(<Budget />)} path="/admin/budget" />
            <Route element={adminRoute(<Events />)} path="/admin/events" />
            <Route element={adminRoute(<Timeline />)} path="/admin/timeline" />
            <Route element={adminRoute(<Communications />)} path="/admin/communications" />
            <Route element={adminRoute(<Vendors />)} path="/admin/vendors" />
            <Route element={adminRoute(<Gallery />)} path="/admin/gallery" />
            <Route element={adminRoute(<Settings />)} path="/admin/settings" />
            <Route element={<Navigate replace to="/invite" />} path="*" />
          </Routes>
        </Suspense>
      </div>
    </BrowserRouter>
  )
}

const appStyle = {
  color: '#1f2933',
  fontFamily: 'Arial, sans-serif',
  minHeight: '100vh',
}

export default App
