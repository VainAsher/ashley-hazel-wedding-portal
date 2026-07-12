import { useEffect, useState, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'

import { AuthApiError, fetchCurrentUser, type AuthUser } from '../api/auth'

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

        if (error instanceof AuthApiError && error.status === 401) {
          setState({ error: null, loading: false, user: null })
          return
        }

        setState({
          error: error instanceof Error ? error.message : 'Unable to load invite session.',
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

function LoadingRoute() {
  return (
    <main style={pageStyle}>
      <div role="status" style={statusStyle}>
        Loading...
      </div>
    </main>
  )
}

function AuthError({ message }: { message: string }) {
  return (
    <main style={pageStyle}>
      <div role="alert" style={errorStyle}>
        {message}
      </div>
    </main>
  )
}

export function HomeRedirect() {
  const { error, loading, user } = useAuthState()

  if (loading) {
    return <LoadingRoute />
  }

  if (error) {
    return <AuthError message={error} />
  }

  if (!user) {
    return <Navigate replace to="/invite" />
  }

  return <Navigate replace to={user.role === 'guest' ? '/dashboard' : '/admin'} />
}

export function RequireGuest({ children }: { children: ReactNode }) {
  const { error, loading, user } = useAuthState()

  if (loading) {
    return <LoadingRoute />
  }

  if (error) {
    return <AuthError message={error} />
  }

  if (!user) {
    return <Navigate replace to="/invite" />
  }

  if (user.role !== 'guest') {
    return <Navigate replace to="/admin" />
  }

  return <>{children}</>
}

// Wave 3 item 14 D1: party pages are reachable by 'guest' role (regular
// wedding party members) AND 'couple' role (the couple themselves — a
// non-subject partner needs to view their partner's party and reveal it).
// Coordinators never get automatic party content access (see
// docs/specs/PARTY_PORTALS_D1.md), so they're sent to the admin surfaces
// they actually use instead of a guest-chrome page that would just 403.
export function RequireGuestOrCouple({ children }: { children: ReactNode }) {
  const { error, loading, user } = useAuthState()

  if (loading) {
    return <LoadingRoute />
  }

  if (error) {
    return <AuthError message={error} />
  }

  if (!user) {
    return <Navigate replace to="/invite" />
  }

  if (user.role === 'coordinator') {
    return <Navigate replace to="/admin" />
  }

  return <>{children}</>
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { error, loading, user } = useAuthState()

  if (loading) {
    return <LoadingRoute />
  }

  if (error) {
    return <AuthError message={error} />
  }

  if (!user) {
    return <Navigate replace to="/invite" />
  }

  if (user.role === 'guest') {
    return <Navigate replace to="/dashboard" />
  }

  return <>{children}</>
}

const pageStyle = {
  display: 'grid',
  minHeight: 'calc(100vh - 52px)',
  padding: '20px',
}

const statusStyle = {
  color: '#47505f',
  fontSize: '14px',
}

const errorStyle = {
  background: '#fef2f2',
  border: '1px solid #fecaca',
  borderRadius: '4px',
  color: '#991b1b',
  fontSize: '14px',
  maxWidth: '520px',
  padding: '10px',
}
