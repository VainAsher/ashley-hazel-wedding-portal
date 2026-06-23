import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  Activity,
  CalendarDays,
  DollarSign,
  Mail,
  MessageSquare,
  Store,
  Users,
  Wallet,
} from 'lucide-react'
import { fetchCurrentUser, type AuthUser } from '../api/auth'
import { AdminLayout } from '../components/AdminLayout'
import { InviteManagement } from '../components/InviteManagement'
import { Alert } from '../components/ui/alert'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card'

interface AuthState {
  error: string | null
  loading: boolean
  user: AuthUser | null
}

function useAuthState(): AuthState {
  const [state, setState] = useState<AuthState>({
    error: null,
    loading: true,
    user: null,
  })

  useEffect(() => {
    let mounted = true

    async function loadCurrentUser() {
      try {
        const user = await fetchCurrentUser()
        if (mounted) {
          setState({ error: null, loading: false, user })
        }
      } catch (error) {
        if (!mounted) {
          return
        }
        setState({
          error: error instanceof Error ? error.message : 'Unable to load admin session.',
          loading: false,
          user: null,
        })
      }
    }

    void loadCurrentUser()

    return () => {
      mounted = false
    }
  }, [])

  return state
}

// NOTE: All figures below are static placeholders. Real data wiring is
// handled in a later phase once the planning-module APIs land.
interface StatCard {
  icon: typeof Users
  label: string
  value: string
  detail: string
}

const statCards: StatCard[] = [
  {
    icon: Users,
    label: 'RSVP Status',
    value: '0 / 0',
    detail: 'Responses received (placeholder)',
  },
  {
    icon: Wallet,
    label: 'Budget',
    value: '$0',
    detail: 'Spent of $0 planned (placeholder)',
  },
  {
    icon: CalendarDays,
    label: 'Timeline',
    value: '0 events',
    detail: 'Scheduled milestones (placeholder)',
  },
]

interface ActivityItem {
  id: string
  text: string
  time: string
}

const activityItems: ActivityItem[] = [
  { id: 'a1', text: 'Dashboard redesigned with the new design system.', time: 'Just now' },
  { id: 'a2', text: 'Planning modules will be wired up in a later phase.', time: 'Placeholder' },
  { id: 'a3', text: 'Guest and RSVP data sync is coming soon.', time: 'Placeholder' },
]

interface PlanningModule {
  icon: typeof Users
  label: string
  description: string
  href: string
}

// Most module routes are Phase 4 stubs that do not exist yet; until then they
// fall through to the app catch-all route. Guests points to the real route.
const planningModules: PlanningModule[] = [
  { icon: DollarSign, label: 'Budget', description: 'Track spending and payments', href: '/admin/budget' },
  { icon: Users, label: 'Guests', description: 'Manage guest list and RSVPs', href: '/guests' },
  { icon: CalendarDays, label: 'Timeline', description: 'Plan events and milestones', href: '/admin/timeline' },
  { icon: MessageSquare, label: 'Communications', description: 'Send updates to guests', href: '/admin/communications' },
  { icon: Store, label: 'Vendors', description: 'Coordinate with vendors', href: '/admin/vendors' },
  { icon: Mail, label: 'Invitations', description: 'Generate and link invite codes', href: '/admin/invitations' },
]

export function Admin() {
  const { error, loading, user } = useAuthState()

  if (loading) {
    return (
      <main className="grid grid-cols-1 min-h-[calc(100vh-52px)]">
        <div role="status" className="text-[#47505f] text-sm p-5">
          Loading...
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="grid grid-cols-1 min-h-[calc(100vh-52px)]">
        <Alert variant="destructive">{error}</Alert>
      </main>
    )
  }

  if (!user) {
    return <Navigate replace to="/invite" />
  }

  if (user.role === 'guest') {
    return <Navigate replace to="/rsvp" />
  }

  return (
    <AdminLayout title="Admin Dashboard">
      <div className="space-y-8">
        {/* Stat cards */}
        <section aria-label="Overview">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {statCards.map(({ icon: Icon, label, value, detail }) => (
              <Card key={label}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    {label}
                  </CardTitle>
                  <Icon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-gray-900">{value}</p>
                  <p className="text-xs text-gray-500 mt-1">{detail}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Planning modules navigation grid */}
        <section aria-label="Planning Modules">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Planning Modules</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {planningModules.map(({ icon: Icon, label, description, href }) => (
              <Link
                key={label}
                to={href}
                className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <CardTitle className="text-base">{label}</CardTitle>
                    </div>
                    <CardDescription>{description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        {/* Activity feed */}
        <section aria-label="Recent Activity">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y divide-gray-100">
                {activityItems.map((item) => (
                  <li key={item.id} className="flex items-start gap-3 p-4">
                    <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                      <Activity className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-sm text-gray-800">{item.text}</p>
                      <p className="text-xs text-gray-400">{item.time}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>

        {/* Invite management (existing functionality, kept accessible).
            The negative horizontal margin lets InviteManagement's own
            internal padding span edge-to-edge on narrow viewports so its
            grid form does not overflow inside AdminLayout's padded main. */}
        <section aria-label="Invite Management" className="-mx-4 sm:mx-0">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 px-4 sm:px-0">
            Invite Management
          </h2>
          <InviteManagement weddingId={user.wedding_id} />
        </section>
      </div>
    </AdminLayout>
  )
}
