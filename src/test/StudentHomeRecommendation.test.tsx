import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StudentHome } from '@/features/home/StudentHome'

const queryState = vi.hoisted(() => ({ data: null as any, isLoading: false, isError: false }))
vi.mock('@tanstack/react-query', () => ({ useQuery: () => queryState }))
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { role: 'student', name: 'Ana' }, loading: false }) }))

const book = (id: number, title: string) => ({
  id, title, description: null, derived_state: 'available', isbn: null,
  cover_url: null, published_date: null, genres: [], authors: [],
})

describe('StudentHome recommendations', () => {
  afterEach(() => { cleanup(); queryState.data = null; queryState.isLoading = false; queryState.isError = false })

  it('renders API carousels and book links', () => {
    queryState.data = { carousels: [{ type: 'recommended', title: 'Recomendados para você', books: [book(1, 'Livro recomendado')] }] }
    render(<MemoryRouter><StudentHome /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'Recomendados para você' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Abrir detalhes de Livro recomendado/ })).toHaveAttribute('href', '/acervo/1')
  })

  it('renders only sections that contain books', () => {
    queryState.data = { carousels: [{ type: 'new', title: 'Novidades da biblioteca', books: [book(2, 'Novidade')] }] }
    render(<MemoryRouter><StudentHome /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'Novidades da biblioteca' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Recomendados para você' })).not.toBeInTheDocument()
  })

  it('shows loading and error states', () => {
    queryState.isLoading = true
    render(<MemoryRouter><StudentHome /></MemoryRouter>)
    expect(screen.getByRole('status')).toBeInTheDocument()
    cleanup()
    queryState.isLoading = false; queryState.isError = true
    render(<MemoryRouter><StudentHome /></MemoryRouter>)
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar suas recomendações')
  })
})
