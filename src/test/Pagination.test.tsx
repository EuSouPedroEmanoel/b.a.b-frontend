import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Pagination } from '@/components/ui/Pagination'

describe('Pagination', () => {
  afterEach(cleanup)

  it('offers a compact mobile representation with the current page and previous/next controls', () => {
    const onChange = vi.fn()
    render(<Pagination page={7} pages={24} total={240} onChange={onChange} />)

    expect(screen.getByText('Página 7 de 24')).toHaveAttribute('aria-current', 'page')
    fireEvent.click(screen.getAllByRole('button', { name: 'Página anterior' })[0])
    fireEvent.click(screen.getAllByRole('button', { name: 'Próxima página' })[0])
    expect(onChange).toHaveBeenNthCalledWith(1, 6)
    expect(onChange).toHaveBeenNthCalledWith(2, 8)
  })

  it('keeps disabled states at the first and last pages', () => {
    const onChange = vi.fn()
    const { rerender } = render(<Pagination page={1} pages={24} total={240} onChange={onChange} />)

    expect(screen.getAllByRole('button', { name: 'Página anterior' })[0]).toBeDisabled()
    expect(screen.getAllByRole('button', { name: 'Próxima página' })[0]).toBeEnabled()

    rerender(<Pagination page={24} pages={24} total={240} onChange={onChange} />)
    expect(screen.getAllByRole('button', { name: 'Página anterior' })[0]).toBeEnabled()
    expect(screen.getAllByRole('button', { name: 'Próxima página' })[0]).toBeDisabled()
  })

  it('does not render when there is only one page', () => {
    const { container } = render(<Pagination page={1} pages={1} total={1} onChange={() => undefined} />)
    expect(container).toBeEmptyDOMElement()
  })
})
