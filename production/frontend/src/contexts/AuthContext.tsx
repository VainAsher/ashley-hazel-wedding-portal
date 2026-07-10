import React, { createContext, useContext, useEffect, useState } from 'react'
import {
  AuthUser,
  AuthApiError,
  loginWithInviteCode,
  fetchCurrentUser,
  logout as logoutApi,
} from '@/api/auth'

interface AuthContextType {
  user: AuthUser | null
  /**
   * Wedding lifecycle phase from the single shared /api/auth/me query.
   * `null` until the user is known (still loading, or not logged in);
   * defaults to 'live' when the API omits it, matching the backend fallback.
   */
  weddingPhase: string | null
  loading: boolean
  error: string | null
  login: (code: string) => Promise<AuthUser>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: React.ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch current user on mount
  useEffect(() => {
    const fetchUser = async () => {
      try {
        setLoading(true)
        setError(null)
        const currentUser = await fetchCurrentUser()
        setUser(currentUser)
      } catch (err) {
        if (err instanceof AuthApiError) {
          // 401/403 is expected when not logged in
          if (err.status === 401 || err.status === 403) {
            setUser(null)
          } else {
            setError(err.message)
          }
        } else {
          setError('An unexpected error occurred')
        }
      } finally {
        setLoading(false)
      }
    }

    fetchUser()
  }, [])

  const login = async (code: string): Promise<AuthUser> => {
    try {
      setLoading(true)
      setError(null)
      const response = await loginWithInviteCode(code)
      setUser(response.user)
      return response.user
    } catch (err) {
      if (err instanceof AuthApiError) {
        setError(err.message)
      } else {
        setError('An unexpected error occurred during login')
      }
      throw err
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    try {
      setLoading(true)
      setError(null)
      await logoutApi()
      setUser(null)
    } catch (err) {
      if (err instanceof AuthApiError) {
        setError(err.message)
      } else {
        setError('An unexpected error occurred during logout')
      }
      throw err
    } finally {
      setLoading(false)
    }
  }

  const weddingPhase = user ? user.wedding_phase ?? 'live' : null

  return (
    <AuthContext.Provider value={{ user, weddingPhase, loading, error, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
