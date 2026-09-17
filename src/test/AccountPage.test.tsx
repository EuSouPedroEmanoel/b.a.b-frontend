import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AccountPage } from '@/features/account/AccountPage'
import { AuthContext, type User } from '@/context/auth-context'

const api = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }))
vi.mock('@/lib/api', () => ({ default: api }))

const student: User = { id: 7, username: 'ana', name: 'Ana Silva', email: 'ana@example.com', role: 'student', school_id: 3, is_active: true }

function renderPage(user: User = student) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><AuthContext.Provider value={{ user, loading: false, isAuthenticated: true, login: vi.fn(), loginGuest: vi.fn(), logout: vi.fn(), refreshUser: vi.fn() }}><MemoryRouter initialEntries={['/perfil']}><AccountPage /></MemoryRouter></AuthContext.Provider></QueryClientProvider>)
}

describe('AccountPage', () => {
  beforeEach(() => { api.get.mockReset() })
  afterEach(cleanup)

  it('renders the authenticated profile and translates its role', async () => {
    api.get.mockResolvedValue({ data: { items: [], total: 0, page: 1, size: 15, pages: 0 } })
    renderPage()
    expect(screen.getByRole('heading', { name: 'Meu perfil' })).toBeInTheDocument()
    expect(screen.getAllByText('Ana Silva')).toHaveLength(2)
    expect(screen.getAllByText('Aluno').length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: 'Editar perfil' })).toHaveAttribute('href', '/perfil/7#perfil')
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/loans/me?page=1&size=15'))
  })

  it('renders current loans and the missing-cover fallback', async () => {
    api.get.mockResolvedValue({ data: { items: [{ id: 1, status: 'active', borrowed_at: '2099-10-01', due_date: '2099-10-20', returned_at: null, book_id: 4, book_title: 'Dom Casmurro', book_cover_url: null, book_details: { id: 4, title: 'Dom Casmurro', description: 'Um clássico brasileiro', derived_state: 'borrowed', isbn: null, cover_url: null, published_date: '1899-01-01', genres: [{ id: 2, name: 'Romance', slug: 'romance' }], authors: [{ id: 3, name: 'Machado de Assis', slug: 'machado-de-assis' }] } }], total: 1, page: 1, size: 15, pages: 1 } })
    renderPage()
    expect(await screen.findByText('Dom Casmurro')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Capa de Dom Casmurro' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /autor Machado de Assis/ })).toHaveAttribute('href', '/acervo/4')
  })

  it('shows an empty state and retries a failed request', async () => {
    api.get.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ data: { items: [], total: 0, page: 1, size: 15, pages: 0 } })
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByText('Você ainda não possui empréstimos no histórico.')).toBeInTheDocument()
    expect(api.get).toHaveBeenCalledTimes(2)
  })

  it('loads the next history page without replacing previous books', async () => {
    const makeLoan = (id: number, title: string) => ({ id, status: 'returned', borrowed_at: '2026-01-01', due_date: '2026-01-15', returned_at: '2026-01-10', book_id: id, book_title: title, book_cover_url: null, book_details: { id, title, description: `Descrição de ${title}`, derived_state: 'available', isbn: null, cover_url: null, published_date: '2020-01-01', genres: [], authors: [] } })
    api.get
      .mockResolvedValueOnce({ data: { items: [makeLoan(1, 'Primeiro livro')], total: 2, page: 1, size: 15, pages: 2 } })
      .mockResolvedValueOnce({ data: { items: [makeLoan(2, 'Segundo livro')], total: 2, page: 2, size: 15, pages: 2 } })
    renderPage()
    expect(await screen.findByText('Primeiro livro')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Carregar mais' }))
    expect(await screen.findByText('Segundo livro')).toBeInTheDocument()
    expect(screen.getByText('Primeiro livro')).toBeInTheDocument()
    expect(api.get).toHaveBeenLastCalledWith('/loans/me?page=2&size=15')
  })

  it('does not request loans for non-students', () => {
    renderPage({ ...student, role: 'librarian' })
    expect(screen.queryByRole('heading', { name: 'Meus livros' })).not.toBeInTheDocument()
    expect(api.get).not.toHaveBeenCalled()
  })
})
