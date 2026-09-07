import type { ReactNode } from 'react'

export function Tooltip({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span role="tooltip" aria-hidden="true" className={`absolute bottom-[calc(100%+0.5rem)] left-1/2 z-30 flex -translate-x-1/2 translate-y-1 flex-col items-center whitespace-nowrap rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 opacity-0 shadow-lg transition-opacity duration-150 pointer-events-none group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100 dark:border-slate-600 dark:bg-slate-800 dark:text-white ${className}`}>
    {children}
  </span>
}
