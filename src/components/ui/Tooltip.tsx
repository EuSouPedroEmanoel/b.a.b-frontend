import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export function Tooltip({ children, className = '', id, variant = 'default' }: { children: ReactNode; className?: string; id?: string; variant?: 'default' | 'category' }) {
  const tooltipRef = useRef<HTMLSpanElement>(null)
  const triggerRef = useRef<HTMLElement | null>(null)
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)
  const [position, setPosition] = useState<{ left: number; top: number }>()
  const [visible, setVisible] = useState(false)
  const categoryClasses = variant === 'category' ? 'border-[#6b4f3a] bg-[#30231d] text-[#f5eee5] shadow-[0_2px_5px_rgba(38,24,16,0.35)] dark:border-slate-600 dark:bg-[#111827] dark:text-slate-100 dark:shadow-[0_2px_5px_rgba(0,0,0,0.5)]' : 'border-slate-300 bg-white text-slate-900 shadow-lg dark:border-slate-600 dark:bg-slate-800 dark:text-white'
  const visibilityClasses = visible ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0'

  useLayoutEffect(() => {
    const tooltip = tooltipRef.current
    const trigger = triggerRef.current ?? tooltip?.parentElement
    if (!tooltip || !trigger) return
    triggerRef.current = trigger

    if (!portalTarget) {
      // oxlint-disable-next-line react/set-state-in-effect -- move the mounted tooltip out of transformed triggers.
      setPortalTarget(document.body)
      return
    }

    const updatePosition = () => {
      const triggerRect = trigger.getBoundingClientRect()
      const tooltipRect = tooltip.getBoundingClientRect()
      const gap = 8
      const viewportPadding = 8
      const viewportLeft = Math.min(
        Math.max(triggerRect.left + (triggerRect.width - tooltipRect.width) / 2, viewportPadding),
        Math.max(viewportPadding, document.documentElement.clientWidth - tooltipRect.width - viewportPadding),
      )
      const preferredTop = triggerRect.top - tooltipRect.height - gap
      const viewportTop = preferredTop >= viewportPadding
        ? preferredTop
        : Math.min(triggerRect.bottom + gap, window.innerHeight - tooltipRect.height - viewportPadding)
      setPosition({
        left: viewportLeft,
        top: Math.max(viewportPadding, viewportTop),
      })
    }

    if (visible) updatePosition()

    const show = () => {
      updatePosition()
      setVisible(true)
    }
    const hide = () => setVisible(false)
    trigger.addEventListener('mouseenter', show)
    trigger.addEventListener('mouseleave', hide)
    trigger.addEventListener('focusin', show)
    trigger.addEventListener('focusout', hide)
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    const resizeObserver = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(updatePosition)
    resizeObserver?.observe(trigger)

    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
      trigger.removeEventListener('mouseenter', show)
      trigger.removeEventListener('mouseleave', hide)
      trigger.removeEventListener('focusin', show)
      trigger.removeEventListener('focusout', hide)
      resizeObserver?.disconnect()
    }
  }, [children, portalTarget, visible])

  const safePosition = visible && position ? position : { left: 0, top: 0 }

  const tooltip = <span ref={tooltipRef} id={id} role="tooltip" aria-hidden={id ? undefined : true} style={{ left: safePosition.left, top: safePosition.top, right: 'auto', bottom: 'auto', transform: 'none' }} className={`pointer-events-none fixed z-30 max-h-[calc(100vh-1rem)] w-max max-w-[min(28rem,calc(100vw-1rem))] overflow-y-auto whitespace-normal break-words rounded-md border px-3 py-2 text-xs transition-[opacity,transform] duration-150 [overflow-wrap:anywhere] ${visibilityClasses} ${categoryClasses} ${className}`}>
    {children}
  </span>

  return portalTarget ? createPortal(tooltip, portalTarget) : tooltip
}
