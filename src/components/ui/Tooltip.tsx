import type { ReactNode } from 'react'

export function Tooltip({ children, className = '', id, variant = 'default' }: { children: ReactNode; className?: string; id?: string; variant?: 'default' | 'category' }) {
  const categoryClasses = variant === 'category' ? 'border-[#6b4f3a] bg-[#30231d] text-[#f5eee5] shadow-[0_2px_5px_rgba(38,24,16,0.35)] dark:border-slate-600 dark:bg-[#111827] dark:text-slate-100 dark:shadow-[0_2px_5px_rgba(0,0,0,0.5)]' : 'border-slate-300 bg-white text-slate-900 shadow-lg dark:border-slate-600 dark:bg-slate-800 dark:text-white'
  const visibilityClasses = variant === 'category' ? 'group-hover/category:translate-y-0 group-hover/category:opacity-100 group-focus-visible/category:translate-y-0 group-focus-visible/category:opacity-100' : 'group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100'
  return <span id={id} role="tooltip" aria-hidden={id ? undefined : true} className={`pointer-events-none absolute bottom-[calc(100%+0.5rem)] left-1/2 z-30 -translate-x-1/2 translate-y-1 whitespace-nowrap rounded-md border px-3 py-2 text-xs opacity-0 transition-opacity duration-150 ${visibilityClasses} ${categoryClasses} ${className}`}>
    {children}
  </span>
}
