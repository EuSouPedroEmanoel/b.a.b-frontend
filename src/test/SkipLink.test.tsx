import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { SkipLink } from '@/components/layout/SkipLink'

describe('SkipLink', () => {
  afterEach(cleanup)

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

  it('is the first focusable element in the post-login layout order', async () => {
    const user = userEvent.setup()
    render(
      <>
        <SkipLink />
        <button type="button">Acervo</button>
        <main id="main-content" tabIndex={-1}>Conteúdo principal</main>
      </>,
    )

    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Pular para o conteúdo principal' }))
  })
})
