import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CirculationPoliciesPage } from '@/features/circulation/CirculationPoliciesPage'

const fixtures = vi.hoisted(() => ({
  user: { role: 'school_admin', school_id: 7, administrative_capabilities: [] as string[] },
  get: vi.fn(),
  put: vi.fn(),
  announce: vi.fn(),
}))

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: fixtures.user }) }))
vi.mock('@/components/feedback/LiveRegionContext', () => ({ useAnnouncer: () => fixtures.announce }))
vi.mock('@/lib/api', () => ({ default: { get: fixtures.get, put: fixtures.put } }))

const policies = [
  { reader_role: 'student', max_active_loans: 3, loan_duration_days: 14, max_renewals: 0, can_reserve: true, max_active_reservations: 3, block_new_loans_when_overdue: true, post_overdue_suspension_days: 0, count_only_business_days: false, move_due_date_to_next_business_day: false },
  { reader_role: 'teacher', max_active_loans: 5, loan_duration_days: 21, max_renewals: 0, can_reserve: true, max_active_reservations: 5, block_new_loans_when_overdue: true, post_overdue_suspension_days: 0, count_only_business_days: false, move_due_date_to_next_business_day: false },
]

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<MemoryRouter><QueryClientProvider client={client}><CirculationPoliciesPage /></QueryClientProvider></MemoryRouter>)
}

describe('CirculationPoliciesPage', () => {
  afterEach(() => {
    cleanup()
    fixtures.get.mockReset()
    fixtures.put.mockReset()
    fixtures.announce.mockReset()
    fixtures.user = { role: 'school_admin', school_id: 7, administrative_capabilities: [] }
  })

  it('shows separate policies and saves both profiles for the own school', async () => {
    fixtures.get.mockResolvedValue({ data: { policies } })
    fixtures.put.mockResolvedValue({ data: { policies } })
    renderPage()

    expect(await screen.findByRole('tab', { name: 'Aluno' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Professor' })).toBeInTheDocument()
    fireEvent.change(screen.getAllByLabelText('Empréstimos simultâneos')[0], { target: { value: '2' } })
    fireEvent.click(screen.getAllByLabelText(/Contar apenas dias úteis no prazo do empréstimo/)[0])
    fireEvent.click(screen.getByRole('button', { name: 'Salvar regras' }))

    await waitFor(() => expect(fixtures.put).toHaveBeenCalledWith(
      '/circulation-policies/7',
      expect.objectContaining({ policies: expect.arrayContaining([
        expect.objectContaining({ reader_role: 'student', max_active_loans: 2 }),
        expect.objectContaining({ reader_role: 'student', count_only_business_days: true }),
      ]) }),
    ))
  })

  it('does not expose administration controls to a reader', () => {
    fixtures.user = { role: 'teacher', school_id: 7, administrative_capabilities: [] }
    renderPage()
    expect(screen.getByRole('alert')).toHaveTextContent('não tem permissão')
  })

  it('allows a librarian to consult rules but keeps them read-only without the capability', async () => {
    fixtures.user = { role: 'librarian', school_id: 7, administrative_capabilities: [] }
    fixtures.get.mockResolvedValue({ data: { policies } })
    renderPage()

    expect(await screen.findByRole('tab', { name: 'Aluno' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('somente leitura')
    expect(screen.queryByRole('button', { name: 'Salvar regras' })).not.toBeInTheDocument()
    expect(screen.getAllByLabelText(/Contar apenas dias úteis no prazo do empréstimo/)[0]).toBeDisabled()
    expect(fixtures.put).not.toHaveBeenCalled()
  })

  it('allows a librarian with the delegated capability to edit rules', async () => {
    fixtures.user = { role: 'librarian', school_id: 7, administrative_capabilities: ['manage_circulation_rules'] }
    fixtures.get.mockResolvedValue({ data: { policies } })
    fixtures.put.mockResolvedValue({ data: { policies } })
    renderPage()

    expect(await screen.findByRole('tab', { name: 'Aluno' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salvar regras' })).toBeEnabled()
    expect(screen.getAllByLabelText(/Contar apenas dias úteis no prazo do empréstimo/)[0]).toBeEnabled()
  })

  it('disables the next-business-day option while business-day counting is active', async () => {
    fixtures.get.mockResolvedValue({ data: { policies } })
    fixtures.put.mockResolvedValue({ data: { policies } })
    renderPage()

    await screen.findByRole('tab', { name: 'Aluno' })
    const countBusinessDays = screen.getAllByLabelText(/Contar apenas dias úteis no prazo do empréstimo/)[0]
    const moveDueDate = screen.getAllByLabelText(/Se a data de entrega cair em dia não útil/)[0]

    expect(moveDueDate).toBeEnabled()
    fireEvent.click(countBusinessDays)
    expect(countBusinessDays).toBeChecked()
    expect(moveDueDate).toBeDisabled()
    expect(moveDueDate).not.toBeChecked()

    fireEvent.click(moveDueDate)
    expect(moveDueDate).not.toBeChecked()

    fireEvent.click(countBusinessDays)
    expect(countBusinessDays).not.toBeChecked()
    expect(moveDueDate).toBeEnabled()
    fireEvent.click(moveDueDate)
    expect(moveDueDate).toBeChecked()
  })

  it('lets a super admin choose a school with the shared autocomplete', async () => {
    fixtures.user = { role: 'super_admin', school_id: 0, administrative_capabilities: [] }
    fixtures.get.mockImplementation((url: string) => {
      if (url.startsWith('/schools/')) {
        return Promise.resolve({ data: { items: [{ id: 8, name: 'Escola Central' }, { id: 9, name: 'Escola Norte' }] } })
      }
      return Promise.resolve({ data: { policies } })
    })
    renderPage()

    const input = await screen.findByRole('combobox', { name: 'Escola' })
    fireEvent.change(input, { target: { value: 'Norte' } })
    await screen.findByRole('option', { name: 'Escola Norte' })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => expect(fixtures.get).toHaveBeenCalledWith('/circulation-policies/9'))
    expect(input).toHaveValue('Escola Norte')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})
