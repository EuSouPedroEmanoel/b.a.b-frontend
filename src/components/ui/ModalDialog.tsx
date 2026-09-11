import { useId, type MouseEvent, type ReactNode, type RefObject } from 'react'

type ModalDialogProps = {
  title: ReactNode
  children: ReactNode
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
  onClose,
  labelledBy,
  describedBy,
  overlayClassName = 'bg-slate-950/50',
  contentClassName = 'max-w-md',
  contentRef,
  contentTabIndex,
}: ModalDialogProps) {
  const generatedTitleId = useId()
  const titleId = labelledBy ?? `modal-title-${generatedTitleId}`

  const handleOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    if (onClose && event.target === event.currentTarget) onClose()
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${overlayClassName}`}
      onMouseDown={handleOverlayClick}
    >
      <section
        role="dialog"
        ref={contentRef}
        tabIndex={contentTabIndex}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={describedBy}
        className={`flex max-h-[calc(100dvh-2rem)] min-h-0 w-full flex-col overflow-hidden rounded-xl bg-white shadow-xl dark:bg-slate-800 ${contentClassName}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="shrink-0 border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          <h2 id={titleId} className="text-lg font-semibold text-slate-900 dark:text-white">
            {title}
          </h2>
        </header>
        <div className="min-h-0 overflow-y-auto px-6 py-4">
          {children}
        </div>
      </section>
    </div>
  )
}
