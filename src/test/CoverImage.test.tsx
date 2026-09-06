import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CoverImage } from '@/components/ui/CoverImage'

const props = {
  src: 'https://example.com/book-cover.jpg',
  title: 'Livro de teste',
  alt: 'Capa de Livro de teste',
  width: 320,
  height: 480,
}

afterEach(cleanup)

function coverImage() {
  const image = document.querySelector('img[src*="wsrv.nl"], img[src="https://example.com/book-cover.jpg"]')
  if (!(image instanceof HTMLImageElement)) throw new Error('cover image not found')
  return image
}

function placeholder() {
  return document.querySelector('[data-cover-placeholder="true"]')
}

function fallbackImage() {
  return screen.getByRole('img', { name: props.alt }) as HTMLImageElement
}

describe('CoverImage', () => {
  it('shows only a neutral placeholder while the cover is loading', () => {
    render(<CoverImage {...props} />)

    expect(placeholder()).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: props.alt })).not.toBeInTheDocument()
    expect(coverImage().getAttribute('src')).toContain('wsrv.nl')
    expect(coverImage()).toHaveClass('opacity-0')
  })

  it('reveals the real image after load without changing its reserved dimensions', () => {
    const { container } = render(<CoverImage {...props} />)
    const frame = container.firstElementChild as HTMLElement
    const image = coverImage()

    expect(frame).toHaveClass('relative')
    expect(image).toHaveAttribute('width', '320')
    expect(image).toHaveAttribute('height', '480')

    fireEvent.load(image)

    expect(placeholder()).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: props.alt })).toBeInTheDocument()
    expect(coverImage()).toHaveClass('opacity-100')
    expect(frame).toBe(container.firstElementChild)
  })

  it('uses the definitive fallback only after the direct image also fails', () => {
    render(<CoverImage {...props} />)
    const proxied = coverImage()

    fireEvent.error(proxied)

    const direct = coverImage()
    expect(direct).toHaveAttribute('src', props.src)
    expect(screen.queryByRole('img', { name: props.alt })).not.toBeInTheDocument()

    fireEvent.error(direct)

    expect(fallbackImage()).toBeInTheDocument()
    expect(placeholder()).not.toBeInTheDocument()
    expect(document.querySelector('img[src="https://example.com/book-cover.jpg"]')).toHaveAttribute('aria-hidden', 'true')
  })

  it('renders the fallback immediately when no source exists', () => {
    render(<CoverImage {...props} src={null} />)

    expect(fallbackImage()).toBeInTheDocument()
    expect(placeholder()).not.toBeInTheDocument()
  })

  it('keeps the loading state and image node when rerendered with the same source', () => {
    const { rerender } = render(<CoverImage {...props} />)
    const image = coverImage()

    rerender(<CoverImage {...props} title="Título atualizado" />)

    expect(coverImage()).toBe(image)
    expect(placeholder()).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: props.alt })).not.toBeInTheDocument()
  })
})
