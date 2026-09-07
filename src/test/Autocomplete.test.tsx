import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
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

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(input.getAttribute('aria-activedescendant')).toMatch(/-listbox-option-0$/)
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(input).toHaveValue('Escola Norte')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
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
  })
})
