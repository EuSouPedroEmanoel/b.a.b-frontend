import { useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/Badge'

type Item = { id: number; name: string }

type Props = {
  items: Item[]
  tone?: 'info' | 'neutral'
  variant?: 'light' | 'dark'
  maxVisibleFallback?: number
  className?: string
}

export function OverflowTags({ items, tone = 'neutral', variant = 'light', maxVisibleFallback = 2, className = '' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [visibleCount, setVisibleCount] = useState<number>(() => Math.min(items.length, maxVisibleFallback))

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
  return (
    <div ref={containerRef} className={`flex flex-nowrap gap-1 items-center overflow-hidden ${className}`}>
      {visible.map((it) =>
        isDark ? (
          <span key={it.id} className="shrink-0 whitespace-nowrap rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm border border-white/10">
            {it.name}
          </span>
        ) : (
          <Badge key={it.id} tone={tone} className="shrink-0 whitespace-nowrap">
            {it.name}
          </Badge>
        ),
      )}
      {hidden.length > 0 && (
        <span
          className={
            isDark
              ? 'cursor-default shrink-0 whitespace-nowrap rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-bold text-white border border-white/20'
              : 'cursor-default shrink-0 whitespace-nowrap rounded-full bg-slate-200 dark:bg-slate-700 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600'
          }
          title={hidden.map((h) => h.name).join(', ')}
        >
          +{hidden.length}
        </span>
      )}
    </div>
  )
}
