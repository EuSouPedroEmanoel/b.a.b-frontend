import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { Header } from '@/components/layout/Header'

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: {
      id: 0,
      username: 'Visitante',
      email: null,
      cpf_masked: null,
      birthdate: null,
      turma_numero: null,
      turma_letra: null,
      role: 'guest',
      school_id: null,
      school_code: 'ESC-01',
      school_name: 'Escola Central',
      is_active: true,
    },
    logout: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({ resolved: 'light', toggle: vi.fn() }),
}))

vi.mock('@/components/feedback/LiveRegionContext', () => ({
  useAnnouncer: () => vi.fn(),
}))

describe('Guest navigation', () => {
  it('exposes utility context and logout, without conventional account navigation', () => {
    render(
      <MemoryRouter initialEntries={['/acervo']}>
        <Header />
      </MemoryRouter>,
    )

    expect(screen.queryByRole('link', { name: 'Acervo' })).not.toBeInTheDocument()
    expect(screen.getAllByText(/Visitante/).length).toBeGreaterThan(0)
    expect(screen.getAllByLabelText('Visitante na escola Escola Central').length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: 'Trocar escola' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: 'Sair' }).length).toBeGreaterThan(0)
    expect(screen.queryByRole('link', { name: 'Empréstimos' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Reservas' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Usuários' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Escolas' })).not.toBeInTheDocument()
  })
})
