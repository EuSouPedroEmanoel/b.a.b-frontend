import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type User } from '@/context/auth-context'
import { AccountManagementPage } from '@/features/account/AccountManagementPage'

const api = vi.hoisted(() => ({ put: vi.fn() }))
vi.mock('@/lib/api', () => ({ default: api }))

const user: User = { id: 7, username: 'ana', name: 'Ana Silva', role: 'student', school_id: 3, is_active: true }
const refreshUser = vi.fn()

function renderPage(path = '/perfil/7') {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return render(<QueryClientProvider client={client}><AuthContext.Provider value={{ user, loading: false, isAuthenticated: true, login: vi.fn(), loginGuest: vi.fn(), logout: vi.fn(), refreshUser }}><MemoryRouter initialEntries={[path]}><Routes><Route path="/perfil/:id" element={<AccountManagementPage />} /><Route path="/perfil" element={<p>Perfil</p>} /></Routes></MemoryRouter></AuthContext.Provider></QueryClientProvider>)
}

describe('AccountManagementPage', () => {
  beforeEach(() => { api.put.mockReset(); refreshUser.mockReset() })
  afterEach(cleanup)

  it('updates allowed profile fields and refreshes /users/me data', async () => {
    api.put.mockResolvedValue({ data: user })
    refreshUser.mockResolvedValue(undefined)
    renderPage()
    const nameInput = document.getElementById('profile-name') as HTMLInputElement
    await userEvent.clear(nameInput)
    await userEvent.type(nameInput, 'Ana Souza')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/users/7', { name: 'Ana Souza', username: 'ana' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Perfil atualizado com sucesso.')
    expect(refreshUser).toHaveBeenCalled()
  })

  it('requires matching password confirmation and preserves values after failure', async () => {
    api.put.mockRejectedValue(new Error('Falha temporária'))
    renderPage('/perfil/7#senha')
    await userEvent.type(screen.getByLabelText(/^Nova senha/), 'nova-senha')
    await userEvent.type(screen.getByLabelText(/^Confirmar nova senha/), 'diferente')
    await userEvent.click(screen.getByRole('button', { name: 'Alterar senha' }))
    expect(screen.getByText('A confirmação deve ser igual à nova senha.')).toBeInTheDocument()
    expect(api.put).not.toHaveBeenCalled()
    await userEvent.clear(screen.getByLabelText(/^Confirmar nova senha/))
    await userEvent.type(screen.getByLabelText(/^Confirmar nova senha/), 'nova-senha')
    await userEvent.click(screen.getByRole('button', { name: 'Alterar senha' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Falha temporária')
    expect(screen.getByLabelText(/^Nova senha/)).toHaveValue('nova-senha')
  })

  it('redirects attempts to edit a different profile', async () => {
    renderPage('/perfil/99')
    expect(await screen.findByText('Perfil')).toBeInTheDocument()
    expect(api.put).not.toHaveBeenCalled()
  })
})
