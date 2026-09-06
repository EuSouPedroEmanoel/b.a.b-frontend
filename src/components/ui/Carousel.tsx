import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
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

const TOLERANCE = 2
const DEFAULT_GAP = 12
const NAVIGATION_DURATION = 280
const NAVIGATION_SCALE = 0.86
const NAVIGATION_OPACITY = 0.72

const normalize = (index: number, total: number) => (
  total ? ((index % total) + total) % total : 0
)

function visibleItemsThatFit(widths: number[], available: number, gap: number) {
  if (!widths.length || available <= 0) return 0

  // A maior largura garante que qualquer grupo modular caiba inteiro.
  const cardWidth = Math.max(...widths)
  return Math.max(1, Math.min(widths.length, Math.floor((available + gap + TOLERANCE) / (cardWidth + gap))))
}

export function Carousel<T>({
  title,
  items,
  renderItem,
  ariaLabel,
  id,
  emptyText,
  circular = false,
}: CarouselProps<T>) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const measurementRef = useRef<HTMLDivElement>(null)
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [viewportWidth, setViewportWidth] = useState(0)
  const [widths, setWidths] = useState<number[]>([])
  const [gap, setGap] = useState(DEFAULT_GAP)
  const [slideOffset, setSlideOffset] = useState(0)
  const [animating, setAnimating] = useState(false)
  const [motionPhase, setMotionPhase] = useState<'idle' | 'prepare' | 'running'>('idle')
  const [reducedMotion, setReducedMotion] = useState(false)
  const animationFrameRef = useRef<number | null>(null)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(media.matches)
    update()
    media.addEventListener?.('change', update)
    return () => media.removeEventListener?.('change', update)
  }, [])

  useEffect(() => () => {
    if (animationFrameRef.current !== null) window.cancelAnimationFrame(animationFrameRef.current)
  }, [])

  const updateScroll = useCallback(() => {
    const element = scrollerRef.current
    if (!element) return
    const maxScrollLeft = Math.max(element.scrollWidth - element.clientWidth, 0)
    setCanPrev(element.scrollLeft > TOLERANCE)
    setCanNext(element.scrollLeft < maxScrollLeft - TOLERANCE)
  }, [])

  const measure = useCallback(() => {
    const viewport = viewportRef.current
    const row = measurementRef.current
    if (!viewport || !row) return

    const measuredWidths = Array.from(row.children).map((child) => {
      const element = child as HTMLElement
      return element.getBoundingClientRect().width || element.offsetWidth
    })
    if (measuredWidths.length !== items.length || !measuredWidths.every((width) => width > 0)) return

    const computedStyle = window.getComputedStyle(row)
    const measuredGap = Number.parseFloat(computedStyle.columnGap || computedStyle.gap)
    setWidths(measuredWidths)
    setViewportWidth(viewport.clientWidth)
    setGap(Number.isFinite(measuredGap) ? measuredGap : DEFAULT_GAP)
  }, [items.length])

  useEffect(() => {
    setActiveIndex((current) => normalize(current, items.length))
  }, [items.length])

  useEffect(() => {
    if (!circular) return undefined
    const viewport = viewportRef.current
    const row = measurementRef.current
    if (!viewport || !row) return undefined

    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(measure)
    observer.observe(viewport)
    observer.observe(row)
    Array.from(row.children).forEach((child) => observer.observe(child))
    return () => observer.disconnect()
  }, [circular, items, measure])

  useEffect(() => {
    const element = scrollerRef.current
    if (!element || circular) return undefined

    updateScroll()
    element.addEventListener('scroll', updateScroll, { passive: true })
    if (typeof ResizeObserver === 'undefined') return () => element.removeEventListener('scroll', updateScroll)

    const observer = new ResizeObserver(updateScroll)
    observer.observe(element)
    return () => {
      element.removeEventListener('scroll', updateScroll)
      observer.disconnect()
    }
  }, [circular, items, updateScroll])

  const layout = useMemo(() => {
    if (!circular || widths.length !== items.length || viewportWidth <= 0) return { active: false, visibleCount: 0 }
    const visibleCount = visibleItemsThatFit(widths, viewportWidth, gap)
    return { active: items.length > visibleCount, visibleCount }
  }, [circular, gap, items.length, viewportWidth, widths])

  useEffect(() => {
    if (!circular) return
    setCanPrev(layout.active)
    setCanNext(layout.active)
  }, [circular, layout.active])

  const scroll = (direction: 'prev' | 'next') => {
    if (layout.active) {
      if (animating) return
      setSlideOffset(direction === 'next' ? -1 : 1)
      setAnimating(true)
      setMotionPhase('prepare')
      // Dois frames garantem que o estado inicial reduzido seja pintado antes
      // de iniciar o zoom-in, evitando o salto visual de uma troca instantânea.
      animationFrameRef.current = window.requestAnimationFrame(() => {
        animationFrameRef.current = window.requestAnimationFrame(() => {
          setMotionPhase('running')
          animationFrameRef.current = null
        })
      })
      return
    }

    const element = scrollerRef.current
    if (!element) return
    const maxScrollLeft = Math.max(element.scrollWidth - element.clientWidth, 0)
    if (maxScrollLeft <= TOLERANCE) return

    const current = Math.min(Math.max(element.scrollLeft, 0), maxScrollLeft)
    const distance = Math.round(element.clientWidth * 0.85)
    element.scrollTo({
      left: direction === 'next' ? Math.min(current + distance, maxScrollLeft) : Math.max(current - distance, 0),
      behavior: 'smooth',
    })
  }

  const titleId = id ?? `carousel-${title.replace(/\s+/g, '-').toLowerCase()}`
  if (!items.length) {
    return <section aria-labelledby={titleId} className="w-full"><h2 id={titleId} className="mb-3 text-lg font-semibold text-slate-900 dark:text-white">{title}</h2><p className="text-sm text-slate-500 dark:text-slate-400">{emptyText ?? 'Nenhum item disponível.'}</p></section>
  }

  const circularActive = layout.active
  const group = (start: number) => (
    circularActive
      ? Array.from({ length: layout.visibleCount }, (_, offset) => {
          const index = normalize(start + offset, items.length)
          return { item: items[index], index }
        })
      : items.map((item, index) => ({ item, index }))
  )

  const renderPane = (start: number, hidden: boolean, role: 'current' | 'entering' | 'outgoing' | 'idle') => {
    const entering = role === 'entering'
    const outgoing = role === 'outgoing'
    const dimmed = !reducedMotion && animating && (entering || outgoing)
    const enteringPrepared = entering && motionPhase === 'prepare'
    // A animação vive no wrapper do card e é independente do carregamento da capa.
    // Assim placeholder, fallback e imagem real entram com o mesmo zoom.
    const cardScale = dimmed && (outgoing || enteringPrepared) ? NAVIGATION_SCALE : 1
    const cardOpacity = dimmed && (outgoing || enteringPrepared) ? NAVIGATION_OPACITY : 1
    const cardTransition = !reducedMotion && motionPhase !== 'idle'
      ? `transform ${NAVIGATION_DURATION}ms cubic-bezier(0.22, 0.61, 0.36, 1), opacity ${NAVIGATION_DURATION}ms cubic-bezier(0.22, 0.61, 0.36, 1)`
      : 'none'

    return (
    <div aria-hidden={hidden ? 'true' : undefined} inert={hidden || undefined} className="shrink-0" style={{ width: `${viewportWidth}px` }}>
      <div className="flex items-start gap-3 py-6" style={{ width: `${viewportWidth}px` }}>
        {group(start).map(({ item, index }) => {
          const itemId = (item as { id?: string | number })?.id ?? index
          return <div key={`carousel-item-${itemId}`} data-carousel-card="true" className="shrink-0" style={{ transform: `scale(${cardScale})`, opacity: cardOpacity, transformOrigin: 'center center', transition: cardTransition, willChange: animating ? 'transform, opacity' : undefined }}>{renderItem(item, index)}</div>
        })}
      </div>
    </div>
    )
  }

  const handleKeyboard = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    event.preventDefault()
    scroll(event.key === 'ArrowRight' ? 'next' : 'prev')
  }

  const handleTransitionEnd = (event: React.TransitionEvent<HTMLDivElement>) => {
    if (!animating || event.target !== event.currentTarget || !layout.active) return
    const offset = slideOffset < 0 ? layout.visibleCount : -layout.visibleCount
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    setActiveIndex((current) => normalize(current + offset, items.length))
    setSlideOffset(0)
    setMotionPhase('idle')
    setAnimating(false)
  }

  return <section aria-labelledby={titleId} aria-label={ariaLabel ?? title} className="w-full">
    <div className="mb-3 flex items-center justify-between gap-3"><h2 id={titleId} className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2><div className="hidden items-center gap-2 sm:flex"><button type="button" aria-label="Anterior" onClick={() => scroll('prev')} disabled={!canPrev || animating} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-[var(--color-focus)] disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"><ChevronLeft className="h-5 w-5" aria-hidden="true" /></button><button type="button" aria-label="Próximo" onClick={() => scroll('next')} disabled={!canNext || animating} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-[var(--color-focus)] disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"><ChevronRight className="h-5 w-5" aria-hidden="true" /></button></div></div>
    <div ref={viewportRef} className="relative overflow-hidden">
      {circular && <div ref={measurementRef} aria-hidden="true" inert={true} className="pointer-events-none absolute left-0 top-0 flex w-max gap-3 opacity-0" style={{ visibility: 'hidden' }}>{items.map((item, index) => <div key={`measure-${index}`} className="shrink-0">{renderItem(item, index)}</div>)}</div>}
      {circularActive ? <div role="region" aria-roledescription="carrossel" tabIndex={0} onKeyDown={handleKeyboard} className="overflow-hidden focus-visible:outline-2 focus-visible:outline-[var(--color-focus)]" data-carousel-circular="true"><div onTransitionEnd={handleTransitionEnd} data-carousel-track="true" className="flex" style={{ width: `${viewportWidth * 3}px`, transform: `translateX(${(-viewportWidth) + (slideOffset * viewportWidth)}px)`, transition: !reducedMotion && motionPhase !== 'idle' ? `transform ${NAVIGATION_DURATION}ms cubic-bezier(0.22, 0.61, 0.36, 1)` : 'none' }}>{renderPane(normalize(activeIndex - layout.visibleCount, items.length), true, slideOffset > 0 ? 'entering' : 'idle')}{renderPane(activeIndex, false, animating ? 'outgoing' : 'current')}{renderPane(normalize(activeIndex + layout.visibleCount, items.length), true, slideOffset < 0 ? 'entering' : 'idle')}</div></div> : <div ref={scrollerRef} role="region" aria-roledescription="carrossel" tabIndex={0} onKeyDown={handleKeyboard} className="flex gap-3 overflow-x-auto overflow-y-visible scroll-smooth snap-x snap-mandatory px-1 py-6 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden focus-visible:outline-2 focus-visible:outline-[var(--color-focus)]" style={{ WebkitOverflowScrolling: 'touch' }}>{group(0).map(({ item, index }) => <div key={(item as { id?: string | number })?.id ?? index} className="shrink-0 snap-start">{renderItem(item, index)}</div>)}</div>}
      <button type="button" aria-label="Anterior" onClick={() => scroll('prev')} className="absolute left-0 top-1/2 z-10 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/90 shadow focus-visible:outline-2 focus-visible:outline-[var(--color-focus)] dark:border-slate-600 dark:bg-slate-800/90 sm:hidden" style={{ opacity: canPrev && !animating ? 1 : 0, pointerEvents: canPrev && !animating ? 'auto' : 'none' }}><ChevronLeft className="h-4 w-4" aria-hidden="true" /></button><button type="button" aria-label="Próximo" onClick={() => scroll('next')} className="absolute right-0 top-1/2 z-10 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/90 shadow focus-visible:outline-2 focus-visible:outline-[var(--color-focus)] dark:border-slate-600 dark:bg-slate-800/90 sm:hidden" style={{ opacity: canNext && !animating ? 1 : 0, pointerEvents: canNext && !animating ? 'auto' : 'none' }}><ChevronRight className="h-4 w-4" aria-hidden="true" /></button>
    </div>
  </section>
}
