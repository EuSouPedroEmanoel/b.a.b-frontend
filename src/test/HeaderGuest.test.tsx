import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Header } from '@/components/layout/Header'

const authState = vi.hoisted(() => ({
  user: {
    id: 0,
    username: 'Visitante',
    name: 'Visitante',
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
  } as { role: string; [key: string]: unknown },
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: authState.user,
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
  afterEach(cleanup)

  beforeEach(() => {
    authState.user = {
      id: 0,
      username: 'Visitante',
      name: 'Visitante',
      role: 'guest',
      school_name: 'Escola Central',
    }
  })

  it('shows only Home and Catalogue navigation for a Guest', () => {
    render(
      <MemoryRouter initialEntries={['/acervo']}>
        <Header />
      </MemoryRouter>,
    )

    expect(screen.getByRole('navigation', { name: 'Principal' })).toHaveTextContent('Início')
    expect(screen.getByRole('navigation', { name: 'Principal' })).toHaveTextContent('Acervo')
    expect(screen.getByRole('link', { name: 'Início' })).toHaveAttribute('href', '/inicio')
    expect(screen.getByRole('link', { name: 'Acervo' })).toHaveAttribute('href', '/acervo')
    expect(screen.queryByRole('link', { name: 'Empréstimos' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Reservas' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Usuários' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Escolas' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Ver perfil' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Abrir menu' }))
    const mobileNavigation = screen.getByRole('navigation', { name: 'Principal móvel' })
    expect(mobileNavigation).toHaveTextContent('Início')
    expect(mobileNavigation).toHaveTextContent('Acervo')
    expect(mobileNavigation).not.toHaveTextContent('Empréstimos')
    expect(mobileNavigation).not.toHaveTextContent('Reservas')
    expect(mobileNavigation).toHaveTextContent('Visitante · Escola Central')
    expect(mobileNavigation).toHaveTextContent('Trocar escola')
    expect(mobileNavigation).toHaveTextContent('Sair')
    expect(within(mobileNavigation).getByRole('button', { name: 'Trocar escola' })).toBeInTheDocument()
    expect(within(mobileNavigation).getByRole('button', { name: 'Sair' })).toBeInTheDocument()
  })

  it('keeps the internal navigation for a librarian', () => {
    authState.user = {
      id: 3,
      username: 'bibliotecario',
      name: 'Bibliotecário',
      role: 'librarian',
    }
    render(
      <MemoryRouter initialEntries={['/']}>
        <Header />
      </MemoryRouter>,
    )

    const navigation = screen.getByRole('navigation', { name: 'Principal' })
    expect(navigation).toHaveTextContent('Empréstimos')
    expect(navigation).toHaveTextContent('Reservas')
    expect(navigation).toHaveTextContent('Alunos')
  })

  it('offers student management to a school admin', () => {
    authState.user = {
      id: 4,
      username: 'admin-escola',
      name: 'Admin da escola',
      role: 'school_admin',
    }
    render(
      <MemoryRouter initialEntries={['/']}>
        <Header />
      </MemoryRouter>,
    )

    expect(screen.getByRole('navigation', { name: 'Principal' })).toHaveTextContent('Alunos')
  })

  it('keeps the reader navigation and marks the current page discreetly', () => {
    authState.user = {
      id: 5,
      username: 'aluno',
      name: 'Aluno',
      role: 'student',
    }
    render(
      <MemoryRouter initialEntries={['/acervo']}>
        <Header />
      </MemoryRouter>,
    )

    const navigation = screen.getByRole('navigation', { name: 'Principal' })
    expect(navigation).toHaveTextContent('Empréstimos')
    expect(navigation).toHaveTextContent('Reservas')
    expect(screen.getByRole('link', { name: 'Acervo' })).toHaveClass(
      'border-b-2',
      'border-white/80',
      'bg-white/10',
      'font-semibold',
    )
  })
})
