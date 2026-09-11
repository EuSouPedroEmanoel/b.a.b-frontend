import { useEffect, useId, useRef, type RefObject } from 'react'
import { Button } from '@/components/ui/Button'
import { ModalDialog } from '@/components/ui/ModalDialog'

type ReservationConfirmDialogProps = {
  open: boolean
  bookTitle: string
  pending: boolean
  errorMessage?: string | null
  onClose: () => void
  onConfirm: () => void
  cancelRef: RefObject<HTMLButtonElement | null>
  confirmRef: RefObject<HTMLButtonElement | null>
}

const focusableSelector = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function ReservationConfirmDialog({
  open,
  bookTitle,
  pending,
  errorMessage,
  onClose,
  onConfirm,
  cancelRef,
  confirmRef,
}: ReservationConfirmDialogProps) {
  const dialogRef = useRef<HTMLElement>(null)
  const id = useId()
  const titleId = `reservation-confirm-title-${id}`
  const descriptionId = `reservation-confirm-description-${id}`
  const errorId = `reservation-confirm-error-${id}`

  useEffect(() => {
    if (!open) return

    cancelRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!pending) {
          event.preventDefault()
          onClose()
        }
        return
      }

      if (event.key !== 'Tab' || !dialogRef.current) return

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector),
      )
      if (focusable.length === 0) {
        event.preventDefault()
        dialogRef.current.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [cancelRef, onClose, open, pending])

  if (!open) return null

  return (
    <ModalDialog
      variant="compact"
      title={<><span>Confirmar reserva</span><span className="sr-only"> para {bookTitle}</span></>}
      onClose={() => { if (!pending) onClose() }}
      labelledBy={titleId}
      describedBy={errorMessage ? `${descriptionId} ${errorId}` : descriptionId}
      contentRef={dialogRef}
      contentTabIndex={-1}
      contentClassName="outline-none"
    >
            <p id={descriptionId} className="text-sm leading-6 text-slate-600 dark:text-slate-300">
              Este livro não possui exemplares disponíveis no momento. Ao confirmar, você entrará na fila de espera. Quando um exemplar ficar disponível e chegar a sua vez, sua reserva ficará pronta para retirada. Você pode acompanhar o andamento pela página de Reservas.
            </p>
            {errorMessage && (
              <p id={errorId} className="mt-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-700 dark:bg-red-950/40 dark:text-red-200">
                {errorMessage}
              </p>
            )}
            <div className="mt-6 flex flex-wrap gap-3">
              <Button type="button" variant="secondary" className="min-w-max flex-1" onClick={onClose} disabled={pending} ref={cancelRef}>
                Cancelar
              </Button>
              <Button type="button" variant="primary" className="min-w-max flex-1" onClick={onConfirm} disabled={pending} aria-busy={pending} ref={confirmRef}>
                {pending ? 'Confirmando…' : 'Confirmar reserva'}
              </Button>
            </div>
    </ModalDialog>
  )
}
