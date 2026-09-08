import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export function UndoSnackbar({ message, onUndo, onClose }: {
  message: string
  onUndo: () => void
  onClose: () => void
}) {
  return <div role="status" aria-live="polite" aria-atomic="true" className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-4 right-4 z-50 flex h-fit max-w-[calc(100vw-2rem)] flex-wrap items-center justify-between gap-2 rounded-md border border-amber-300 bg-amber-50/90 px-3 py-2 text-sm text-amber-950 shadow-lg backdrop-blur-sm sm:bottom-[calc(1.5rem+env(safe-area-inset-bottom))] sm:left-auto sm:right-6 sm:max-w-md dark:border-amber-700 dark:bg-amber-950/70 dark:text-amber-100">
    <span>{message}</span>
    <span className="flex items-center gap-1">
      <Button type="button" variant="blue-secondary" size="sm" className="!border-blue-400 !bg-slate-800 !text-blue-300 hover:!border-blue-300 hover:!bg-blue-900 hover:!text-blue-100 active:!bg-blue-950 dark:!border-blue-400 dark:!bg-slate-800 dark:!text-blue-300 dark:hover:!border-blue-300 dark:hover:!bg-blue-900 dark:hover:!text-blue-100 dark:active:!bg-blue-950" onClick={onUndo}>Desfazer</Button>
      <Button type="button" variant="danger-secondary" size="sm" className="!border-red-400 !bg-slate-800 !text-red-300 hover:!border-red-300 hover:!bg-red-900 hover:!text-red-100 active:!bg-red-950 dark:!border-red-400 dark:!bg-slate-800 dark:!text-red-300 dark:hover:!border-red-300 dark:hover:!bg-red-900 dark:hover:!text-red-100 dark:active:!bg-red-950" onClick={onClose} aria-label="Fechar aviso"><X aria-hidden="true" /></Button>
    </span>
  </div>
}
