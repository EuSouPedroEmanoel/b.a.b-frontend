import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SchoolSuggestion } from '@/components/ui/SchoolSuggestion'

describe('SchoolSuggestion', () => {
  it('renders the complete long label with safe wrapping classes', () => {
    const label = 'Escola Estadual Professor João da Silva — Unidade Centro'

    render(
      <SchoolSuggestion
        option={{
          value: 'school-1',
          label,
          data: { name: label },
        }}
      />,
    )

    const suggestion = screen.getByText(label)
    expect(suggestion).toHaveTextContent(label)
    expect(suggestion).toHaveClass('block', 'break-words')
    expect(suggestion).not.toHaveClass('truncate')
  })
})
