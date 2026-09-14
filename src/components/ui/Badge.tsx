import { useId } from 'react'
import { Tooltip } from './Tooltip'
import { badgeToneClasses } from './Badge.styles'

export function Badge({ children, tone = 'neutral', className = '', title, onClick, onKeyDown, role, tabIndex }: { children: React.ReactNode; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info'; className?: string; title?: string; onClick?: (e: React.MouseEvent) => void; onKeyDown?: (e: React.KeyboardEvent) => void; role?: string; tabIndex?: number }) {
  const tooltipId = useId()
  const hasTooltip = !!title
  return <span title={undefined} aria-describedby={hasTooltip ? tooltipId : undefined} onClick={onClick as any} onKeyDown={onKeyDown as any} role={role} tabIndex={tabIndex} className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeToneClasses[tone]} ${clickableClass(onClick)} ${className}`}>{children}{hasTooltip && <Tooltip id={tooltipId} variant="category">{title}</Tooltip>}</span>
}

function clickableClass(onClick?: unknown) {
  return onClick ? 'group/category cursor-pointer border border-black/15 shadow-[0_2px_3px_rgba(73,50,32,0.22)] transition-[transform,box-shadow,filter] duration-200 motion-safe:hover:-translate-y-px motion-safe:hover:shadow-[0_3px_5px_rgba(73,50,32,0.28)] active:translate-y-0 active:shadow-[0_1px_1px_rgba(73,50,32,0.2)] dark:border-white/20 dark:shadow-[0_2px_4px_rgba(0,0,0,0.4)] dark:motion-safe:hover:shadow-[0_3px_6px_rgba(0,0,0,0.5)] dark:active:shadow-[0_1px_2px_rgba(0,0,0,0.35)] focus-visible:outline-2 focus-visible:outline-[var(--color-focus)]' : ''
}
