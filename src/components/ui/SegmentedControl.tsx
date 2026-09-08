export const segmentedControlContainerClasses = 'relative flex w-full gap-1 overflow-hidden rounded-lg border border-slate-300 bg-slate-100 p-1 dark:border-slate-600 dark:bg-slate-800'

export function segmentedControlIndicatorClasses(level: 'primary' | 'secondary', index: number) {
  return `pointer-events-none absolute inset-y-1 left-1 z-0 w-[calc(50%-0.25rem)] rounded-md border transition-transform duration-200 ease-out motion-reduce:transition-none ${index === 1 ? 'translate-x-full' : 'translate-x-0'} ${level === 'primary' ? 'border-blue-300 bg-blue-900 dark:border-blue-300 dark:bg-blue-900' : 'border-slate-500 bg-slate-700 dark:border-slate-500 dark:bg-slate-600'}`
}

export function segmentedControlItemClasses(selected: boolean, level: 'primary' | 'secondary' = 'secondary') {
  return `relative z-10 min-h-11 flex-1 rounded-md border px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-3 focus-visible:outline-[var(--color-focus)] ${selected
    ? level === 'primary'
      ? 'border-transparent bg-transparent text-white shadow-sm hover:border-transparent hover:bg-transparent dark:border-transparent dark:bg-transparent dark:hover:border-transparent dark:hover:bg-transparent'
      : 'border-slate-500 bg-slate-700 text-white shadow-sm hover:border-slate-400 hover:bg-slate-800 dark:border-slate-500 dark:bg-slate-600 dark:hover:border-slate-400 dark:hover:bg-slate-700'
    : 'border-slate-400 bg-slate-300 text-slate-800 hover:border-slate-500 hover:bg-slate-400 hover:text-slate-950 dark:border-slate-600 dark:bg-slate-700/70 dark:text-slate-200 dark:hover:border-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'}`
}
