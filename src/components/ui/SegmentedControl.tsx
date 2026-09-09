export const segmentedControlContainerClasses = 'relative flex w-full gap-1 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-1 dark:border-slate-600 dark:bg-slate-800'

export function segmentedControlIndicatorClasses(level: 'primary' | 'secondary', index: number) {
  return `pointer-events-none absolute inset-y-1 left-1 z-0 w-[calc(50%-0.25rem)] rounded-md border transition-transform duration-200 ease-out motion-reduce:transition-none ${index === 1 ? 'translate-x-full' : 'translate-x-0'} ${level === 'primary' ? 'border-[var(--color-primary)] bg-[var(--color-primary)] dark:border-blue-300 dark:bg-blue-900' : 'border-[var(--color-border)] bg-[var(--color-surface)] dark:border-slate-500 dark:bg-slate-600'}`
}

export function segmentedControlItemClasses(selected: boolean, level: 'primary' | 'secondary' = 'secondary') {
  return `relative z-10 min-h-11 flex-1 cursor-pointer rounded-md border px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-3 focus-visible:outline-[var(--color-focus)] ${selected
    ? level === 'primary'
      ? 'border-transparent bg-transparent text-white shadow-sm hover:border-transparent hover:bg-transparent dark:border-transparent dark:bg-transparent dark:hover:border-transparent dark:hover:bg-transparent'
      : 'border-[var(--color-border)] bg-transparent text-[var(--color-text)] shadow-sm hover:border-[var(--color-border)] hover:bg-[var(--color-surface-muted)] dark:border-slate-500 dark:bg-slate-600 dark:text-white dark:hover:border-slate-400 dark:hover:bg-slate-700'
    : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:border-[var(--color-border)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)] dark:border-slate-600 dark:bg-slate-700/70 dark:text-slate-200 dark:hover:border-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'}`
}
