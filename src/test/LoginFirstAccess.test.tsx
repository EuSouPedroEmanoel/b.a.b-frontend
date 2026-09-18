import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LoginPage } from '@/features/auth/LoginPage'

const fixtures = vi.hoisted(() => ({ login: vi.fn(), loginGuest: vi.fn(), get: vi.fn().mockResolvedValue({ data: [] }), post: vi.fn() }))

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ login: fixtures.login, loginGuest: fixtures.loginGuest }) }))
vi.mock('@/lib/api', () => ({ default: { get: fixtures.get, post: fixtures.post } }))
vi.mock('@/components/feedback/LiveRegionContext', () => ({ useAnnouncer: () => vi.fn() }))

function renderLogin(entry = '/entrar') {
  return render(<MemoryRouter initialEntries={[entry]}><Routes><Route path="/entrar" element={<LoginPage />} /><Route path="/primeiro-acesso" element={<LoginPage />} /></Routes></MemoryRouter>)
}

describe('Login first-access tabs', () => {
  afterEach(cleanup)

  it('exposes two associated tabs and supports arrow navigation', async () => {
    renderLogin()
    const enter = screen.getByRole('tab', { name: 'Entrar' })
    const firstAccess = screen.getByRole('tab', { name: 'Primeiro acesso' })
    expect(enter).toHaveAttribute('aria-selected', 'true')
    expect(enter).toHaveAttribute('aria-controls', 'login-panel')
    fireEvent.keyDown(enter, { key: 'ArrowRight' })
    await waitFor(() => expect(firstAccess).toHaveFocus())
    expect(firstAccess).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel', { name: 'Primeiro acesso' })).toBeInTheDocument()
    fireEvent.keyDown(firstAccess, { key: 'Home' })
    await waitFor(() => expect(enter).toHaveFocus())
  })

  it('opens the dedicated URL directly on Primeiro acesso', () => {
    renderLogin('/primeiro-acesso')
    expect(screen.getByRole('tab', { name: 'Primeiro acesso' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('heading', { name: 'Validar convite' })).toBeInTheDocument()
  })
})
