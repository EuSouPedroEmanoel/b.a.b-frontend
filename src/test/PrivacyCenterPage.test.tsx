import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PrivacyCenterPage } from '@/features/privacy/PrivacyCenterPage'

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('@/lib/api', () => ({ default: api }))

const profile = {
  account: { name: 'Ana', username: 'ana', cpf_masked: '***.***.**-42', birthdate: '2015-09-18', class: '5º A', school: 'Escola', role: 'student', status: 'active' },
  library: { loans_total: 2, active_loans: 1, reservations_total: 3, active_reservations: 1 },
  preferences: { favorites: 4, reading_statuses: 5 },
  security: { password: 'Não exibida', tokens: 'Não exibidos' }, sharing: [], correction_guidance: ['Você pode corrigir seu nome.'], preservation: ['Empréstimos ativos podem ser preservados.'],
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><MemoryRouter><PrivacyCenterPage /></MemoryRouter></QueryClientProvider>)
}

describe('PrivacyCenterPage', () => {
  afterEach(cleanup)

  it('translates account values, formats dates and avoids secrets or duplicate markers', async () => {
    api.get.mockImplementation((url: string) => Promise.resolve({ data: url === '/privacy/me' ? profile : { items: [], total: 0, page: 1, size: 20, pages: 0 } }))
    renderPage()
    expect(await screen.findByText('Ana')).toBeInTheDocument()
    expect(screen.getByText('Aluno')).toBeInTheDocument()
    expect(screen.getByText('Ativa')).toBeInTheDocument()
    expect(screen.getByText('18/09/2015')).toBeInTheDocument()
    expect(screen.getByText(/senha e tokens de acesso, nunca são exibidas/)).toBeInTheDocument()
    expect(screen.queryByText(/^•/)).not.toBeInTheDocument()
  })

  it('shows friendly request language and links to the privacy notice', async () => {
    api.get.mockImplementation((url: string) => Promise.resolve({ data: url === '/privacy/me' ? profile : { items: [{ id: 1, request_type: 'correction', status: 'fulfilled', description: null, resolution: null, created_at: '2026-10-18T12:00:00Z', updated_at: '2026-10-18T12:00:00Z' }], total: 1, page: 1, size: 20, pages: 1 } }))
    renderPage()
    expect(await screen.findByText('Concluída')).toBeInTheDocument()
    expect(screen.getByText('Solicitada em 18/10/2026')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Aviso de Privacidade' })).toHaveAttribute('href', '/privacidade')
    screen.getByRole('button', { name: 'Nova solicitação' }).click()
    await waitFor(() => expect(screen.getByRole('option', { name: 'Corrigir meus dados' })).toBeInTheDocument())
    expect(screen.queryByText('consent_revocation')).not.toBeInTheDocument()
  })
})
