import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ReadingStatusControl } from '@/features/reading/ReadingStatusControl'

const api = vi.hoisted(() => ({ put: vi.fn(), delete: vi.fn() }))
const announce = vi.hoisted(() => vi.fn(() => Promise.resolve()))
vi.mock('@/lib/api', () => ({ default: api }))
vi.mock('@/components/feedback/LiveRegionContext', () => ({ useAnnouncer: () => announce }))

function renderControl(status: 'want_to_read' | 'reading' | 'read' | null = null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ReadingStatusControl bookId={12} status={status} />
    </QueryClientProvider>,
  )
}

describe('ReadingStatusControl', () => {
  afterEach(() => {
    cleanup()
    api.put.mockReset()
    api.delete.mockReset()
    announce.mockClear()
  })

  it('altera e anuncia o estado', async () => {
    api.put.mockResolvedValue({ data: { status: 'reading' } })
    renderControl('want_to_read')
    await userEvent.selectOptions(screen.getByRole('combobox'), 'reading')
    expect(api.put).toHaveBeenCalledWith(
      '/books/12/reading-status',
      { status: 'reading' },
    )
    expect(announce).toHaveBeenCalledWith('Acompanhamento alterado para Lendo.', 'polite')
  })

  it('remove o estado atual', async () => {
    api.delete.mockResolvedValue({})
    renderControl('read')
    await userEvent.selectOptions(screen.getByRole('combobox'), '')
    expect(api.delete).toHaveBeenCalledWith('/books/12/reading-status')
    expect(announce).toHaveBeenCalledWith('Acompanhamento de leitura removido.', 'polite')
  })
})
