import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LoginPage } from '@/features/auth/LoginPage'

const fixtures = vi.hoisted(() => ({
  login: vi.fn().mockResolvedValue(undefined),
  loginGuest: vi.fn().mockResolvedValue(undefined),
  schools: [
    { code: 'S1', name: 'Escola Central' },
    { code: 'S2', name: 'Escola Norte' },
  ],
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ login: fixtures.login, loginGuest: fixtures.loginGuest }),
}))

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn().mockResolvedValue({ data: fixtures.schools }) },
}))

vi.mock('@/components/feedback/LiveRegionContext', () => ({
  useAnnouncer: () => vi.fn(),
}))

describe('Guest school autocomplete', () => {
  afterEach(() => {
    cleanup()
    fixtures.login.mockReset().mockResolvedValue(undefined)
    fixtures.loginGuest.mockClear()
  })

  const renderLogin = (entry = '/entrar') => render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/entrar" element={<LoginPage />} />
        <Route path="/visitar/:schoolCode" element={<LoginPage />} />
        <Route path="/" element={<LocationText />} />
        <Route path="/inicio" element={<LocationText />} />
      </Routes>
    </MemoryRouter>,
  )

  function LocationText() {
    const location = useLocation()
    return <output data-testid="location">{location.pathname}</output>
  }

  const openGuestMode = async () => {
    const toggle = await screen.findByRole('tab', { name: 'Acessar como visitante' })
    fireEvent.click(toggle)
    return screen.findByRole('combobox', { name: 'Escola' })
  }

  it('preselects a public link school and supports keyboard selection', async () => {
    renderLogin('/visitar/S1')

    const input = await screen.findByRole('combobox', { name: 'Escola' })
    expect(input).toHaveValue('Escola Central')
    expect(screen.getByRole('button', { name: 'Acessar o acervo como visitante' })).not.toBeDisabled()

    fireEvent.change(input, { target: { value: 'Norte' } })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(input).toHaveValue('Escola Norte')
    fireEvent.submit(input.closest('form')!)
    await waitFor(() => expect(fixtures.loginGuest).toHaveBeenCalledWith('S2', 'Escola Norte'))
  })

  it('keeps access disabled until a suggestion is selected and announces empty results', async () => {
    renderLogin()

    const input = await openGuestMode()
    const button = screen.getByRole('button', { name: 'Acessar o acervo como visitante' })
    expect(button).toBeDisabled()
    fireEvent.change(input, { target: { value: 'inexistente' } })
    expect((await screen.findAllByText('Nenhuma escola encontrada.')).length).toBeGreaterThan(0)
    expect(button).toBeDisabled()
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('waits for two characters before opening school suggestions', async () => {
    renderLogin()
    const input = await openGuestMode()

    fireEvent.change(input, { target: { value: 'E' } })
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('pelo menos 2 caracteres')

    fireEvent.change(input, { target: { value: 'Es' } })
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })

  it('switches modes without reloading and moves focus to the relevant first field', async () => {
    renderLogin()

    const guestToggle = await screen.findByRole('tab', { name: 'Acessar como visitante' })
    fireEvent.click(guestToggle)
    const guestInput = await screen.findByRole('combobox', { name: 'Escola' })
    await waitFor(() => expect(document.activeElement).toBe(guestInput))

    fireEvent.click(screen.getByRole('tab', { name: 'Entrar com conta' }))
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('textbox', { name: /Usuário, e-mail ou CPF/ })))
    expect(screen.queryByRole('combobox', { name: 'Escola' })).not.toBeInTheDocument()
  })

  it('supports ArrowDown/ArrowUp, Enter selection, and closes on outside click', async () => {
    renderLogin()
    const input = await openGuestMode()

    fireEvent.change(input, { target: { value: 'Escola' } })
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(input).toHaveAttribute('aria-activedescendant', 'guest-school-option-0')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(input).toHaveAttribute('aria-activedescendant', 'guest-school-option-1')
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(input).toHaveAttribute('aria-activedescendant', 'guest-school-option-0')
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(input).toHaveValue('Escola Central')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()

    fireEvent.focus(input)
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('selects the first suggestion when Enter is pressed without arrow navigation', async () => {
    renderLogin()
    const input = await openGuestMode()

    fireEvent.change(input, { target: { value: 'Escola' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(input).toHaveValue('Escola Central')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('invalidates a previously selected school when the query is edited', async () => {
    renderLogin()
    const input = await openGuestMode()

    fireEvent.change(input, { target: { value: 'Central' } })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    const button = screen.getByRole('button', { name: 'Acessar o acervo como visitante' })
    expect(button).not.toBeDisabled()

    fireEvent.change(input, { target: { value: 'Escola Central x' } })
    expect(button).toBeDisabled()
  })

  it('submits Guest with Enter after a real school selection', async () => {
    renderLogin()
    const input = await openGuestMode()

    fireEvent.change(input, { target: { value: 'Norte' } })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(input).toHaveValue('Escola Norte')

    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.submit(input.closest('form')!)
    await waitFor(() => expect(fixtures.loginGuest).toHaveBeenCalledWith('S2', 'Escola Norte'))
  })

  it('opens the public Home after Guest authentication', async () => {
    renderLogin()
    const input = await openGuestMode()

    fireEvent.change(input, { target: { value: 'Central' } })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/inicio'))
  })

  it('shows a clear message when the API cannot be reached during account login', async () => {
    fixtures.login.mockRejectedValueOnce(new Error('Network Error'))
    renderLogin()

    await screen.findByRole('tab', { name: 'Entrar com conta' })
    fireEvent.change(screen.getByRole('textbox', { name: /Usuário, e-mail ou CPF/ }), { target: { value: 'bibliotecario' } })
    fireEvent.change(document.getElementById('password')!, { target: { value: 'senha-segura' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
    )
  })
})
