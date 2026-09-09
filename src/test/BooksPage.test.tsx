import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BooksPage } from '@/features/books/BooksPage'

const fixtures = vi.hoisted(() => ({
  get: vi.fn(),
}))

vi.mock('@/lib/api', () => ({ default: { get: fixtures.get } }))
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 1, role: 'librarian' }, loading: false }),
}))
vi.mock('@/components/feedback/LiveRegionContext', () => ({ useAnnouncer: () => vi.fn() }))
vi.mock('@/components/ui/Card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardBody: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
vi.mock('@/components/ui/Button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
}))
vi.mock('@/components/ui/Input', () => ({
  Input: ({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) => <label>{label}<input {...props} /></label>,
}))
vi.mock('@/components/ui/Badge', () => ({ Badge: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => <span {...props}>{children}</span> }))
vi.mock('@/components/ui/Pagination', () => ({ Pagination: () => <nav aria-label="Paginação" /> }))
vi.mock('@/components/ui/PageDescription', () => ({ PageDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p> }))
vi.mock('@/components/ui/Select', () => ({ Select: () => null }))
vi.mock('@/components/ui/OverflowTags', () => ({ OverflowTags: () => <span /> }))
vi.mock('@/components/ui/CoverImage', () => ({ CoverImage: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} /> }))
vi.mock('@/features/books/GridCard', () => ({ GridCard: ({ book }: { book: { id: number } }) => <article data-testid="grid-card">{book.id}</article> }))

let media: { matches: boolean; listeners: Set<(event: MediaQueryListEvent) => void> }

function configureViewport(matches: boolean) {
  media = { matches, listeners: new Set() }
  vi.stubGlobal('matchMedia', () => ({
    get matches() { return media.matches },
    media: '(min-width: 768px)',
    addEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => media.listeners.add(listener),
    removeEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => media.listeners.delete(listener),
  }))
}

function setViewport(matches: boolean) {
  act(() => {
    media.matches = matches
    media.listeners.forEach((listener) => listener({ matches } as MediaQueryListEvent))
  })
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <BooksPage />
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

const book = {
  id: 1,
  title: 'Livro de teste',
  description: null,
  derived_state: 'available',
  isbn: null,
  is_active: true,
  added_by: 1,
  cover_url: null,
  published_date: null,
  created_at: null,
  updated_at: null,
  total_copies: 1,
  available_copies: 1,
  genres: [],
  authors: [],
}

describe('BooksPage responsive result structure', () => {
  beforeEach(() => {
    localStorage.clear()
    configureViewport(true)
    vi.stubGlobal('IntersectionObserver', class { observe() {}; disconnect() {} })
    fixtures.get.mockImplementation((url: string) => {
      if (url.startsWith('/genres/')) return Promise.resolve({ data: { items: [] } })
      return Promise.resolve({ data: { items: [book], total: 1, page: 1, size: 10, pages: 1 } })
    })
  })

  afterEach(() => {
    cleanup()
    fixtures.get.mockReset()
    vi.unstubAllGlobals()
  })

  it('monta apenas a tabela no modo tabela em desktop', async () => {
    renderPage()

    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Lista de livros' })).not.toBeInTheDocument()
  })

  it('monta apenas os cards no modo tabela em mobile e reage ao resize', async () => {
    configureViewport(false)
    renderPage()

    expect(await screen.findByRole('list', { name: 'Lista de livros' })).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()

    setViewport(true)
    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Lista de livros' })).not.toBeInTheDocument()
  })

  it('monta apenas GridCard no modo grade', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Visualização em grade' }))

    expect(await screen.findByTestId('grid-card')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Lista de livros' })).not.toBeInTheDocument()
  })
})
