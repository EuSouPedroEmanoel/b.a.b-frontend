import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { Tooltip } from '@/components/ui/Tooltip'

describe('Tooltip', () => {
  afterEach(cleanup)

  it('renders long content with wrapping and a safe maximum size', () => {
    render(
      <span className="group relative">
        <button type="button">Ajuda</button>
        <Tooltip id="help-tooltip">Texto longo que precisa se adaptar ao espaço disponível.</Tooltip>
      </span>,
    )

    const tooltip = screen.getByRole('tooltip')
    expect(tooltip).toHaveAttribute('id', 'help-tooltip')
    expect(tooltip).not.toHaveAttribute('aria-hidden')
    expect(tooltip.className).toContain('max-w-[min(28rem,calc(100vw-1rem))]')
    expect(tooltip.className).toContain('whitespace')
    expect(tooltip.className).toContain('[overflow-wrap:anywhere]')
  })

  it('is exposed through the trigger description and remains keyboard reachable', async () => {
    const user = userEvent.setup()
    render(
      <span className="group relative">
        <button type="button" aria-describedby="keyboard-tooltip">Ajuda por teclado</button>
        <Tooltip id="keyboard-tooltip">Descrição da ação</Tooltip>
      </span>,
    )

    await user.tab()
    const trigger = screen.getByRole('button', { name: 'Ajuda por teclado' })
    expect(trigger).toHaveFocus()
    expect(trigger).toHaveAttribute('aria-describedby', 'keyboard-tooltip')
    expect(screen.getByRole('tooltip')).toHaveAttribute('role', 'tooltip')
  })
})
