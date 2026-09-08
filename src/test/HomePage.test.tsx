import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HomePage } from '@/features/home/HomePage'
import { StudentHome } from '@/features/home/StudentHome'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const authState = vi.hoisted(() => ({
  user: null as { role: string; name?: string; username?: string } | null,
  loading: false,
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => authState,
}))
vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: { carousels: [] }, isLoading: false, isError: false }),
  QueryClient: class {},
  QueryClientProvider: ({ children }: { children: unknown }) => children,
}))

function renderHome() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}><MemoryRouter><Routes><Route path="/" element={<HomePage />} /><Route path="/inicio" element={<StudentHome />} /></Routes></MemoryRouter></QueryClientProvider>)
}

describe('HomePage', () => {
  afterEach(cleanup)

  beforeEach(() => {
    authState.loading = false
    authState.user = null
  })

  it('renders the student discovery home with a welcome name and vertical sections', () => {
    authState.user = { role: 'student', name: 'Ana' }
    renderHome()

    expect(screen.getByRole('heading', { name: 'Bem-vindo, Ana' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Recomendados para você' })).not.toBeInTheDocument()
    expect(document.querySelectorAll('.home-discovery-section')).toHaveLength(0)
    expect(screen.getByRole('link', { name: 'Explorar acervo' })).toHaveAttribute('href', '/acervo')
    expect(screen.queryByText('Mais novidades em breve')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Como usar' })).not.toBeInTheDocument()
    expect(screen.queryByText('Empréstimos')).not.toBeInTheDocument()
  })

  it('uses a generic welcome when a student name is unavailable', () => {
    authState.user = { role: 'student' }
    renderHome()

    expect(screen.getByRole('heading', { name: 'Bem-vindo' })).toBeInTheDocument()
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

    expect(screen.queryByRole('heading', { name: 'Recomendados para você' })).not.toBeInTheDocument()
    expect(screen.queryByText('Como usar')).not.toBeInTheDocument()
  })

  it('shows the authentication loading state', () => {
    authState.loading = true
    renderHome()

    expect(screen.getByText('Carregando…')).toBeInTheDocument()
  })
})
