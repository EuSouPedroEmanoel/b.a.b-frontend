import type { ReactNode } from 'react'

type HomeSectionProps = {
  title: string
  description?: string
  emptyText?: string
  children?: ReactNode
}

export function HomeSection({ title, description, emptyText, children }: HomeSectionProps) {
  return (
    <section aria-labelledby={`${title.toLowerCase().replace(/\s+/g, '-')}-heading`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-6">
      <h2 id={`${title.toLowerCase().replace(/\s+/g, '-')}-heading`} className="text-xl font-semibold">{title}</h2>
      {description && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{description}</p>}
      {(children || emptyText) && (
        <div className="mt-4 min-h-28 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 dark:border-slate-600 dark:bg-slate-900/30">
          {children ?? <p className="text-center text-sm text-slate-500 dark:text-slate-400">{emptyText}</p>}
        </div>
      )}
    </section>
  )
}
