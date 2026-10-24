import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AccountPage } from '@/features/account/AccountPage'
import { AuthContext, type User } from '@/context/auth-context'

const api = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }))
vi.mock('@/lib/api', () => ({ default: api }))

const student: User = { id: 7, username: 'ana', name: 'Ana Silva', role: 'student', school_id: 3, is_active: true }
const emptyReadings = { data: { items: [], total: 0, page: 1, size: 15, pages: 0 } }

function renderPage(user: User = student) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><AuthContext.Provider value={{ user, loading: false, isAuthenticated: true, login: vi.fn(), loginGuest: vi.fn(), logout: vi.fn(), refreshUser: vi.fn() }}><MemoryRouter initialEntries={['/perfil']}><AccountPage /></MemoryRouter></AuthContext.Provider></QueryClientProvider>)
}

describe('AccountPage', () => {
  beforeEach(() => { api.get.mockReset() })
  afterEach(cleanup)

  it('renders the authenticated profile and translates its role', async () => {
    api.get.mockImplementation((url: string) => Promise.resolve(url.startsWith('/reading-statuses') ? emptyReadings : emptyReadings))
    renderPage()
    expect(screen.getByRole('heading', { name: 'Meu perfil' })).toBeInTheDocument()
    expect(screen.getAllByText('Ana Silva')).toHaveLength(2)
    expect(screen.getAllByText('Aluno').length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: 'Editar perfil' })).toHaveAttribute('href', '/perfil/7#perfil')
    const statusFilter = screen.getByRole('combobox', { name: 'Acompanhamento' })
    expect(statusFilter.parentElement?.parentElement?.parentElement).toHaveClass('w-full', 'flex-wrap')
    expect(statusFilter.parentElement?.parentElement).toHaveClass('w-44', 'max-w-full', 'shrink-0')
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/reading-statuses/me?page=1&size=15&is_active=true&sort_by=created_at&sort_order=desc'))
  })

  it('does not render a separate loan history section', async () => {
    api.get.mockImplementation((url: string) => Promise.resolve(url.startsWith('/reading-statuses') ? emptyReadings : emptyReadings))
    renderPage()
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Meus livros' })).not.toBeInTheDocument())
    expect(screen.queryByText('Você ainda não possui empréstimos no histórico.')).not.toBeInTheDocument()
  })

  it('does not request loans for non-students', () => {
    renderPage({ ...student, role: 'librarian' })
    expect(screen.queryByRole('heading', { name: 'Meus livros' })).not.toBeInTheDocument()
    expect(api.get).not.toHaveBeenCalled()
  })
})
