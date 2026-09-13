import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Input } from '@/components/ui/Input'

describe('Input', () => {
  afterEach(cleanup)

  it.each([
    ['without a right element', undefined],
    ['with a simple icon', <span key="icon" aria-hidden="true">⌕</span>],
    ['with a textual action', <span key="action">Ação longa do campo</span>],
  ])('keeps the input in the normal structure %s', (_description, rightElement) => {
    render(<Input label="Busca" value="um valor extenso" onChange={() => undefined} rightElement={rightElement} />)

    const input = screen.getByRole('textbox', { name: 'Busca' })
    expect(input).toHaveValue('um valor extenso')
    expect(input.className).not.toContain('pr-20')
    if (rightElement) {
      expect(input.parentElement?.className).not.toContain('relative')
      expect(input.parentElement?.querySelector('[class*="absolute"]')).not.toBeInTheDocument()
    }
  })

  it('supports a clickable icon button without covering the input value', () => {
    const onClick = vi.fn()
    render(<Input label="Código" value="EX-000000000000" onChange={() => undefined} rightElement={<button type="button" aria-label="Pesquisar" onClick={onClick}>⌕</button>} />)

    fireEvent.click(screen.getByRole('button', { name: 'Pesquisar' }))
    expect(onClick).toHaveBeenCalledOnce()
    expect(screen.getByRole('textbox', { name: 'Código' })).toHaveValue('EX-000000000000')
  })

  it('preserves disabled behavior with a long textual action', () => {
    render(<Input label="Filtro" value="valor longo" onChange={() => undefined} disabled rightElement={<button type="button">Aplicar filtro avançado</button>} />)

    const input = screen.getByRole('textbox', { name: 'Filtro' })
    expect(input).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Aplicar filtro avançado' })).toBeEnabled()
  })

  it('keeps focus available on an enabled input with a right element', () => {
    render(<Input label="Filtro" value="valor" onChange={() => undefined} rightElement={<span>Ação</span>} />)

    const input = screen.getByRole('textbox', { name: 'Filtro' })
    input.focus()
    expect(input).toHaveFocus()
  })
})
