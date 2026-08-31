import { useCallback, useRef, useState, useEffect, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

type CarouselProps<T> = {
  title: string
  items: T[]
  renderItem: (item: T, index: number) => ReactNode
  ariaLabel?: string
  id?: string
  emptyText?: string
  circular?: boolean
}

export function Carousel<T>({ title, items, renderItem, ariaLabel, id, emptyText, circular = false }: CarouselProps<T>) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(false)

  const update = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    const hasOverflow = el.scrollWidth > el.clientWidth + 8
    if (circular && hasOverflow) {
      setCanPrev(true)
      setCanNext(true)
    } else {
      setCanPrev(el.scrollLeft > 8)
      setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 8)
    }
  }, [circular])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    update()
    el.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    // sempre metade à esquerda/direita: offset inicial meia peça
    if (circular && el.scrollWidth > el.clientWidth + 8) {
      const halfCard = 80
      if (el.scrollLeft === 0) {
        el.scrollLeft = halfCard
        // garante snap inicial com peek
        requestAnimationFrame(() => update())
      }
    }
    return () => {
      el.removeEventListener('scroll', update)
      ro.disconnect()
    }
  }, [update, items, circular])

  const scroll = (dir: 'prev' | 'next') => {
    const el = scrollerRef.current
    if (!el) return
    const maxScroll = el.scrollWidth - el.clientWidth
    const amount = Math.round(el.clientWidth * 0.85)
    const atStart = el.scrollLeft <= 12
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 12
    if (circular && maxScroll > 8) {
      if (dir === 'next') {
        if (atEnd) {
          el.scrollTo({ left: 0, behavior: 'smooth' })
          return
        }
        const nextLeft = el.scrollLeft + amount
        if (nextLeft >= maxScroll - 8) {
          // garante wrap mesmo se não estiver exatamente no fim (evita travar no último snap)
          el.scrollTo({ left: 0, behavior: 'smooth' })
          return
        }
      } else {
        if (atStart) {
          el.scrollTo({ left: maxScroll, behavior: 'smooth' })
          return
        }
        const prevLeft = el.scrollLeft - amount
        if (prevLeft <= 8) {
          el.scrollTo({ left: maxScroll, behavior: 'smooth' })
          return
        }
      }
    }
    el.scrollBy({ left: dir === 'next' ? amount : -amount, behavior: 'smooth' })
  }

  const titleId = id ?? `carousel-${title.replace(/\s+/g, '-').toLowerCase()}`

  if (items.length === 0) {
    return (
      <section aria-labelledby={titleId} className="w-full">
        <h2 id={titleId} className="text-lg font-semibold text-slate-900 dark:text-white mb-3">
          {title}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">{emptyText ?? 'Nenhum item disponível.'}</p>
      </section>
    )
  }

  return (
    <section aria-labelledby={titleId} aria-label={ariaLabel ?? title} className="w-full">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 id={titleId} className="text-lg font-semibold text-slate-900 dark:text-white">
          {title}
        </h2>
        <div className="hidden sm:flex items-center gap-2">
          <button
            type="button"
            aria-label="Anterior"
            onClick={() => scroll('prev')}
            disabled={!canPrev}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-[var(--color-focus)] transition-colors"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Próximo"
            onClick={() => scroll('next')}
            disabled={!canNext}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-[var(--color-focus)] transition-colors"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="relative overflow-visible">
        <div
          ref={scrollerRef}
          role="region"
          aria-roledescription="carrossel"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') {
              e.preventDefault()
              scroll('next')
            } else if (e.key === 'ArrowLeft') {
              e.preventDefault()
              scroll('prev')
            }
          }}
          className="flex gap-4 overflow-x-auto overflow-visible scroll-smooth snap-x snap-mandatory [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden px-1 py-6 scroll-px-20 focus-visible:outline-2 focus-visible:outline-[var(--color-focus)]"
          style={{ WebkitOverflowScrolling: 'touch', overflowY: 'visible', scrollPaddingInline: '80px' }}
        >
          {items.map((item, idx) => (
            <div key={(item as any)?.id ?? idx} className="snap-start shrink-0">
              {renderItem(item, idx)}
            </div>
          ))}
        </div>

        {/* setas mobile overlay - z-10 < navbar 40 e filtro 30 */}
        <button
          type="button"
          aria-label="Anterior"
          onClick={() => scroll('prev')}
          className="sm:hidden absolute left-0 top-1/2 -translate-y-1/2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-600 shadow hover:bg-white disabled:opacity-0 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-[var(--color-focus)]"
          style={{ opacity: canPrev ? 1 : 0, pointerEvents: canPrev ? 'auto' : 'none' }}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Próximo"
          onClick={() => scroll('next')}
          className="sm:hidden absolute right-0 top-1/2 -translate-y-1/2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-600 shadow hover:bg-white disabled:opacity-0 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-[var(--color-focus)]"
          style={{ opacity: canNext ? 1 : 0, pointerEvents: canNext ? 'auto' : 'none' }}
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </section>
  )
}
