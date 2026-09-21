import type { ReactNode } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { GridCard } from '@/features/books/GridCard'

vi.mock('@/hooks/useAverageColor', () => ({
  useAverageColor: () => ({ rgba: null, darkColor: null }),
}))
vi.mock('@/lib/imageProxy', () => ({ getCoverProxyUrl: () => null }))
vi.mock('@/components/ui/CoverImage', () => ({
  CoverImage: ({ alt, title }: { alt?: string; title?: string }) => <img alt={alt} title={title} />,
}))
vi.mock('@/components/ui/OverflowTags', () => ({ OverflowTags: () => <span /> }))
vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  motion: { div: ({ children, ...props }: { children: ReactNode } & Record<string, unknown>) => <div {...props}>{children}</div> },
}))

const longTitle = 'Introdução à Engenharia de Software — fundamentos, práticas e projetos avançados'
const longDescription = 'Uma descrição longa para validar que o resumo do preview permanece legível, limitado e sem criar uma região de rolagem interna no card.'

const book = {
  id: 1,
  title: longTitle,
  description: null,
  derived_state: 'available',
  isbn: null,
  cover_url: null,
  published_date: null,
  genres: [],
  authors: [],
  total_copies: 1,
  available_copies: 1,
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('GridCard title identification', () => {
  it('keeps the full title accessible while showing three lines in the resting card', () => {
    render(
      <MemoryRouter>
        <GridCard book={book} disableHover />
      </MemoryRouter>,
    )

    const link = screen.getByRole('link', { name: `Abrir detalhes de ${longTitle}, autor desconhecido` })
    expect(link).toHaveAccessibleName(`Abrir detalhes de ${longTitle}, autor desconhecido`)

    const title = screen.getByRole('heading', { name: longTitle })
    expect(title).toHaveClass('line-clamp-3')
    expect(title).not.toHaveClass('line-clamp-2')
  })

  it('closes the portal preview when the page scrolls', async () => {
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      disconnect() {}
    })
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      bottom: 600,
      height: 300,
      left: 400,
      right: 600,
      top: 300,
      width: 200,
      x: 400,
      y: 300,
      toJSON: () => ({}),
    } as DOMRect)
    render(
      <MemoryRouter>
        <GridCard book={book} portalHover />
      </MemoryRouter>,
    )

    const link = screen.getByRole('link', { name: `Abrir detalhes de ${longTitle}, autor desconhecido` })
    fireEvent.mouseEnter(link.parentElement!)
    const preview = document.body.querySelector<HTMLElement>('[style*="position: fixed"]')
    expect(preview).toHaveStyle({ left: '375px', top: '262.5px' })

    fireEvent.scroll(window)
    await waitFor(() => expect(document.body.querySelector('[style*="position: fixed"]')).not.toBeInTheDocument())
  })

  it('limits the preview description without an internal scroll region', () => {
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      disconnect() {}
    })
    render(
      <MemoryRouter>
        <GridCard book={{ ...book, description: longDescription }} />
      </MemoryRouter>,
    )

    const description = screen.getByText(longDescription, { selector: 'p' })
    expect(description).toHaveClass('line-clamp-3')
    expect(screen.getAllByRole('tooltip', { hidden: true }).find((tooltip) => tooltip.textContent === longDescription)).toBeTruthy()
    expect(description.parentElement?.parentElement).not.toHaveClass('overflow-y-auto')
    expect(description.closest('a')).not.toHaveClass('overflow-y-auto')
  })

})
