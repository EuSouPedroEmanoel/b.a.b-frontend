import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { LoansPage } from '@/features/loans/LoansPage'

const fixtures = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  user: { role: 'super_admin', school_id: null },
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: fixtures.user, loading: false }),
}))
vi.mock('@/components/feedback/LiveRegionContext', () => ({
  useAnnouncer: () => vi.fn(),
}))
vi.mock('@/lib/api', () => ({
  default: { get: fixtures.get, post: fixtures.post },
}))

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <LoansPage />
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

describe('LoansPage', () => {
  afterEach(() => {
    cleanup()
    fixtures.get.mockReset()
    fixtures.post.mockReset()
  })

  it('keeps the super admin in read-only mode', async () => {
    fixtures.get.mockResolvedValue({
      data: { items: [], total: 0, page: 1, size: 10, pages: 0 },
    })
    renderPage()

    expect(await screen.findByRole('status')).toHaveTextContent('modo somente leitura')
    expect(screen.queryByRole('button', { name: 'Emprestar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Devolver' })).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Ações' })).not.toBeInTheDocument()
    expect(fixtures.post).not.toHaveBeenCalled()
  })

  it('keeps the quick circulation controls usable on narrow layouts', async () => {
    fixtures.get.mockResolvedValue({
      data: { items: [], total: 0, page: 1, size: 10, pages: 0 },
    })
    fixtures.user.role = 'librarian'
    renderPage()

    const copyInput = await screen.findByLabelText(/Código interno do exemplar/)
    const cpfInput = screen.getByLabelText(/CPF do leitor/)
    const confirm = screen.getByRole('button', { name: 'Confirmar empréstimo' })

    expect(copyInput).toHaveClass('w-full')
    expect(cpfInput).toHaveClass('w-full')
    expect(confirm).toHaveClass('w-full', 'sm:w-auto')
    expect(screen.getByText('Aguardando código do exemplar.')).toBeInTheDocument()
    expect(screen.getByText('Aguardando dados do leitor.')).toBeInTheDocument()
  })

  it('lets the librarian select a matching reader by name', async () => {
    fixtures.user.role = 'librarian'
    fixtures.get.mockImplementation(async (path: string) => {
      if (path === '/copies/') return { data: { items: [{ id: 7, code: 'EX-001', book_id: 2, school_id: 1, state: 'available' }], total: 1 } }
      if (path === '/books/2') return { data: { id: 2, title: 'Livro de teste' } }
      if (path === '/loans/readers') return { data: { items: [
        { id: 10, name: 'Ana Silva', username: 'ana.silva', role: 'student', school_id: 1, is_active: true },
        { id: 11, name: 'Ana Souza', username: 'ana.souza', role: 'student', school_id: 1, is_active: true },
      ], total: 2 } }
      return { data: { items: [], total: 0, page: 1, size: 10, pages: 0 } }
    })
    fixtures.post.mockResolvedValue({ data: { book_title: 'Livro de teste', internal_code: 'EX-001', borrower_username: 'ana.souza' } })
    renderPage()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/Código interno do exemplar/), 'EX-001')
    await screen.findByText('Livro de teste')
    await user.type(screen.getByLabelText(/Nome, usuário ou CPF do leitor/), 'Ana')
    await user.click(await screen.findByRole('button', { name: 'Ana Souza (@ana.souza)' }))
    await user.click(screen.getByRole('button', { name: 'Confirmar empréstimo' }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('ana.souza')
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar empréstimo' }))
    await waitFor(() => expect(fixtures.post).toHaveBeenCalledWith('/loans/', { copy_id: 7, user_id: 11 }))
    expect(fixtures.get).toHaveBeenCalledWith('/loans/readers', expect.objectContaining({ params: expect.objectContaining({ q: 'Ana' }) }))
  })

  it('looks up a reader by CPF when a librarian handles a return', async () => {
    fixtures.user.role = 'librarian'
    fixtures.get.mockImplementation(async (path: string) => {
      if (path === '/loans/readers') return { data: { items: [{ id: 10, username: 'leitor', role: 'student', school_id: 1, is_active: true }], total: 1 } }
      return { data: { items: [], total: 0, page: 1, size: 100, pages: 1 } }
    })
    renderPage()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Operação devolver' }))
    await user.type(screen.getByLabelText(/Código interno do exemplar ou CPF do leitor/), '52998224725')
    expect(await screen.findByText('Este leitor não possui empréstimos ativos.')).toBeInTheDocument()
    expect(fixtures.get).toHaveBeenCalledWith('/loans/readers', expect.objectContaining({ params: expect.objectContaining({ cpf: '52998224725' }) }))
  })
})
