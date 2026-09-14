import type { ReactNode } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
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

afterEach(() => cleanup())

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

})
