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
})
