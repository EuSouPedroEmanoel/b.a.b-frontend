import { useEffect, useId, useRef, useState } from 'react'
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

  useEffect(() => {
    const el = containerRef.current
    if (!el || items.length === 0) {
      setVisibleCount(Math.min(items.length, maxVisibleFallback))
      return
    }

    const compute = () => {
      const containerWidth = el.clientWidth
      if (containerWidth === 0) {
        setVisibleCount(Math.min(items.length, maxVisibleFallback))
        return
      }
      // mede quantos cabem em 1 linha (nowrap) reservando espaço para +N
      const measurer = document.createElement('div')
      measurer.style.position = 'absolute'
      measurer.style.visibility = 'hidden'
      measurer.style.pointerEvents = 'none'
      measurer.style.display = 'flex'
      measurer.style.gap = '4px'
      measurer.style.flexWrap = 'nowrap'
      document.body.appendChild(measurer)

      const gap = 4
      let used = 0
      let count = 0
      const plusWidth = 32

      for (let i = 0; i < items.length; i++) {
        const span = document.createElement('span')
        span.className = 'rounded-full px-3 py-0.5 text-xs font-medium whitespace-nowrap border'
        span.textContent = items[i].name
        measurer.appendChild(span)
        const w = span.offsetWidth + (i > 0 ? gap : 0)
        const remaining = items.length - (i + 1)
        const needPlus = remaining > 0 ? plusWidth + gap : 0
        if (used + w + needPlus <= containerWidth || i === 0) {
          used += w
          count = i + 1
          if (remaining === 0) break
          if (used + needPlus > containerWidth && count > 1) {
            if (used + needPlus > containerWidth) {
              count = Math.max(1, i)
              break
            }
          }
        } else {
          break
        }
      }
      document.body.removeChild(measurer)
      setVisibleCount(Math.max(1, Math.min(count, items.length, maxVisible ?? items.length)))
    }

    compute()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(compute) : null
    ro?.observe(el)
    window.addEventListener('resize', compute)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', compute)
    }
  }, [items, maxVisibleFallback, maxVisible])

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
  return (
    <div ref={containerRef} className={`relative flex flex-nowrap gap-1 items-center overflow-visible min-w-0 ${className}`}>
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
          className={
            isDark
              ? 'group/category relative cursor-default shrink-0 whitespace-nowrap rounded-full bg-white/25 px-3 py-0.5 text-xs font-medium text-white border border-white/20 transition-colors duration-200 hover:brightness-110 hover:bg-white/30'
              : 'group/category relative cursor-default shrink-0 whitespace-nowrap rounded-full bg-slate-200 dark:bg-slate-700 px-3 py-0.5 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 transition-colors duration-200 hover:brightness-105 hover:shadow-sm'
          }
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
