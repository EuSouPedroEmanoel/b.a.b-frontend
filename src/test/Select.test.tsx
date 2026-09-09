import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Select } from '@/components/ui/Select'

const options = [
  { value: 'all', label: 'Todos' },
  { value: 'available', label: 'Disponível' },
  { value: 'borrowed', label: 'Emprestado' },
]

describe('Select', () => {
  afterEach(cleanup)

  it('opens and navigates options with the keyboard, then returns focus after selection', () => {
    const onChange = vi.fn()
    render(<Select label="Disponibilidade" value="all" options={options} onChange={onChange} />)
    const trigger = screen.getByRole('combobox', { name: 'Disponibilidade' })

    fireEvent.keyDown(trigger, { key: 'Enter' })
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    expect(trigger).toHaveAttribute('aria-activedescendant', expect.stringContaining('option-1'))
    fireEvent.keyDown(trigger, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('available')
    expect(trigger).toHaveFocus()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('wraps with ArrowUp, closes with Escape and supports pointer selection', () => {
    const onChange = vi.fn()
    render(<Select label="Estado" value="all" options={options} onChange={onChange} />)
    const trigger = screen.getByRole('combobox', { name: 'Estado' })

    fireEvent.click(trigger)
    fireEvent.keyDown(trigger, { key: 'ArrowUp' })
    expect(trigger).toHaveAttribute('aria-activedescendant', expect.stringContaining('option-2'))
    fireEvent.keyDown(trigger, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    fireEvent.click(trigger)
    fireEvent.pointerDown(screen.getByRole('option', { name: 'Emprestado' }))
    expect(onChange).toHaveBeenCalledWith('borrowed')
    expect(trigger).toHaveFocus()
  })

  it('does not open when disabled', () => {
    render(<Select label="Estado" value="all" options={options} onChange={() => undefined} disabled />)
    const trigger = screen.getByRole('combobox', { name: 'Estado' })
    expect(trigger).toBeDisabled()
    fireEvent.keyDown(trigger, { key: 'Enter' })
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})
