import { useEffect, useState, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { fetchCurrentUser, type AuthUser } from '../api/auth'
import { InviteManagement } from '../components/InviteManagement'

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
      <main style={pageStyle}>
        <div role="status" style={statusStyle}>
          Loading...
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main style={pageStyle}>
        <div role="alert" style={errorStyle}>
          {error}
        </div>
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
    <main style={pageStyle}>
      <header style={headerStyle}>
        <h1 style={titleStyle}>Admin Dashboard</h1>
      </header>
      <InviteManagement weddingId={user.wedding_id} />
    </main>
  )
}

const pageStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr',
  minHeight: 'calc(100vh - 52px)',
}

const headerStyle = {
  borderBottom: '1px solid #d6d9df',
  padding: '20px',
}

const titleStyle = {
  fontSize: '28px',
  fontWeight: 700,
  lineHeight: 1.2,
  margin: 0,
}

const statusStyle = {
  color: '#47505f',
  fontSize: '14px',
  padding: '20px',
}

const errorStyle = {
  background: '#fef2f2',
  border: '1px solid #fecaca',
  borderRadius: '4px',
  color: '#991b1b',
  fontSize: '14px',
  padding: '10px',
}
