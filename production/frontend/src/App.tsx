import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'

import { HomeRedirect, RequireAdmin, RequireGuest, RequireGuestOrCouple } from './components/AuthRoutes'
import { GuestLayout } from './components/GuestLayout'
import { ThemeApplier } from './hooks/useTheme'
import { Admin } from './pages/Admin'
import { Guests } from './pages/Guests'
import { Invite } from './pages/Invite'
import { RSVPContent } from './pages/RSVP'

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
const DashboardContent = lazy(() =>
  import('./pages/Dashboard').then((m) => ({ default: m.DashboardContent })),
)
const ScheduleContent = lazy(() =>
  import('./pages/Schedule').then((m) => ({ default: m.ScheduleContent })),
)
const BlessingsContent = lazy(() =>
  import('./pages/Blessings').then((m) => ({ default: m.BlessingsContent })),
)
const AdminBlessings = lazy(() =>
  import('./pages/admin/Blessings').then((m) => ({ default: m.Blessings })),
)
const Music = lazy(() =>
  import('./pages/Music').then((m) => ({ default: m.Music })),
)
const AdminMusic = lazy(() =>
  import('./pages/admin/Music').then((m) => ({ default: m.Music })),
)
const AdminFeedback = lazy(() =>
  import('./pages/admin/Feedback').then((m) => ({ default: m.Feedback })),
)
const Party = lazy(() => import('./pages/Party').then((m) => ({ default: m.Party })))
const WeddingParty = lazy(() =>
  import('./pages/WeddingParty').then((m) => ({ default: m.WeddingParty })),
)

function guestRoute(element: React.ReactNode) {
  return <RequireGuest>{element}</RequireGuest>
}

function adminRoute(element: React.ReactNode) {
  return <RequireAdmin>{element}</RequireAdmin>
}

// Wave 4 item 17 Phase 1 (docs/specs/VIEWPORT_PAGING_PHASE1.md): Dashboard,
// RSVP, Schedule, and Blessings share ONE persistent GuestLayout instance via
// this layout route, rather than each independently wrapping GuestLayout.
// This matters even in scroll mode: React Router unmounts and remounts
// whatever a route renders whenever the matched Route *element* changes, so
// four separate top-level routes (the old shape) would tear down and rebuild
// GuestLayout -- and with it, PagedGuestDeck's whole scroll position and
// mounted-slide state -- on every navigate() between them. Nesting these 4
// routes under one shared layout route means only the <Outlet/> content
// swaps; GuestLayout (and the deck it renders in paged mode) never remounts.
function PagedGuestLayoutRoute() {
  return (
    <RequireGuest>
      <GuestLayout>
        <Outlet />
      </GuestLayout>
    </RequireGuest>
  )
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
            <Route element={<PagedGuestLayoutRoute />}>
              <Route element={<DashboardContent />} path="/dashboard" />
              <Route element={<RSVPContent />} path="/rsvp" />
              <Route element={<ScheduleContent />} path="/schedule" />
              <Route element={<BlessingsContent />} path="/blessings" />
            </Route>
            <Route
              element={
                <RequireGuest>
                  <GuestGallery />
                </RequireGuest>
              }
              path="/gallery"
            />
            <Route element={guestRoute(<Music />)} path="/music" />
            <Route element={guestRoute(<WeddingParty />)} path="/wedding-party" />
            <Route
              element={
                <RequireGuestOrCouple>
                  <Party />
                </RequireGuestOrCouple>
              }
              path="/party/:party"
            />
            <Route element={adminRoute(<AdminBlessings />)} path="/admin/blessings" />
            <Route element={adminRoute(<AdminMusic />)} path="/admin/music" />
            <Route element={adminRoute(<AdminFeedback />)} path="/admin/feedback" />
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
