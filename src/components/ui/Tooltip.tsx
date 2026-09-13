import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

export function Tooltip({ children, className = '', id, variant = 'default' }: { children: ReactNode; className?: string; id?: string; variant?: 'default' | 'category' }) {
  const tooltipRef = useRef<HTMLSpanElement>(null)
  const [position, setPosition] = useState<{ left: number; top: number }>()
  const categoryClasses = variant === 'category' ? 'border-[#6b4f3a] bg-[#30231d] text-[#f5eee5] shadow-[0_2px_5px_rgba(38,24,16,0.35)] dark:border-slate-600 dark:bg-[#111827] dark:text-slate-100 dark:shadow-[0_2px_5px_rgba(0,0,0,0.5)]' : 'border-slate-300 bg-white text-slate-900 shadow-lg dark:border-slate-600 dark:bg-slate-800 dark:text-white'
  const visibilityClasses = variant === 'category' ? 'group-hover/category:translate-y-0 group-hover/category:opacity-100 group-focus-visible/category:translate-y-0 group-focus-visible/category:opacity-100' : 'group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100'

  useLayoutEffect(() => {
    const tooltip = tooltipRef.current
    const trigger = tooltip?.parentElement
    if (!tooltip || !trigger) return

    const updatePosition = () => {
      const triggerRect = trigger.getBoundingClientRect()
      const tooltipRect = tooltip.getBoundingClientRect()
      const offsetParent = tooltip.offsetParent ?? document.body
      const offsetParentRect = offsetParent.getBoundingClientRect()
      const gap = 8
      const viewportPadding = 8
      const viewportLeft = Math.min(
        Math.max(triggerRect.left + (triggerRect.width - tooltipRect.width) / 2, viewportPadding),
        Math.max(viewportPadding, window.innerWidth - tooltipRect.width - viewportPadding),
      )
      const preferredTop = triggerRect.top - tooltipRect.height - gap
      const viewportTop = preferredTop >= viewportPadding
        ? preferredTop
        : Math.min(triggerRect.bottom + gap, window.innerHeight - tooltipRect.height - viewportPadding)
      setPosition({
        left: viewportLeft - offsetParentRect.left + offsetParent.scrollLeft,
        top: Math.max(viewportPadding, viewportTop) - offsetParentRect.top + offsetParent.scrollTop,
      })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    const resizeObserver = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(updatePosition)
    resizeObserver?.observe(trigger)
    resizeObserver?.observe(tooltip)

    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
      resizeObserver?.disconnect()
    }
  }, [children])

  return <span ref={tooltipRef} id={id} role="tooltip" aria-hidden={id ? undefined : true} style={position ? { left: position.left, top: position.top, right: 'auto', bottom: 'auto', transform: 'none' } : undefined} className={`pointer-events-none absolute z-30 max-h-[calc(100vh-1rem)] w-max max-w-[min(28rem,calc(100vw-1rem))] overflow-y-auto whitespace-normal break-words rounded-md border px-3 py-2 text-xs opacity-0 transition-opacity duration-150 [overflow-wrap:anywhere] ${visibilityClasses} ${categoryClasses} ${className}`}>
    {children}
  </span>
}
