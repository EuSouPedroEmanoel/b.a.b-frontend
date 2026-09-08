import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HomePage } from '@/features/home/HomePage'

const authState = vi.hoisted(() => ({
  user: null as { role: string; name?: string; username?: string } | null,
  loading: false,
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => authState,
}))

function renderHome() {
  return render(<MemoryRouter><HomePage /></MemoryRouter>)
}

describe('HomePage', () => {
  afterEach(cleanup)

  beforeEach(() => {
    authState.loading = false
    authState.user = null
  })

  it('renders the student home without operational shortcuts for a student', () => {
    authState.user = { role: 'student', name: 'Ana' }
    renderHome()

    expect(screen.getByRole('heading', { name: 'Descubra livros' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Como usar' })).not.toBeInTheDocument()
    expect(screen.queryByText('Empréstimos')).not.toBeInTheDocument()
  })

  it.each(['school_admin', 'librarian', 'super_admin'])('preserves the operational home for %s', (role) => {
    authState.user = { role, name: 'Equipe' }
    renderHome()

    expect(screen.getByRole('heading', { name: /Bem-vindo, Equipe/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Empréstimos/ })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Descubra livros' })).not.toBeInTheDocument()
  })

  it('renders the public home without administrative content for a guest', () => {
    authState.user = { role: 'guest', name: 'Visitante' }
    renderHome()

    expect(screen.getByRole('heading', { name: 'Explore o acervo' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver acervo' })).toHaveAttribute('href', '/acervo')
    expect(screen.queryByText('Como usar')).not.toBeInTheDocument()
    expect(screen.queryByText('Empréstimos')).not.toBeInTheDocument()
  })

  it('renders the reader home for a teacher', () => {
    authState.user = { role: 'teacher', name: 'Professor' }
    renderHome()

    expect(screen.getByRole('heading', { name: 'Descubra livros' })).toBeInTheDocument()
    expect(screen.queryByText('Como usar')).not.toBeInTheDocument()
  })

  it('shows the authentication loading state', () => {
    authState.loading = true
    renderHome()

    expect(screen.getByText('Carregando…')).toBeInTheDocument()
  })
})
