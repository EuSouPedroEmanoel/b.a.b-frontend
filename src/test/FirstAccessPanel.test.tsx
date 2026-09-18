import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FirstAccessPanel } from '@/features/auth/FirstAccessPanel'
import { formatActivationCode, hasInvalidActivationCharacter } from '@/features/auth/activationCode'

const fixtures = vi.hoisted(() => ({ post: vi.fn(), announce: vi.fn() }))

vi.mock('@/lib/api', () => ({ default: { post: fixtures.post } }))
vi.mock('@/components/feedback/LiveRegionContext', () => ({ useAnnouncer: () => fixtures.announce }))

describe('FirstAccessPanel', () => {
  afterEach(() => {
    cleanup()
    fixtures.post.mockReset()
    fixtures.announce.mockReset()
  })

  it('normalizes lowercase, paste and optional hyphens without accepting ambiguous characters', () => {
    expect(formatActivationCode('abc123xyz')).toBe('ABC-123-XYZ')
    expect(formatActivationCode('abc-123-xyz')).toBe('ABC-123-XYZ')
    expect(formatActivationCode(' a b c 1 2 3 x y z ')).toBe('ABC-123-XYZ')
    expect(hasInvalidActivationCharacter('ABC-120-XYZ')).toBe(true)
    expect(hasInvalidActivationCharacter('ABC-12O-XYZ')).toBe(true)
    expect(hasInvalidActivationCharacter('ABC-1I3-XYZ')).toBe(true)
    expect(hasInvalidActivationCharacter('ABC-1L3-XYZ')).toBe(true)
  })

  it('validates the invitation, focuses the password step and activates without logging in', async () => {
    fixtures.post.mockResolvedValue({ data: {} })
    const onActivated = vi.fn()
    render(<FirstAccessPanel onActivated={onActivated} />)
    const user = userEvent.setup()

    await user.type(screen.getByRole('textbox', { name: /Usuário/ }), 'aluno.teste')
    await user.type(screen.getByRole('textbox', { name: /Código de ativação/ }), 'abc123xyz')
    expect(screen.getByRole('textbox', { name: /Código de ativação/ })).toHaveValue('ABC-123-XYZ')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))

    const heading = await screen.findByRole('heading', { name: 'Criar senha' })
    await waitFor(() => expect(heading).toHaveFocus())
    expect(fixtures.post).toHaveBeenNthCalledWith(1, '/account-activation/validate', { username: 'aluno.teste', code: 'ABC-123-XYZ' })

    expect(screen.getAllByText('0 caracteres')).toHaveLength(2)
    const newPassword = screen.getByLabelText(/^Nova senha/)
    const confirmation = screen.getByLabelText(/^Confirmar nova senha/)
    const showNewPassword = screen.getByRole('button', { name: 'Mostrar nova senha' })
    const showConfirmation = screen.getByRole('button', { name: 'Mostrar confirmação da senha' })
    expect(showNewPassword).toBeInTheDocument()
    expect(showConfirmation).toBeInTheDocument()
    await user.click(showNewPassword)
    expect(newPassword).toHaveAttribute('type', 'text')
    expect(confirmation).toHaveAttribute('type', 'password')
    await user.click(screen.getByRole('button', { name: 'Ocultar nova senha' }))
    await user.click(showConfirmation)
    expect(newPassword).toHaveAttribute('type', 'password')
    expect(confirmation).toHaveAttribute('type', 'text')
    await user.click(screen.getByRole('button', { name: 'Ocultar confirmação da senha' }))
    await user.type(newPassword, 'S')
    expect(screen.getByText('1 caractere')).toBeInTheDocument()
    fireEvent.keyDown(newPassword, { key: 'Enter' })
    expect(confirmation).toHaveFocus()
    await user.clear(newPassword)
    await user.type(newPassword, 'SenhaNova123')
    await user.type(confirmation, 'SenhaNova123')
    await user.click(screen.getByRole('button', { name: 'Ativar conta' }))

    await waitFor(() => expect(onActivated).toHaveBeenCalledWith('aluno.teste'))
    expect(fixtures.post).toHaveBeenNthCalledWith(2, '/account-activation/complete', {
      username: 'aluno.teste',
      code: 'ABC-123-XYZ',
      password: 'SenhaNova123',
      password_confirmation: 'SenhaNova123',
    })
  })

  it('prefills the invitation details from a QR access link', () => {
    render(<FirstAccessPanel onActivated={vi.fn()} initialUsername="aluno.teste" initialCode="ABC-123-XYZ" />)

    expect(screen.getByRole('textbox', { name: /Usuário/ })).toHaveValue('aluno.teste')
    expect(screen.getByRole('textbox', { name: /Código de ativação/ })).toHaveValue('ABC-123-XYZ')
  })

  it('shows generic validation and network errors', async () => {
    fixtures.post.mockRejectedValueOnce({})
    render(<FirstAccessPanel onActivated={vi.fn()} />)
    fireEvent.change(screen.getByRole('textbox', { name: /Usuário/ }), { target: { value: 'aluno' } })
    fireEvent.change(screen.getByRole('textbox', { name: /Código de ativação/ }), { target: { value: 'ABC123XYZ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível validar os dados informados')
  })

  it('rejects ambiguous characters with an associated field error', () => {
    render(<FirstAccessPanel onActivated={vi.fn()} />)
    const code = screen.getByRole('textbox', { name: /Código de ativação/ })
    fireEvent.change(code, { target: { value: 'ABC-120-XYZ' } })
    expect(screen.getByRole('alert')).toHaveTextContent('Use somente os caracteres indicados')
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled()
  })
})
