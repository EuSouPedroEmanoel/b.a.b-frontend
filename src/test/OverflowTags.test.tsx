import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { OverflowTags } from '@/components/ui/OverflowTags'

describe('OverflowTags mobile overflow', () => {
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
