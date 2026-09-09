import { useId } from 'react'
import { Tooltip } from './Tooltip'

export const badgeToneClasses: Record<string, string> = {
    neutral: 'bg-[var(--color-surface-muted)] text-[var(--color-text)] dark:bg-slate-700 dark:text-slate-200',
    success: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200',
    warning: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
    danger: 'bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200',
    info: 'bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200',
}

// State token for statuses that must remain distinguishable without hue.
export const accessibleDangerStateClasses = 'bg-red-700 text-white border-red-200 dark:bg-red-600 dark:text-white dark:border-red-200'
export const calendarDangerSubtleClasses = 'bg-slate-100 text-slate-950 border-slate-600 dark:bg-slate-700 dark:text-white dark:border-slate-200'
export const calendarMarkedOutlineClasses = 'bg-transparent text-red-700 border-red-600 dark:bg-transparent dark:text-red-300 dark:border-red-400'
export const dangerSubtleClasses = 'bg-slate-50 text-slate-900 border-l-4 border-l-red-600 border-y-slate-200 border-r-slate-200 dark:bg-slate-700 dark:text-slate-100 dark:border-l-red-400 dark:border-y-slate-600 dark:border-r-slate-600'

export function Badge({ children, tone = 'neutral', className = '', title, onClick, onKeyDown, role, tabIndex }: { children: React.ReactNode; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info'; className?: string; title?: string; onClick?: (e: React.MouseEvent) => void; onKeyDown?: (e: React.KeyboardEvent) => void; role?: string; tabIndex?: number }) {
  const tooltipId = useId()
  const hasTooltip = !!title
  return <span title={undefined} aria-describedby={hasTooltip ? tooltipId : undefined} onClick={onClick as any} onKeyDown={onKeyDown as any} role={role} tabIndex={tabIndex} className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeToneClasses[tone]} ${clickableClass(onClick)} ${className}`}>{children}{hasTooltip && <Tooltip id={tooltipId} variant="category">{title}</Tooltip>}</span>
}

function clickableClass(onClick?: unknown) {
  return onClick ? 'group/category cursor-pointer border border-black/15 shadow-[0_2px_3px_rgba(73,50,32,0.22)] transition-[transform,box-shadow,filter] duration-200 motion-safe:hover:-translate-y-px motion-safe:hover:shadow-[0_3px_5px_rgba(73,50,32,0.28)] active:translate-y-0 active:shadow-[0_1px_1px_rgba(73,50,32,0.2)] dark:border-white/20 dark:shadow-[0_2px_4px_rgba(0,0,0,0.4)] dark:motion-safe:hover:shadow-[0_3px_6px_rgba(0,0,0,0.5)] dark:active:shadow-[0_1px_2px_rgba(0,0,0,0.35)] focus-visible:outline-2 focus-visible:outline-[var(--color-focus)]' : ''
}
