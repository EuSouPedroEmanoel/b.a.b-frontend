import { cleanup, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
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
})
