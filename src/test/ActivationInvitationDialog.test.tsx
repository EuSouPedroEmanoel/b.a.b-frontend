import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ActivationInvitationDialog, type CreatedUserInvitation } from '@/features/users/ActivationInvitationDialog'

const fixtures = vi.hoisted(() => ({ announce: vi.fn(), writeText: vi.fn().mockResolvedValue(undefined) }))

vi.mock('@/components/feedback/LiveRegionContext', () => ({ useAnnouncer: () => fixtures.announce }))
vi.mock('@/lib/api', () => ({ default: { post: vi.fn() } }))

const created: CreatedUserInvitation = {
  id: 1,
  name: 'Aluna Teste',
  username: 'aluna.teste',
  activation_invitation: {
    code: 'ABC-123-XYZ',
    expires_at: '2026-09-20T12:00:00Z',
    first_access_url: 'https://biblioteca.test/primeiro-acesso',
    print_url: '/account-activation/print',
  },
}

describe('ActivationInvitationDialog copy action', () => {
  afterEach(() => {
    cleanup()
    fixtures.announce.mockReset()
    fixtures.writeText.mockReset().mockResolvedValue(undefined)
  })

  it('copies the activation code and exposes a copied confirmation', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: fixtures.writeText } })
    render(<ActivationInvitationDialog created={created} onClose={vi.fn()} />)

    const dialog = screen.getByRole('dialog', { name: 'Convite de primeiro acesso' })
    expect(dialog).toHaveClass('max-w-[min(48rem,calc(100vw-2rem))]')
    expect(dialog.querySelector('.text-left')).toBeInTheDocument()
    const qrCode = await screen.findByRole('img', { name: 'QR Code para abrir o primeiro acesso com os dados preenchidos' })
    expect(qrCode).toHaveAttribute('src', expect.stringContaining('data:image/svg+xml'))
    expect(screen.getByText(/primeiro-acesso\?username=aluna\.teste&code=ABC-123-XYZ/)).toBeInTheDocument()
    const copyButton = screen.getByRole('button', { name: 'Copiar código' })
    expect(copyButton).toHaveClass('w-full', 'sm:w-40')
    fireEvent.click(copyButton)

    await waitFor(() => expect(fixtures.writeText).toHaveBeenCalledWith('ABC-123-XYZ'))
    const copiedButton = await screen.findByRole('button', { name: 'Código copiado' })
    expect(copiedButton).toHaveClass('whitespace-nowrap', '!px-2')
    expect(fixtures.announce).toHaveBeenCalledWith('Código de ativação copiado.', 'polite')
  })
})
