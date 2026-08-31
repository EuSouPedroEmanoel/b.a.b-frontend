export function Badge({ children, tone = 'neutral', className = '', title, onClick, onKeyDown, role, tabIndex }: { children: React.ReactNode; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info'; className?: string; title?: string; onClick?: (e: React.MouseEvent) => void; onKeyDown?: (e: React.KeyboardEvent) => void; role?: string; tabIndex?: number }) {
  const tones: Record<string, string> = {
    neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
    success: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200',
    warning: 'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200',
    danger: 'bg-red-100 text-red-900 dark:bg-red-900/30 dark:text-red-200',
    info: 'bg-sky-100 text-sky-900 dark:bg-sky-900/30 dark:text-sky-200',
  }
  return <span title={title} onClick={onClick as any} onKeyDown={onKeyDown as any} role={role} tabIndex={tabIndex} className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors duration-200 hover:brightness-110 hover:shadow-sm ${clickableClass(onClick)} ${tones[tone]} ${className}`}>{children}</span>
}

function clickableClass(onClick?: unknown) {
  return onClick ? 'cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--color-focus)]' : ''
}
