import { useEffect, useState } from 'react'

import { fetchCurrentUser, type AuthUser } from '@/api/auth'
import { AdminLayout } from '@/components/AdminLayout'
import { InviteManagement } from '@/components/InviteManagement'
import { Alert } from '@/components/ui/alert'

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

export function Invitations() {
  const { error, loading, user } = useAuthState()

  return (
    <AdminLayout
      title="Invitations"
      breadcrumb={[{ label: 'Dashboard', href: '/admin' }, { label: 'Invitations' }]}
    >
      <div className="grid grid-cols-1 gap-4">
        <section>
          <h2 className="text-xl font-semibold text-gray-900 m-0">Invitations</h2>
          <p className="text-sm text-gray-600 m-0 mt-1">
            Generate and link invite codes for your guests.
          </p>
        </section>

        {loading && (
          <div
            role="status"
            className="text-sm text-gray-600 border border-gray-200 rounded-md p-4"
          >
            Loading invitations...
          </div>
        )}

        {error && !loading && <Alert variant="destructive">{error}</Alert>}

        {!loading && !error && user && (
          <section aria-label="Invite Management">
            <InviteManagement weddingId={user.wedding_id} />
          </section>
        )}
      </div>
    </AdminLayout>
  )
}
