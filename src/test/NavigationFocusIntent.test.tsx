import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import {
  NavigationFocusIntentProvider,
} from '@/components/navigation/NavigationFocusIntent'
import { useNavigationFocusIntent } from '@/components/navigation/useNavigationFocusIntent'

function Probe() {
  const { registerMouseNavigation, consumeOperationalFocus } = useNavigationFocusIntent()
  return (
    <>
      <button type="button" onClick={() => registerMouseNavigation('/acervo')}>Registrar Acervo</button>
      <button type="button" onClick={() => registerMouseNavigation('/emprestimos')}>Registrar Empréstimos</button>
      <button type="button" onClick={() => document.body.dataset.result = String(consumeOperationalFocus('/acervo'))}>Consumir Acervo</button>
    </>
  )
}

function renderProbe() {
  return render(
    <MemoryRouter initialEntries={['/acervo']}>
      <NavigationFocusIntentProvider>
        <Probe />
      </NavigationFocusIntentProvider>
    </MemoryRouter>,
  )
}

describe('NavigationFocusIntent', () => {
  afterEach(cleanup)

  it('autoriza foco operacional uma única vez para a rota registrada', () => {
    renderProbe()

    fireEvent.click(screen.getByRole('button', { name: 'Registrar Acervo' }))
    fireEvent.click(screen.getByRole('button', { name: 'Consumir Acervo' }))
    expect(document.body.dataset.result).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: 'Consumir Acervo' }))
    expect(document.body.dataset.result).toBe('false')
  })

  it('não autoriza foco para uma rota diferente', () => {
    renderProbe()

    fireEvent.click(screen.getByRole('button', { name: 'Registrar Empréstimos' }))
    fireEvent.click(screen.getByRole('button', { name: 'Consumir Acervo' }))

    expect(document.body.dataset.result).toBe('false')
  })
})
