import { useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
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
}

export function OverflowTags({ items, tone = 'neutral', variant = 'light', maxVisibleFallback = 2, className = '', onItemClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [visibleCount, setVisibleCount] = useState<number>(() => Math.min(items.length, maxVisibleFallback))
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
        span.className = 'rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap border'
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
      setVisibleCount(Math.max(1, Math.min(count, items.length)))
    }

    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(el)
    window.addEventListener('resize', compute)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', compute)
    }
  }, [items, maxVisibleFallback])

  if (items.length === 0) return <span className="text-slate-400">—</span>

  const hidden = items.slice(visibleCount)
  const visible = items.slice(0, visibleCount)

  const isDark = variant === 'dark'
  const clickable = !!onItemClick
  return (
    <div ref={containerRef} className={`flex flex-nowrap gap-1 items-center overflow-hidden min-w-0 ${className}`}>
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
            <span key={it.id} title={it.name} {...clickableProps} className={`shrink min-w-0 whitespace-nowrap rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm border border-white/10 max-w-[14ch] truncate overflow-hidden transition-colors duration-200 hover:brightness-110 hover:bg-white/20 ${clickable ? 'cursor-pointer focus-visible:outline-2 focus-visible:outline-white' : ''}`}>
              {it.name}
            </span>
          )
        }
        if (tone === 'info') {
          const bg = isDarkTheme ? stringToHsl(it.name, 65, 28) : stringToHsl(it.name, 65, 82)
          const color = isDarkTheme ? '#fff' : stringToHsl(it.name, 65, 22)
          const border = isDarkTheme ? 'rgba(255,255,255,0.15)' : stringToHsl(it.name, 65, 70)
          return (
            <span key={it.id} title={it.name} style={{ background: bg, color, borderColor: border }} {...clickableProps} className={`shrink min-w-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium border max-w-[12ch] truncate overflow-hidden transition-colors duration-200 hover:brightness-110 hover:shadow-sm ${clickable ? 'cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--color-focus)]' : ''}`}>
              {it.name}
            </span>
          )
        }
        if (tone === 'neutral' && !isDark) {
          const bg = isDarkTheme ? stringToHsl(it.name, 75, 32) : stringToHsl(it.name, 75, 45)
          return (
            <span key={it.id} title={it.name} style={{ background: bg, color: '#fff', borderColor: isDarkTheme ? 'rgba(255,255,255,0.15)' : stringToHsl(it.name, 75, 30) }} {...clickableProps} className={`shrink min-w-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium border max-w-[12ch] truncate overflow-hidden transition-colors duration-200 hover:brightness-110 hover:shadow-sm ${clickable ? 'cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--color-focus)]' : ''}`}>
              {it.name}
            </span>
          )
        }
        return (
          <Badge key={it.id} tone={tone} title={it.name} className="shrink min-w-0 whitespace-nowrap max-w-[12ch] truncate overflow-hidden" onClick={clickable ? (handleClick as any) : undefined} onKeyDown={clickable ? (handleKey as any) : undefined} role={clickable ? 'button' : undefined} tabIndex={clickable ? 0 : undefined}>
            {it.name}
          </Badge>
        )
      })}
      {hidden.length > 0 && (
        <span
          className={
            isDark
              ? 'cursor-default shrink-0 whitespace-nowrap rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-bold text-white border border-white/20 transition-colors duration-200 hover:brightness-110 hover:bg-white/30'
              : 'cursor-default shrink-0 whitespace-nowrap rounded-full bg-slate-200 dark:bg-slate-700 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 transition-colors duration-200 hover:brightness-105 hover:shadow-sm'
          }
          title={hidden.map((h) => h.name).join(', ')}
        >
          +{hidden.length}
        </span>
      )}
    </div>
  )
}
