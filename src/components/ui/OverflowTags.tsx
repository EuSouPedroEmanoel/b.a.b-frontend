import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Tooltip } from '@/components/ui/Tooltip'
import { stringToHsl } from '@/lib/coverColor'
import { useTheme } from '@/hooks/useTheme'

type Item = { id: number; name: string }

type Props = {
  items: Item[]
  tone?: 'info' | 'neutral'
  variant?: 'light' | 'dark'
  maxVisibleFallback?: number
  className?: string
  onItemClick?: (item: Item) => void
  itemMaxWidthClass?: string
  maxVisible?: number
  hiddenLabel?: string
}

export function OverflowTags({ items, tone = 'neutral', variant = 'light', maxVisibleFallback = 2, className = '', onItemClick, itemMaxWidthClass = 'max-w-[12ch]', maxVisible, hiddenLabel = 'itens adicionais' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [visibleCount, setVisibleCount] = useState<number>(() => Math.min(items.length, maxVisibleFallback))
  const [expanded, setExpanded] = useState(false)
  const overflowButtonRef = useRef<HTMLButtonElement>(null)
  const measurementRef = useRef<HTMLDivElement>(null)
  const overflowId = `overflow-tags-${useId().replace(/:/g, '')}`
  let resolved: 'light' | 'dark' = 'light'
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const theme = useTheme()
    resolved = theme.resolved
  } catch {
    resolved = 'light'
  }
  const isDarkTheme = resolved === 'dark'

  useLayoutEffect(() => {
    const el = containerRef.current
    const measurement = measurementRef.current
    if (!el || !measurement || items.length === 0) {
      setVisibleCount((current) => {
        const next = Math.min(items.length, maxVisibleFallback)
        return current === next ? current : next
      })
      return
    }

    const compute = () => {
      const containerWidth = el.clientWidth
      if (containerWidth === 0) {
        setVisibleCount((current) => {
          const next = Math.min(items.length, maxVisibleFallback)
          return current === next ? current : next
        })
        return
      }
      const styles = getComputedStyle(el)
      const gap = Number.parseFloat(styles.columnGap || styles.gap) || 0
      const measuredTags = Array.from(measurement.querySelectorAll<HTMLElement>('[data-overflow-tag-measure]'))
      const measuredOverflowButtons = new Map(
        Array.from(measurement.querySelectorAll<HTMLButtonElement>('[data-overflow-count]'))
          .map((button) => [Number(button.dataset.overflowCount), button] as const),
      )
      const tagWidths = measuredTags.map((tag) => tag.getBoundingClientRect().width || tag.offsetWidth)
      const limit = Math.min(items.length, maxVisible ?? items.length)
      let nextCount = 0

      for (let count = limit; count >= 0; count -= 1) {
        const hiddenCount = items.length - count
        const tagsWidth = tagWidths.slice(0, count).reduce((total, width) => total + width, 0)
        const tagsGap = count > 1 ? (count - 1) * gap : 0
        const overflowButton = hiddenCount > 0 ? measuredOverflowButtons.get(hiddenCount) : undefined
        const overflowWidth = overflowButton?.getBoundingClientRect().width || overflowButton?.offsetWidth || 0
        const overflowGap = hiddenCount > 0 ? gap : 0
        const requiredWidth = tagsWidth + tagsGap + overflowGap + overflowWidth

        if (requiredWidth <= containerWidth) {
          nextCount = count
          break
        }
      }

      if (nextCount === 0 && items.length > 0 && !measuredOverflowButtons.has(items.length)) {
        nextCount = 1
      }
      setVisibleCount((current) => current === nextCount ? current : nextCount)
    }

    compute()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(compute) : null
    ro?.observe(el)
    if (ro) Array.from(measurement.children).forEach((child) => ro.observe(child))
    window.addEventListener('resize', compute)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', compute)
    }
  }, [items, maxVisibleFallback, maxVisible, itemMaxWidthClass, tone, variant, isDarkTheme])

  const visible = items.slice(0, maxVisible ? Math.min(visibleCount, maxVisible) : visibleCount)
  const hidden = items.slice(visible.length)

  useEffect(() => {
    if (!expanded) return
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setExpanded(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setExpanded(false)
        overflowButtonRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [expanded])

  if (items.length === 0) return <span className="text-slate-400">—</span>

  const isDark = variant === 'dark'
  const clickable = !!onItemClick
  const overflowButtonClass = isDark
    ? 'group/category relative cursor-default shrink-0 whitespace-nowrap rounded-full bg-white/25 px-3 py-0.5 text-xs font-medium text-white border border-white/20 transition-colors duration-200 hover:brightness-110 hover:bg-white/30'
    : 'group/category relative cursor-default shrink-0 whitespace-nowrap rounded-full bg-slate-200 dark:bg-slate-700 px-3 py-0.5 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 transition-colors duration-200 hover:brightness-105 hover:shadow-sm'
  return (
    <div ref={containerRef} className={`relative flex flex-nowrap gap-1 items-center overflow-visible min-w-0 ${className}`}>
      <div ref={measurementRef} aria-hidden="true" className="pointer-events-none absolute left-0 top-0 flex h-0 w-0 invisible flex-nowrap gap-1 overflow-clip whitespace-nowrap">
        {items.map((item) => <span key={item.id} data-overflow-tag-measure={item.name} className={`shrink-0 rounded-full px-3 py-0.5 text-xs font-medium whitespace-nowrap border after:content-[attr(data-overflow-tag-measure)] ${itemMaxWidthClass}`} />)}
        {Array.from({ length: Math.max(0, items.length - 1) }, (_, index) => {
          const hiddenCount = index + 1
          return <button key={hiddenCount} type="button" data-overflow-count={hiddenCount} className={overflowButtonClass}>+{hiddenCount}</button>
        })}
      </div>
      {visible.map((it) => {
        const handleClick = (e: React.MouseEvent) => {
          e.stopPropagation()
          onItemClick?.(it)
        }
        const handleKey = (e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            e.stopPropagation()
            onItemClick?.(it)
          }
        }
        const clickableProps = clickable
          ? {
              role: 'button' as const,
              tabIndex: 0,
              onClick: handleClick,
              onKeyDown: handleKey,
            }
          : {}
        if (isDark) {
          return (
            <span key={it.id} title={clickable ? undefined : it.name} {...clickableProps} className={`group/category relative shrink min-w-0 whitespace-nowrap rounded-full bg-white/15 px-3 py-0.5 text-xs font-medium text-white backdrop-blur-sm border border-white/10 max-w-[14ch] truncate overflow-visible transition-colors duration-200 hover:brightness-110 hover:bg-white/20 ${clickable ? 'cursor-pointer focus-visible:outline-2 focus-visible:outline-white' : ''}`}>
              {it.name}{clickable && <Tooltip variant="category">{it.name}</Tooltip>}
            </span>
          )
        }
        if (tone === 'info') {
          const bg = isDarkTheme ? stringToHsl(it.name, 65, 28) : stringToHsl(it.name, 65, 82)
          const color = isDarkTheme ? '#fff' : stringToHsl(it.name, 65, 22)
          const border = isDarkTheme ? 'rgba(255,255,255,0.15)' : stringToHsl(it.name, 65, 58)
          return (
            <span key={it.id} title={undefined} aria-describedby={clickable ? `tag-tooltip-${it.id}` : undefined} style={{ background: bg, color, borderColor: border }} {...clickableProps} className={`group/category relative shrink min-w-0 whitespace-nowrap rounded-full px-3 py-0.5 text-xs font-medium border ${itemMaxWidthClass} truncate overflow-visible transition-colors duration-200 hover:brightness-110 hover:shadow-sm ${!isDarkTheme ? 'shadow-[0_1px_2px_rgba(73,50,32,0.18)]' : ''} ${clickable ? 'cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--color-focus)]' : ''}`}>
              {it.name}{clickable && <Tooltip id={`tag-tooltip-${it.id}`} variant="category">{it.name}</Tooltip>}
            </span>
          )
        }
        if (tone === 'neutral' && !isDark) {
          const bg = isDarkTheme ? stringToHsl(it.name, 75, 32) : stringToHsl(it.name, 75, 45)
          return (
            <span key={it.id} title={undefined} aria-describedby={clickable ? `tag-tooltip-${it.id}` : undefined} style={{ background: bg, color: '#fff', borderColor: isDarkTheme ? 'rgba(255,255,255,0.15)' : stringToHsl(it.name, 75, 30) }} {...clickableProps} className={`group/category relative shrink min-w-0 whitespace-nowrap rounded-full px-3 py-0.5 text-xs font-medium border ${itemMaxWidthClass} truncate overflow-visible transition-colors duration-200 hover:brightness-110 hover:shadow-sm ${clickable ? 'cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--color-focus)]' : ''}`}>
              {it.name}{clickable && <Tooltip id={`tag-tooltip-${it.id}`} variant="category">{it.name}</Tooltip>}
            </span>
          )
        }
        return (
          <Badge key={it.id} tone={tone} title={it.name} className={`shrink min-w-0 whitespace-nowrap ${itemMaxWidthClass} truncate overflow-hidden`} onClick={clickable ? (handleClick as any) : undefined} onKeyDown={clickable ? (handleKey as any) : undefined} role={clickable ? 'button' : undefined} tabIndex={clickable ? 0 : undefined}>
            {it.name}
          </Badge>
        )
      })}
      {hidden.length > 0 && (
        <>
        <button
          ref={overflowButtonRef}
          type="button"
          aria-expanded={expanded}
          aria-controls={overflowId}
          aria-label={`Mostrar ${hidden.length} ${hiddenLabel}`}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            setExpanded((value) => !value)
          }}
          className={overflowButtonClass}
        >+{hidden.length}<Tooltip variant="category">{hidden.map((h) => h.name).join(', ')}</Tooltip></button>
        {expanded && <div id={overflowId} role="dialog" aria-label={hiddenLabel} className="absolute bottom-full right-0 z-50 mb-2 max-w-[min(18rem,calc(100vw-2rem))] rounded-lg border border-slate-200 bg-white p-2 text-xs shadow-xl dark:border-slate-600 dark:bg-slate-800">
          <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto" role="list">
            {hidden.map((item) => <li key={item.id} className="rounded px-2 py-1 text-slate-700 dark:text-slate-200">{item.name}</li>)}
          </ul>
        </div>}
        </>
      )}
    </div>
  )
}
