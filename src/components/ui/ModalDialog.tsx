import { X } from 'lucide-react'
import { useEffect, useId, useRef, type MouseEvent, type ReactNode, type RefObject } from 'react'

type ModalDialogProps = {
  title: ReactNode
  children: ReactNode
  variant?: 'compact' | 'form'
  onClose?: () => void
  labelledBy?: string
  describedBy?: string
  overlayClassName?: string
  contentClassName?: string
  contentRef?: RefObject<HTMLElement | null>
  contentTabIndex?: number
}

export function ModalDialog({
  title,
  children,
  variant = 'compact',
  onClose,
  labelledBy,
  describedBy,
  overlayClassName = 'bg-slate-950/50',
  contentClassName,
  contentRef,
  contentTabIndex,
}: ModalDialogProps) {
  const dialogRef = useRef<HTMLElement>(null)
  const previousFocusedElement = useRef<HTMLElement | null>(
    document.activeElement instanceof HTMLElement ? document.activeElement : null,
  )
  const generatedTitleId = useId()
  const titleId = labelledBy ?? `modal-title-${generatedTitleId}`
  const widthClassName = variant === 'form'
    ? 'max-w-[min(48rem,calc(100vw-2rem))]'
    : 'max-w-[min(30rem,calc(100vw-2rem))]'

  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const previousHtmlOverflow = html.style.overflow
    const previousBodyOverflow = body.style.overflow
    const previousHtmlOverscrollBehavior = html.style.overscrollBehavior
    const previousBodyOverscrollBehavior = body.style.overscrollBehavior

    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    html.style.overscrollBehavior = 'none'
    body.style.overscrollBehavior = 'none'

    return () => {
      html.style.overflow = previousHtmlOverflow
      body.style.overflow = previousBodyOverflow
      html.style.overscrollBehavior = previousHtmlOverscrollBehavior
      body.style.overscrollBehavior = previousBodyOverscrollBehavior
    }
  }, [])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return undefined
    const returnFocusTarget = previousFocusedElement.current

    const focusableElements = () => Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => !element.hasAttribute('inert') && element.getAttribute('aria-hidden') !== 'true')

    const initialFocusTarget = focusableElements()[0] ?? dialog
    initialFocusTarget.focus()

    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const elements = focusableElements()
      if (!elements.length) {
        event.preventDefault()
        dialog.focus()
        return
      }

      const first = elements[0]
      const last = elements[elements.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    dialog.addEventListener('keydown', trapFocus)
    return () => {
      dialog.removeEventListener('keydown', trapFocus)
      if (returnFocusTarget?.isConnected) returnFocusTarget.focus()
    }
  }, [])

  useEffect(() => {
    if (!onClose) return undefined
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    if (onClose && event.target === event.currentTarget) onClose()
  }

  const setDialogRef = (element: HTMLElement | null) => {
    dialogRef.current = element
    if (contentRef) contentRef.current = element
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${overlayClassName}`}
      onMouseDown={handleOverlayClick}
    >
      <section
        role="dialog"
        ref={setDialogRef}
        tabIndex={contentTabIndex}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={describedBy}
        className={`flex max-h-[calc(100dvh-2rem)] min-h-0 w-full flex-col overflow-hidden rounded-xl bg-white shadow-xl dark:bg-slate-800 ${widthClassName} ${contentClassName ?? ''}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="shrink-0 border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          <div className="flex items-start justify-between gap-4">
            <h2 id={titleId} className="text-lg font-semibold text-slate-900 dark:text-white">
              {title}
            </h2>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar diálogo"
                className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-3 focus-visible:outline-[var(--color-focus)] dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            )}
          </div>
        </header>
        <div className="min-h-0 overflow-y-auto px-6 py-4">
          {children}
        </div>
      </section>
    </div>
  )
}
