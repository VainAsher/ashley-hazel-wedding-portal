import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom'
import { AuthProvider, useAuth } from '../AuthContext'
import * as authApi from '@/api/auth'

// Mock the auth API
vi.mock('@/api/auth')

// Test component that uses useAuth hook
function TestComponent() {
  const { user, loading, error, login, logout } = useAuth()

  return (
    <div>
      <div data-testid="loading">{loading ? 'Loading' : 'Ready'}</div>
      <div data-testid="user">{user ? `${user.name} (${user.role})` : 'No user'}</div>
      <div data-testid="error">{error || 'No error'}</div>
      <button
        data-testid="login-btn"
        onClick={() => login('test-code').catch(() => {})}
      >
        Login
      </button>
      <button
        data-testid="logout-btn"
        onClick={() => logout().catch(() => {})}
      >
        Logout
      </button>
    </div>
  )
}

function renderWithAuth(component: React.ReactNode) {
  return render(
    <AuthProvider>
      {component}
    </AuthProvider>
  )
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch current user on mount', async () => {
    const mockUser = {
      id: 1,
      name: 'John Doe',
      role: 'guest' as const,
      wedding_id: 1,
      invite_id: 1,
      guest_id: 1,
    }

    vi.mocked(authApi.fetchCurrentUser).mockResolvedValueOnce(mockUser)

    renderWithAuth(<TestComponent />)

    expect(screen.getByTestId('loading')).toHaveTextContent('Loading')

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('Ready')
    })

    expect(screen.getByTestId('user')).toHaveTextContent('John Doe (guest)')
  })

  it('should handle 401 error gracefully on mount', async () => {
    const error = new authApi.AuthApiError('Unauthorized', 401)
    vi.mocked(authApi.fetchCurrentUser).mockRejectedValueOnce(error)

    renderWithAuth(<TestComponent />)

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('Ready')
    })

    expect(screen.getByTestId('user')).toHaveTextContent('No user')
    expect(screen.getByTestId('error')).toHaveTextContent('No error')
  })

  it('should login with valid code', async () => {
    const mockUser = {
      id: 2,
      name: 'Jane Doe',
      role: 'guest' as const,
      wedding_id: 1,
      invite_id: 2,
      guest_id: 2,
    }

    vi.mocked(authApi.fetchCurrentUser).mockRejectedValueOnce(
      new authApi.AuthApiError('Unauthorized', 401)
    )

    vi.mocked(authApi.loginWithInviteCode).mockResolvedValueOnce({
      user: mockUser,
    })

    const { getByTestId } = renderWithAuth(<TestComponent />)

    await waitFor(() => {
      expect(getByTestId('loading')).toHaveTextContent('Ready')
    })

    const loginBtn = getByTestId('login-btn')
    loginBtn.click()

    await waitFor(() => {
      expect(getByTestId('user')).toHaveTextContent('Jane Doe (guest)')
    })

    expect(vi.mocked(authApi.loginWithInviteCode)).toHaveBeenCalledWith('test-code')
  })

  it('should set error on login failure', async () => {
    vi.mocked(authApi.fetchCurrentUser).mockRejectedValueOnce(
      new authApi.AuthApiError('Unauthorized', 401)
    )

    const loginError = new authApi.AuthApiError('Invalid invite code', 400)
    vi.mocked(authApi.loginWithInviteCode).mockRejectedValueOnce(loginError)

    const { getByTestId } = renderWithAuth(<TestComponent />)

    await waitFor(() => {
      expect(getByTestId('loading')).toHaveTextContent('Ready')
    })

    const loginBtn = getByTestId('login-btn')
    loginBtn.click()

    await waitFor(() => {
      expect(getByTestId('error')).toHaveTextContent('Invalid invite code')
    })
  })

  it('should logout successfully', async () => {
    const mockUser = {
      id: 1,
      name: 'John Doe',
      role: 'guest' as const,
      wedding_id: 1,
      invite_id: 1,
      guest_id: 1,
    }

    vi.mocked(authApi.fetchCurrentUser).mockResolvedValueOnce(mockUser)
    vi.mocked(authApi.logout).mockResolvedValueOnce(undefined)

    const { getByTestId } = renderWithAuth(<TestComponent />)

    await waitFor(() => {
      expect(getByTestId('user')).toHaveTextContent('John Doe (guest)')
    })

    const logoutBtn = getByTestId('logout-btn')
    logoutBtn.click()

    await waitFor(() => {
      expect(getByTestId('user')).toHaveTextContent('No user')
    })

    expect(vi.mocked(authApi.logout)).toHaveBeenCalled()
  })

  it('should throw error when useAuth is used outside provider', () => {
    const TestComponentOutsideProvider = () => {
      try {
        useAuth()
        return <div>Should not render</div>
      } catch (error) {
        return <div data-testid="error-msg">{String(error)}</div>
      }
    }

    render(<TestComponentOutsideProvider />)

    expect(screen.getByTestId('error-msg')).toHaveTextContent(
      'useAuth must be used within an AuthProvider'
    )
  })
})
