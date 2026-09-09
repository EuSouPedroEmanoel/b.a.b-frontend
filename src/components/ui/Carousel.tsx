import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

type CarouselProps<T> = { title: string; items: T[]; renderItem: (item: T, index: number) => ReactNode; ariaLabel?: string; id?: string; emptyText?: string; circular?: boolean }

const TOLERANCE = 2
const DEFAULT_GAP = 12
const NAVIGATION_DURATION = 280
const CIRCULAR_CYCLES = 3
const normalize = (index: number, total: number) => (total ? ((index % total) + total) % total : 0)

function visibleItemsThatFit(widths: number[], available: number, gap: number) {
  if (!widths.length || available <= 0) return 0
  return Math.max(1, Math.min(widths.length, Math.floor((available + gap) / (Math.max(...widths) + gap))))
}

export function Carousel<T>({ title, items, renderItem, ariaLabel, id, emptyText, circular = false }: CarouselProps<T>) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const measurementRef = useRef<HTMLDivElement>(null)
  const regionRef = useRef<HTMLDivElement>(null)
  const restoreFocusRef = useRef(false)
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(false)
  const [viewportWidth, setViewportWidth] = useState(0)
  const [widths, setWidths] = useState<number[]>([])
  const [gap, setGap] = useState(DEFAULT_GAP)
  const [currentPane, setCurrentPane] = useState(0)
  const [targetPane, setTargetPane] = useState(0)
  const [motionPhase, setMotionPhase] = useState<'idle' | 'running'>('idle')
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(media.matches)
    update(); media.addEventListener?.('change', update)
    return () => media.removeEventListener?.('change', update)
  }, [])

  const measure = useCallback(() => {
    const viewport = viewportRef.current; const row = measurementRef.current
    if (!viewport || !row) return
    const measured = Array.from(row.children).map((child) => {
      const el = child as HTMLElement
      return el.getBoundingClientRect().width || el.offsetWidth
    })
    if (measured.length !== items.length || !measured.every((width) => width > 0)) return
    const style = window.getComputedStyle(row); const measuredGap = Number.parseFloat(style.columnGap || style.gap)
    setWidths(measured); setViewportWidth(viewport.clientWidth); setGap(Number.isFinite(measuredGap) ? measuredGap : DEFAULT_GAP)
  }, [items.length])

  useEffect(() => {
    if (!circular) return undefined
    const viewport = viewportRef.current; const row = measurementRef.current
    if (!viewport || !row) return undefined
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(measure)
    observer.observe(viewport); observer.observe(row); Array.from(row.children).forEach((child) => observer.observe(child))
    return () => observer.disconnect()
  }, [circular, items, measure])

  const updateScroll = useCallback(() => {
    const element = scrollerRef.current
    if (!element) return
    const max = Math.max(element.scrollWidth - element.clientWidth, 0)
    setCanPrev(element.scrollLeft > TOLERANCE); setCanNext(element.scrollLeft < max - TOLERANCE)
  }, [])
  useEffect(() => {
    const element = scrollerRef.current
    if (!element || circular) return undefined
    updateScroll(); element.addEventListener('scroll', updateScroll, { passive: true })
    if (typeof ResizeObserver === 'undefined') return () => element.removeEventListener('scroll', updateScroll)
    const observer = new ResizeObserver(updateScroll); observer.observe(element)
    return () => { element.removeEventListener('scroll', updateScroll); observer.disconnect() }
  }, [circular, items, updateScroll])

  const layout = useMemo(() => {
    if (!circular || widths.length !== items.length || viewportWidth <= 0) return { active: false, visibleCount: 0, groupCount: 0 }
    const visibleCount = visibleItemsThatFit(widths, viewportWidth, gap)
    return { active: items.length > visibleCount, visibleCount, groupCount: Math.ceil(items.length / visibleCount) }
  }, [circular, gap, items.length, viewportWidth, widths])
  const circularActive = layout.active
  const middleStart = layout.groupCount
  const lastMiddlePane = middleStart + layout.groupCount - 1

  useEffect(() => {
    if (!circularActive) { setCurrentPane(0); setTargetPane(0); return }
    setCurrentPane((pane) => middleStart + normalize(pane - middleStart, layout.groupCount))
    setTargetPane((pane) => middleStart + normalize(pane - middleStart, layout.groupCount))
  }, [circularActive, layout.groupCount, middleStart])
  useEffect(() => { if (circular) { setCanPrev(circularActive); setCanNext(circularActive) } }, [circular, circularActive])

  // Three static cycles keep every rendered GridCard mounted. The middle cycle is
  // the resting range; only translate and accessibility state change on navigation.
  const panes = useMemo(() => !circularActive ? [] : Array.from({ length: CIRCULAR_CYCLES * layout.groupCount }, (_, paneIndex) => {
    const group = paneIndex % layout.groupCount
    return Array.from({ length: layout.visibleCount }, (_, offset) => {
      const index = normalize(group * layout.visibleCount + offset, items.length)
      return { item: items[index], index, offset }
    })
  }), [circularActive, items, layout.groupCount, layout.visibleCount])

  const finishNavigation = (pane: number) => {
    const settled = pane < middleStart ? lastMiddlePane : pane > lastMiddlePane ? middleStart : pane
    setCurrentPane(settled); setTargetPane(settled); setMotionPhase('idle')
    if (restoreFocusRef.current) { restoreFocusRef.current = false; regionRef.current?.focus() }
  }
  const scroll = (direction: 'prev' | 'next') => {
    if (circularActive) {
      if (motionPhase !== 'idle') return
      const next = currentPane + (direction === 'next' ? 1 : -1)
      const focused = document.activeElement
      restoreFocusRef.current = Boolean(focused && focused !== regionRef.current && regionRef.current?.contains(focused))
      setTargetPane(next)
      if (reducedMotion) { finishNavigation(next); return }
      setMotionPhase('running')
      return
    }
    const element = scrollerRef.current
    if (!element) return
    const max = Math.max(element.scrollWidth - element.clientWidth, 0)
    if (max <= TOLERANCE) return
    const current = Math.min(Math.max(element.scrollLeft, 0), max); const distance = Math.round(element.clientWidth * 0.85)
    element.scrollTo({ left: direction === 'next' ? Math.min(current + distance, max) : Math.max(current - distance, 0), behavior: 'smooth' })
  }
  const handleKeyboard = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    event.preventDefault(); scroll(event.key === 'ArrowRight' ? 'next' : 'prev')
  }
  const handleTransitionEnd = (event: React.TransitionEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget && motionPhase === 'running' && circularActive) finishNavigation(targetPane)
  }

  const titleId = id ?? `carousel-${title.replace(/\s+/g, '-').toLowerCase()}`
  if (!items.length) return <section role="region" aria-roledescription="carrossel" aria-labelledby={titleId} className="w-full"><h2 id={titleId} className="mb-3 text-lg font-semibold text-slate-900 dark:text-white">{title}</h2><div className="flex min-h-[320px] items-center justify-center rounded-xl bg-slate-50/70 px-4 py-6 dark:bg-slate-900/30"><p className="max-w-md text-center text-sm text-slate-500 dark:text-slate-400">{emptyText ?? 'Nenhum item disponível.'}</p></div></section>

  const displayedPane = motionPhase === 'running' ? targetPane : currentPane
  const renderPane = (pane: typeof panes[number], paneIndex: number) => {
    const active = paneIndex === currentPane
    const transition = motionPhase === 'running' ? `transform ${NAVIGATION_DURATION}ms cubic-bezier(0.22, 0.61, 0.36, 1), opacity ${NAVIGATION_DURATION}ms cubic-bezier(0.22, 0.61, 0.36, 1)` : 'none'
    return <div key={`carousel-pane-${paneIndex}`} aria-hidden={active ? undefined : 'true'} inert={!active || undefined} className="shrink-0 overflow-hidden" style={{ width: `${viewportWidth}px`, maxWidth: `${viewportWidth}px` }}><div className="flex items-start gap-3 overflow-hidden py-3" style={{ width: `${viewportWidth}px`, maxWidth: `${viewportWidth}px` }}>{pane.map(({ item, index, offset }) => {
      const itemId = (item as { id?: string | number })?.id ?? index
      return <div key={`carousel-item-${paneIndex}-${itemId}-${offset}`} data-carousel-card="true" className="shrink-0" style={{ transform: 'scale(1)', opacity: 1, transformOrigin: 'center center', transition, willChange: undefined }}>{renderItem(item, index)}</div>
    })}</div></div>
  }
  const disabled = !canPrev || motionPhase !== 'idle'
  return <section aria-labelledby={titleId} aria-label={ariaLabel ?? title} className="w-full"><div className="mb-3 flex items-center justify-between gap-3"><h2 id={titleId} className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2><div className="hidden items-center gap-2 sm:flex"><button type="button" aria-label="Anterior" onClick={() => scroll('prev')} disabled={disabled} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-[var(--color-focus)] disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"><ChevronLeft className="h-4 w-4" aria-hidden="true" /></button><button type="button" aria-label="Próximo" onClick={() => scroll('next')} disabled={!canNext || motionPhase !== 'idle'} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-[var(--color-focus)] disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"><ChevronRight className="h-4 w-4" aria-hidden="true" /></button></div></div><div ref={viewportRef} className="relative overflow-hidden" style={{ clipPath: 'inset(0 4px 0 0)' }}>{circular && <div ref={measurementRef} aria-hidden="true" inert={true} className="pointer-events-none absolute left-0 top-0 flex w-max gap-3 opacity-0" style={{ visibility: 'hidden' }}>{items.map((item, index) => <div key={`measure-${(item as { id?: string | number })?.id ?? index}`} className="shrink-0">{renderItem(item, index)}</div>)}</div>}{circularActive ? <div ref={regionRef} role="region" aria-roledescription="carrossel" tabIndex={0} onKeyDown={handleKeyboard} className="overflow-hidden focus-visible:outline-2 focus-visible:outline-[var(--color-focus)]" data-carousel-circular="true"><div onTransitionEnd={handleTransitionEnd} data-carousel-track="true" className="flex overflow-hidden" style={{ width: `${viewportWidth * panes.length}px`, transform: `translateX(${-displayedPane * viewportWidth}px)`, transition: motionPhase === 'running' ? `transform ${NAVIGATION_DURATION}ms cubic-bezier(0.22, 0.61, 0.36, 1)` : 'none' }}>{panes.map(renderPane)}</div></div> : <div ref={scrollerRef} role="region" aria-roledescription="carrossel" tabIndex={0} onKeyDown={handleKeyboard} className="flex gap-3 overflow-x-auto overflow-y-visible scroll-smooth snap-x snap-mandatory px-1 py-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden focus-visible:outline-2 focus-visible:outline-[var(--color-focus)]" style={{ WebkitOverflowScrolling: 'touch' }}>{items.map((item, index) => <div key={(item as { id?: string | number })?.id ?? index} className="shrink-0 snap-start">{renderItem(item, index)}</div>)}</div>}</div></section>
}
