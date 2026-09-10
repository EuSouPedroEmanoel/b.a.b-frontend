import type { PropsWithChildren } from 'react'

type PageDescriptionProps = PropsWithChildren<{ className?: string }>

export function PageDescription({ children, className }: PageDescriptionProps) {
  return (
    <p className={`mt-1 text-sm leading-[var(--leading-page-description)] text-slate-600 dark:text-slate-300${className ? ` ${className}` : ''}`}>
      {children}
    </p>
  )
}
