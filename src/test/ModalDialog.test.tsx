import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { ModalDialog } from '@/components/ui/ModalDialog'

function DialogFixture() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Abrir diálogo</button>
      {open && (
        <ModalDialog title="Confirmar ação" onClose={() => setOpen(false)}>
          <button type="button">Cancelar</button>
          <button type="button">Confirmar</button>
        </ModalDialog>
      )}
    </>
  )
}

describe('ModalDialog', () => {
  afterEach(cleanup)

  it('moves focus into the dialog, traps Tab navigation and returns focus on Escape', async () => {
    render(<DialogFixture />)
    const trigger = screen.getByRole('button', { name: 'Abrir diálogo' })
    trigger.focus()
    fireEvent.click(trigger)

    const closeButton = screen.getByRole('button', { name: 'Fechar diálogo' })
    await waitFor(() => expect(closeButton).toHaveFocus())

    const confirmButton = screen.getByRole('button', { name: 'Confirmar' })
    fireEvent.keyDown(confirmButton, { key: 'Tab' })
    expect(closeButton).toHaveFocus()

    fireEvent.keyDown(closeButton, { key: 'Tab', shiftKey: true })
    expect(confirmButton).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })
})
