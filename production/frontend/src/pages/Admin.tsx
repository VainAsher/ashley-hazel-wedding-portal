import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  CalendarDays,
  DollarSign,
  Mail,
  MessageSquare,
  Store,
  Users,
  Wallet,
} from 'lucide-react'
import { fetchCurrentUser, type AuthUser } from '../api/auth'
import { useGuests } from '../hooks/useGuests'
import { useBudgetSummary } from '../hooks/useBudget'
import { useEvents } from '../hooks/useEvents'
import { formatCurrency } from '../lib/format'
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

interface StatCard {
  icon: typeof Users
  label: string
  value: string
  detail: string
}

interface PlanningModule {
  icon: typeof Users
  label: string
  description: string
  href: string
}

// These link to the admin module routes registered in App.tsx. The module
// pages are functional skeletons; their data APIs are stubbed pending backend
// wiring. Guests points to the real /guests route.
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
  const { data: guests } = useGuests()
  const { data: budget } = useBudgetSummary()
  const { data: events } = useEvents()

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

  const guestList = guests ?? []
  const acceptedCount = guestList.filter((g) => g.rsvp_status === 'accepted').length
  const eventCount = (events ?? []).length

  const statCards: StatCard[] = [
    {
      icon: Users,
      label: 'RSVP Status',
      value: `${acceptedCount} / ${guestList.length}`,
      detail: 'Guests accepted',
    },
    {
      icon: Wallet,
      label: 'Budget',
      value: formatCurrency(budget?.total_paid),
      detail: `Spent of ${formatCurrency(budget?.total_estimated)} planned`,
    },
    {
      icon: CalendarDays,
      label: 'Events',
      value: `${eventCount} ${eventCount === 1 ? 'event' : 'events'}`,
      detail: 'Scheduled events',
    },
  ]

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
                className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-plum">
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
