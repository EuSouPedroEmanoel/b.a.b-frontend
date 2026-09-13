import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Autocomplete, type AutocompleteOption } from '@/components/ui/Autocomplete'

type Item = { name: string }

const options: AutocompleteOption<Item>[] = [
  { value: 'central', label: 'Escola Central', data: { name: 'Escola Central' } },
  { value: 'norte', label: 'Escola Norte', data: { name: 'Escola Norte' } },
]

function ControlledAutocomplete() {
  const [value, setValue] = useState('')
  return <Autocomplete label="Escola" value={value} options={options} onChange={setValue} placeholder="Busque uma escola" />
}

describe('Autocomplete', () => {
  afterEach(cleanup)

  it('filters, navigates with arrows and selects the active option with Enter', () => {
    render(<ControlledAutocomplete />)
    const input = screen.getByRole('combobox', { name: 'Escola' })

    fireEvent.change(input, { target: { value: 'Escola' } })
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    expect(input).toHaveAttribute('aria-activedescendant', expect.stringMatching(/-listbox-option-0$/))

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(input.getAttribute('aria-activedescendant')).toMatch(/-listbox-option-1$/)
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(input.getAttribute('aria-activedescendant')).toMatch(/-listbox-option-0$/)
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(input).toHaveValue('Escola Central')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('activates the first enabled option without selecting it', () => {
    const onChange = vi.fn()
    render(
      <Autocomplete
        label="Escola"
        value=""
        options={[{ ...options[0], disabled: true }, options[1]]}
        onChange={onChange}
      />,
    )
    const input = screen.getByRole('combobox', { name: 'Escola' })

    fireEvent.change(input, { target: { value: 'Escola' } })

    expect(input).toHaveAttribute('aria-activedescendant', expect.stringMatching(/-listbox-option-1$/))
    expect(screen.getByRole('option', { name: 'Escola Norte' })).toHaveClass('bg-slate-100')
    expect(input).toHaveValue('Escola')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('keeps the active option visible while navigating', () => {
    render(<ControlledAutocomplete />)
    const input = screen.getByRole('combobox', { name: 'Escola' })

    fireEvent.change(input, { target: { value: 'Escola' } })
    const listbox = screen.getByRole('listbox')
    const option = screen.getByRole('option', { name: 'Escola Norte' })
    Object.defineProperties(listbox, {
      clientHeight: { configurable: true, value: 40 },
      scrollTop: { configurable: true, writable: true, value: 0 },
    })
    Object.defineProperties(option, {
      offsetTop: { configurable: true, value: 80 },
      offsetHeight: { configurable: true, value: 40 },
    })

    fireEvent.keyDown(input, { key: 'ArrowDown' })

    expect(listbox.scrollTop).toBe(80)
  })

  it('requires two characters before searching, then selects and closes suggestions', () => {
    render(<ControlledAutocomplete />)
    const input = screen.getByRole('combobox', { name: 'Escola' })

    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'E' } })
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Digite pelo menos 2 caracteres')

    fireEvent.change(input, { target: { value: 'Es' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(input).toHaveValue('Escola Central')

    fireEvent.focus(input)
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()

    fireEvent.focus(input)
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('closes suggestions when focus leaves the field with Tab', () => {
    render(
      <div>
        <ControlledAutocomplete />
        <button type="button">Próximo campo</button>
      </div>,
    )
    const input = screen.getByRole('combobox', { name: 'Escola' })

    fireEvent.change(input, { target: { value: 'Escola' } })
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    fireEvent.keyDown(input, { key: 'Tab' })

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('shows an empty state and does not select disabled options', () => {
    render(
      <Autocomplete
        label="Escola"
        value=""
        options={[{ ...options[0], disabled: true }]}
        onChange={() => undefined}
      />,
    )
    const input = screen.getByRole('combobox', { name: 'Escola' })

    fireEvent.focus(input)
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(input).toHaveValue('')

    fireEvent.change(input, { target: { value: 'inexistente' } })
    expect(screen.getByRole('status')).toHaveTextContent('Nenhum resultado encontrado.')
    expect(input).not.toHaveAttribute('aria-activedescendant')

    fireEvent.change(input, { target: { value: 'Escola' } })
    expect(input).not.toHaveAttribute('aria-activedescendant')
  })

  it('restarts the active state when filtering produces a new result set', () => {
    render(<ControlledAutocomplete />)
    const input = screen.getByRole('combobox', { name: 'Escola' })

    fireEvent.change(input, { target: { value: 'Escola' } })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(input).toHaveAttribute('aria-activedescendant', expect.stringMatching(/-listbox-option-1$/))

    fireEvent.change(input, { target: { value: 'Norte' } })

    expect(input).toHaveAttribute('aria-activedescendant', expect.stringMatching(/-listbox-option-0$/))
    expect(screen.getByRole('option', { name: 'Escola Norte' })).toBeInTheDocument()
  })

  it('activates the first valid option again when results reappear', () => {
    render(<ControlledAutocomplete />)
    const input = screen.getByRole('combobox', { name: 'Escola' })

    fireEvent.change(input, { target: { value: 'inexistente' } })
    expect(input).not.toHaveAttribute('aria-activedescendant')

    fireEvent.change(input, { target: { value: 'Escola' } })

    expect(input).toHaveAttribute('aria-activedescendant', expect.stringMatching(/-listbox-option-0$/))
  })
})
