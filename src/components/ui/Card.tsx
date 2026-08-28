import type { ReactNode } from 'react'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`card rounded-xl border bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 shadow-md dark:shadow-none hover:shadow-lg transition-shadow duration-300 ${className}`}
    >
      {children}
    </div>
  )
}
export function CardHeader({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700 ${className}`}>{children}</div>
}
export function CardBody({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`p-4 sm:p-6 ${className}`}>{children}</div>
}
