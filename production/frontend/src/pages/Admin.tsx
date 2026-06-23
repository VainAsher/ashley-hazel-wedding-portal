import { useEffect, useState, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { fetchCurrentUser, type AuthUser } from '../api/auth'
import { InviteManagement } from '../components/InviteManagement'
import { Alert } from '../components/ui/alert'

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
        <Alert variant="destructive">
          {error}
        </Alert>
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
    <main className="grid grid-cols-1 min-h-[calc(100vh-52px)]">
      <header className="border-b border-[#d6d9df] p-5">
        <h1 className="text-2xl font-bold leading-tight m-0">Admin Dashboard</h1>
      </header>
      <InviteManagement weddingId={user.wedding_id} />
    </main>
  )
}
