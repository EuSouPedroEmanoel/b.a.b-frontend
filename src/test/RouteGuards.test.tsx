import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AccountOnly, Protected } from '@/app/RouteGuards'

const authState = vi.hoisted(() => ({
  user: null as { role: string } | null,
  loading: false,
  isAuthenticated: false,
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => authState,
}))

function LocationText() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}</output>
}

describe('Guest route guards', () => {
  afterEach(cleanup)

  beforeEach(() => {
    authState.user = { role: 'guest' }
    authState.isAuthenticated = true
    authState.loading = false
  })

  it('allows an authenticated Guest into the catalogue', () => {
    render(
      <MemoryRouter initialEntries={['/acervo']}>
        <Protected><p>Acervo público</p></Protected>
      </MemoryRouter>,
    )

    expect(screen.getByText('Acervo público')).toBeInTheDocument()
  })

  it('redirects a Guest away from account-only routes without rendering protected content', () => {
    render(
      <MemoryRouter initialEntries={['/emprestimos']}>
        <Routes>
          <Route
            path="/emprestimos"
            element={<AccountOnly><p>Empréstimos privados</p></AccountOnly>}
          />
          <Route path="/acervo" element={<LocationText />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.queryByText('Empréstimos privados')).not.toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/acervo')
  })

  it('does not allow an unauthenticated visitor into the catalogue', () => {
    authState.user = null
    authState.isAuthenticated = false

    render(
      <MemoryRouter initialEntries={['/acervo']}>
        <Protected><p>Conteúdo protegido</p></Protected>
        <LocationText />
      </MemoryRouter>,
    )

    expect(screen.queryByText('Conteúdo protegido')).not.toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/entrar')
  })
})
