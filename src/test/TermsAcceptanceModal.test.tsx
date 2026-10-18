import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type User } from '@/context/auth-context'
import { TermsAcceptanceModal } from '@/components/privacy/TermsAcceptanceModal'

const announce = vi.fn()
vi.mock('@/components/feedback/LiveRegionContext', () => ({ useAnnouncer: () => announce }))

function renderModal(path = '/') {
  const user: User = {
    id: 1,
    username: 'ana',
    name: 'Ana',
    role: 'student',
    school_id: 1,
    is_active: true,
    terms_accepted_version: null,
    terms_current_version: 'v1',
  }
  const acceptTerms = vi.fn().mockResolvedValue(undefined)
  const logout = vi.fn().mockResolvedValue(undefined)
  render(
    <AuthContext.Provider value={{
      user,
      loading: false,
      isAuthenticated: true,
      login: vi.fn(),
      loginGuest: vi.fn(),
      logout,
      refreshUser: vi.fn(),
      acceptTerms,
    }}>
      <MemoryRouter initialEntries={[path]}>
        <TermsAcceptanceModal />
        <LocationText />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  return { acceptTerms, logout }
}

function LocationText() {
  const location = useLocation()
  return <output>{location.pathname}</output>
}

describe('TermsAcceptanceModal', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('blocks access until the current version is accepted', async () => {
    const { acceptTerms } = renderModal()

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Estou ciente' }))
    await waitFor(() => expect(acceptTerms).toHaveBeenCalledTimes(1))
  })

  it('allows leaving without recording acceptance', async () => {
    const { acceptTerms, logout } = renderModal()

    fireEvent.click(screen.getByRole('button', { name: 'Rejeitar e sair' }))
    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1))
    expect(acceptTerms).not.toHaveBeenCalled()
  })

  it('does not show the modal on the privacy page', () => {
    renderModal('/privacidade')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
