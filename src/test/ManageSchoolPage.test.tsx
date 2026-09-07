import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ManageSchoolPage } from '@/features/schools/ManageSchoolPage'

const fixtures = vi.hoisted(() => ({
  user: { role: 'super_admin', school_id: 0 },
  get: vi.fn(),
}))

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: fixtures.user }) }))
vi.mock('@/lib/api', () => ({ default: { get: fixtures.get } }))
vi.mock('@/features/circulation/CirculationPoliciesPage', () => ({
  CirculationPoliciesPage: ({ schoolIdOverride }: { schoolIdOverride: string }) => <p>Regras para {schoolIdOverride || 'nenhuma escola'}</p>,
}))
vi.mock('@/features/schools/LibraryCalendarPage', () => ({
  LibraryCalendarPage: ({ schoolIdOverride }: { schoolIdOverride: string }) => <p>Calendário para {schoolIdOverride || 'nenhuma escola'}</p>,
}))

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <MemoryRouter initialEntries={['/gerenciar-escola']}>
      <QueryClientProvider client={client}>
        <Routes><Route path="/gerenciar-escola" element={<ManageSchoolPage />} /></Routes>
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

describe('ManageSchoolPage', () => {
  afterEach(() => {
    cleanup()
    fixtures.get.mockReset()
  })

  it('starts empty and focused, then selects the first matching school with Enter', async () => {
    fixtures.get.mockResolvedValue({ data: { items: [{ id: 8, name: 'Escola Central' }, { id: 9, name: 'Escola Norte' }] } })
    renderPage()

    const input = await screen.findByRole('combobox', { name: 'Escola' })
    expect(input).toHaveValue('')
    await waitFor(() => expect(document.activeElement).toBe(input))

    fireEvent.change(input, { target: { value: 'Escola' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => expect(screen.getByText('Regras para 8')).toBeInTheDocument())
    expect(input).toHaveValue('Escola Central')

    fireEvent.focus(input)
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})
