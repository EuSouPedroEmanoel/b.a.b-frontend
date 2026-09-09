import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/context/AuthContext'
import { useAuth } from '@/hooks/useAuth'

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}))

vi.mock('@/lib/api', () => ({ default: api }))

function SessionState() {
  const { loading, user } = useAuth()
  if (loading) return <output>loading</output>
  return <output>{user ? `${user.id}:${user.role}` : 'anonymous'}</output>
}

describe('AuthProvider', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    api.get.mockReset()
    api.post.mockReset()
  })

  afterEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('hydrates an account session from /users/me without listing users', async () => {
    localStorage.setItem('access_token', 'account-token')
    api.get.mockResolvedValue({
      data: {
        id: 7,
        username: 'ana',
        name: 'Ana',
        email: 'ana@example.com',
        role: 'student',
        school_id: 3,
        is_active: true,
        administrative_capabilities: [],
      },
    })

    render(<AuthProvider><SessionState /></AuthProvider>)

    await waitFor(() => expect(screen.getByText('7:student')).toBeInTheDocument())
    expect(api.get).toHaveBeenCalledTimes(1)
    expect(api.get).toHaveBeenCalledWith('/users/me')
  })

  it('does not create a partial user when /users/me fails', async () => {
    localStorage.setItem('access_token', 'account-token')
    api.get.mockRejectedValue(new Error('network error'))

    render(<AuthProvider><SessionState /></AuthProvider>)

    await waitFor(() => expect(screen.getByText('anonymous')).toBeInTheDocument())
    expect(api.get).toHaveBeenCalledWith('/users/me')
  })
})
