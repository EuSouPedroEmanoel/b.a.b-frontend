import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AccessibilityMenu } from '@/components/accessibility/AccessibilityMenu'

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: null }),
}))

const STORAGE_KEY = 'bab-accessibility-preferences:guest'

describe('AccessibilityMenu high contrast', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.className = ''
    delete document.documentElement.dataset.highContrast
  })

  afterEach(() => {
    cleanup()
    localStorage.clear()
    document.documentElement.className = ''
    delete document.documentElement.dataset.highContrast
  })

  it('enables one persistent high-contrast mode independently of the theme', async () => {
    render(<AccessibilityMenu />)

    fireEvent.click(screen.getByRole('button', { name: 'Abrir menu de acessibilidade' }))
    const highContrast = screen.getByRole('switch', { name: 'Alto contraste' })
    fireEvent.click(highContrast)

    expect(highContrast).toBeChecked()
    expect(document.documentElement).toHaveAttribute('data-high-contrast', 'true')
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')).toMatchObject({ highContrast: true })

    document.documentElement.classList.add('dark')
    expect(document.documentElement).toHaveAttribute('data-high-contrast', 'true')
  })

  it('restores the saved preference when the menu mounts again', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ highContrast: true }))
    render(<AccessibilityMenu />)

    await waitFor(() => expect(document.documentElement).toHaveAttribute('data-high-contrast', 'true'))
    fireEvent.click(screen.getByRole('button', { name: 'Abrir menu de acessibilidade' }))
    expect(screen.getByRole('switch', { name: 'Alto contraste' })).toBeChecked()
  })

  it('highlights the selected text-size state', () => {
    render(<AccessibilityMenu />)
    fireEvent.click(screen.getByRole('button', { name: 'Abrir menu de acessibilidade' }))

    const slider = screen.getByRole('slider', { name: 'Tamanho do texto' })
    const steps = document.querySelectorAll('.accessibility-font-step')
    expect(steps).toHaveLength(3)
    expect(steps[0]).toHaveClass('accessibility-font-step--active')

    fireEvent.change(slider, { target: { value: '1' } })
    expect(steps[0]).not.toHaveClass('accessibility-font-step--active')
    expect(steps[1]).toHaveClass('accessibility-font-step--active')
  })

  it('supports pointer dragging, snapping and does not open after a drag', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 })
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      bottom: 324,
      height: 48,
      left: 900,
      right: 948,
      top: 276,
      width: 48,
      x: 900,
      y: 276,
      toJSON: () => ({}),
    } as DOMRect)
    Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
      configurable: true,
      value: vi.fn(),
    })
    Object.defineProperty(HTMLElement.prototype, 'animate', {
      configurable: true,
      value: vi.fn(() => ({
      finished: Promise.resolve(),
      cancel: vi.fn(),
      })),
    })

    render(<AccessibilityMenu />)
    const trigger = screen.getByRole('button', { name: 'Abrir menu de acessibilidade' })

    fireEvent.pointerDown(trigger, { pointerId: 1, clientX: 900, clientY: 300 })
    fireEvent.pointerMove(trigger, { pointerId: 1, clientX: 100, clientY: 300 })
    expect(trigger.className).toContain('cursor-grabbing')
    fireEvent.pointerUp(trigger, { pointerId: 1, clientX: 100, clientY: 300 })
    fireEvent.click(trigger)

    expect(screen.queryByRole('heading', { name: 'Acessibilidade' })).not.toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')).toHaveProperty('side')
  })

  it('opens with Enter and Space without starting a drag', () => {
    render(<AccessibilityMenu />)
    const trigger = screen.getByRole('button', { name: 'Abrir menu de acessibilidade' })

    fireEvent.keyDown(trigger, { key: 'Enter' })
    expect(screen.getByRole('heading', { name: 'Acessibilidade' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Fechar menu de acessibilidade' }))
    fireEvent.keyDown(trigger, { key: ' ' })

    expect(screen.getByRole('heading', { name: 'Acessibilidade' })).toBeInTheDocument()
  })
})
