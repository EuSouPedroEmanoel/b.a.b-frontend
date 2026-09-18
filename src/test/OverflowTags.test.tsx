import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { OverflowTags } from '@/components/ui/OverflowTags'

describe('OverflowTags mobile overflow', () => {
  it('renders the hidden genre names in the +1 tooltip trigger', () => {
    const { container } = render(<OverflowTags items={[{ id: 1, name: 'Fantasia' }, { id: 2, name: 'Ficção científica' }]} maxVisibleFallback={1} maxVisible={1} hiddenLabel="gêneros adicionais" />)
    const trigger = screen.getByRole('button', { name: 'Mostrar 1 gêneros adicionais' })
    const tooltip = container.querySelector('[role="tooltip"]')

    expect(trigger).toBeInTheDocument()
    expect(tooltip).toHaveTextContent('Ficção científica')
    expect(tooltip).toHaveClass('opacity-0', 'translate-y-1')
    fireEvent.mouseEnter(trigger)
    expect(tooltip).toHaveClass('opacity-100', 'translate-y-0')
  })

  it('expands the hidden items from a keyboard/touch-sized button and closes on Escape', () => {
    render(<OverflowTags items={[{ id: 1, name: 'Ana' }, { id: 2, name: 'Bia' }, { id: 3, name: 'Caio' }]} maxVisibleFallback={1} hiddenLabel="autores adicionais" />)
    const trigger = screen.getByRole('button', { name: 'Mostrar 2 autores adicionais' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(trigger)
    expect(screen.getByRole('dialog', { name: 'autores adicionais' })).toBeInTheDocument()
    expect(screen.getByText('Caio')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'autores adicionais' })).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })
})
