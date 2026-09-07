export const badgeToneClasses: Record<string, string> = {
    neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
    success: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200',
    warning: 'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200',
    danger: 'bg-red-100 text-red-900 dark:bg-red-900/30 dark:text-red-200',
    info: 'bg-sky-100 text-sky-900 dark:bg-sky-900/30 dark:text-sky-200',
}

// State token for statuses that must remain distinguishable without hue.
export const accessibleDangerStateClasses = 'bg-red-700 text-white border-red-200 dark:bg-red-600 dark:text-white dark:border-red-200'
export const calendarDangerSubtleClasses = 'bg-slate-100 text-slate-950 border-slate-600 dark:bg-slate-700 dark:text-white dark:border-slate-200'
export const calendarMarkedOutlineClasses = 'bg-transparent text-red-700 border-red-600 dark:bg-transparent dark:text-red-300 dark:border-red-400'
export const dangerSubtleClasses = 'bg-slate-50 text-slate-900 border-l-4 border-l-red-600 border-y-slate-200 border-r-slate-200 dark:bg-slate-700 dark:text-slate-100 dark:border-l-red-400 dark:border-y-slate-600 dark:border-r-slate-600'

export function Badge({ children, tone = 'neutral', className = '', title, onClick, onKeyDown, role, tabIndex }: { children: React.ReactNode; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info'; className?: string; title?: string; onClick?: (e: React.MouseEvent) => void; onKeyDown?: (e: React.KeyboardEvent) => void; role?: string; tabIndex?: number }) {
  return <span title={title} onClick={onClick as any} onKeyDown={onKeyDown as any} role={role} tabIndex={tabIndex} className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors duration-200 hover:brightness-110 hover:shadow-sm ${clickableClass(onClick)} ${badgeToneClasses[tone]} ${className}`}>{children}</span>
}

function clickableClass(onClick?: unknown) {
  return onClick ? 'cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--color-focus)]' : ''
}
