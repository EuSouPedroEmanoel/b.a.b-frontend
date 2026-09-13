import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SkipLink } from '@/components/layout/SkipLink'

describe('SkipLink', () => {
  it('keeps the keyboard-accessible link connected to the main content', () => {
    render(
      <>
        <SkipLink />
        <main id="main-content">Conteúdo principal</main>
      </>,
    )

    const link = screen.getByRole('link', { name: 'Pular para o conteúdo principal' })
    expect(link).toHaveAttribute('id', 'skip-link')
    expect(link).toHaveAttribute('href', '#main-content')
    expect(link).toHaveClass('skip-link')
    expect(link).not.toHaveAttribute('tabindex', '-1')
    expect(document.getElementById('main-content')).toBeInTheDocument()
  })
})
