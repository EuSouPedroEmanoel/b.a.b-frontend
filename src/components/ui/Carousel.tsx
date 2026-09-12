import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { stagger, useAnimate } from 'framer-motion'

type CarouselProps<T> = {
  title: string
  items: T[]
  renderItem: (item: T, index: number) => ReactNode
  /** Return the element with the same width rule as a rendered item and mark it with data-carousel-measure-item. */
  measureItem?: (item: T, index: number) => ReactNode
  ariaLabel?: string
  id?: string
  emptyText?: string
  circular?: boolean
  fluidItems?: boolean
}

const TOLERANCE = 2
const DEFAULT_GAP = 12
const FLUID_FIT_TOLERANCE = 4
const EXIT_DISTANCE = 24
const EXIT_DURATION = 0.16
const ENTER_DURATION = 0.2
const CARD_STAGGER = 0.035

const normalize = (index: number, total: number) => (total ? ((index % total) + total) % total : 0)

function itemsThatFit(itemWidth: number, itemCount: number, availableWidth: number, gap: number, tolerance = 0) {
  if (itemWidth <= 0 || itemCount <= 0 || availableWidth <= 0) return 0
  return Math.max(1, Math.min(itemCount, Math.floor((availableWidth + gap + tolerance) / (itemWidth + gap))))
}

export function Carousel<T>({ title, items, renderItem, measureItem, ariaLabel, id, emptyText, circular = false, fluidItems = false }: CarouselProps<T>) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const measurementRef = useRef<HTMLDivElement>(null)
  const pageRowRef = useRef<HTMLDivElement>(null)
  const regionRef = useRef<HTMLDivElement>(null)
  const mountedRef = useRef(true)
  const [scope, animate] = useAnimate<HTMLDivElement>()
  const [viewportWidth, setViewportWidth] = useState(0)
  const [itemWidth, setItemWidth] = useState(0)
  const [gap, setGap] = useState(DEFAULT_GAP)
  const [page, setPage] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const [enteringDirection, setEnteringDirection] = useState<'prev' | 'next' | null>(null)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(false)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(media.matches)
    update()
    media.addEventListener?.('change', update)
    return () => media.removeEventListener?.('change', update)
  }, [])

  const measure = useCallback(() => {
    const viewport = viewportRef.current
    const measurement = measurementRef.current
    if (!viewport || !measurement) return

    const measuredItem = measurement.querySelector<HTMLElement>('[data-carousel-measure-item]')
    const width = measuredItem?.getBoundingClientRect().width
      || measuredItem?.offsetWidth
      || 0
    if (width <= 0 || viewport.clientWidth <= 0) return

    const pageRow = pageRowRef.current
    const style = pageRow ? window.getComputedStyle(pageRow) : null
    const measuredGap = Number.parseFloat(style?.columnGap || style?.gap || '')

    setItemWidth((current) => Math.abs(current - width) < 0.5 ? current : width)
    setViewportWidth(viewport.clientWidth)
    setGap(Number.isFinite(measuredGap) ? measuredGap : DEFAULT_GAP)
  }, [])

  useEffect(() => {
    if (!circular || !items.length) return undefined
    const viewport = viewportRef.current
    const measurement = measurementRef.current
    if (!viewport || !measurement) return undefined

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(viewport)
    const measuredItem = measurement.querySelector<HTMLElement>('[data-carousel-measure-item]')
    if (measuredItem) observer.observe(measuredItem)
    const fontObserver = new MutationObserver(measure)
    fontObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-font-size'] })
    const frame = window.requestAnimationFrame(measure)
    return () => {
      observer.disconnect()
      fontObserver.disconnect()
      window.cancelAnimationFrame(frame)
    }
  }, [circular, items.length, measure])

  const itemsPerPage = useMemo(
    () => circular ? itemsThatFit(itemWidth, items.length, viewportWidth, gap, fluidItems ? FLUID_FIT_TOLERANCE : 0) : 0,
    [circular, fluidItems, gap, itemWidth, items.length, viewportWidth],
  )
  const renderedItemsPerPage = itemsPerPage || (items.length ? 1 : 0)
  const renderedItemWidth = fluidItems && itemsPerPage
    ? Math.min(itemWidth, (viewportWidth - gap * (itemsPerPage - 1)) / itemsPerPage)
    : 0
  const pageCount = renderedItemsPerPage ? Math.ceil(items.length / renderedItemsPerPage) : 0
  const hasMultiplePages = pageCount > 1

  useEffect(() => {
    if (!pageCount) {
      setPage(0)
      return
    }
    setPage((current) => Math.min(current, pageCount - 1))
  }, [pageCount])

  const pageItems = useMemo(() => {
    if (!renderedItemsPerPage || !items.length) return []
    const start = page * renderedItemsPerPage
    return Array.from({ length: Math.min(renderedItemsPerPage, items.length) }, (_, offset) => {
      const index = normalize(start + offset, items.length)
      return { item: items[index], index, offset }
    })
  }, [items, page, renderedItemsPerPage])

  const updateScroll = useCallback(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    const maximum = Math.max(scroller.scrollWidth - scroller.clientWidth, 0)
    setCanPrev(scroller.scrollLeft > TOLERANCE)
    setCanNext(scroller.scrollLeft < maximum - TOLERANCE)
  }, [])

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller || circular) return undefined
    updateScroll()
    scroller.addEventListener('scroll', updateScroll, { passive: true })
    const observer = new ResizeObserver(updateScroll)
    observer.observe(scroller)
    return () => {
      scroller.removeEventListener('scroll', updateScroll)
      observer.disconnect()
    }
  }, [circular, items, updateScroll])

  const restoreRegionFocusIfNeeded = () => {
    const focused = document.activeElement
    if (focused instanceof HTMLElement && regionRef.current?.contains(focused) && focused !== regionRef.current) {
      regionRef.current.focus()
    }
  }

  const changePage = async (direction: 'prev' | 'next') => {
    if (!hasMultiplePages || isAnimating) return

    const nextPage = normalize(page + (direction === 'next' ? 1 : -1), pageCount)
    if (reducedMotion) {
      restoreRegionFocusIfNeeded()
      setPage(nextPage)
      return
    }

    setIsAnimating(true)
    const outgoingX = direction === 'next' ? -EXIT_DISTANCE : EXIT_DISTANCE
    const from = direction === 'next' ? 'first' : 'last'

    await animate('[data-carousel-page-item]', { opacity: 0, x: outgoingX }, {
      duration: EXIT_DURATION,
      delay: stagger(CARD_STAGGER, { from }),
    })

    if (!mountedRef.current) return
    restoreRegionFocusIfNeeded()
    // A entrada só pode procurar os cards depois de a nova página existir no DOM.
    // flushSync evita que o requestAnimationFrame vença a atualização concorrente do React.
    flushSync(() => {
      setEnteringDirection(direction)
      setPage(nextPage)
    })
    if (!mountedRef.current) return

    await animate('[data-carousel-page-item]', { opacity: 1, x: 0 }, {
      duration: ENTER_DURATION,
      delay: stagger(CARD_STAGGER, { from }),
    })

    if (mountedRef.current) {
      setEnteringDirection(null)
      setIsAnimating(false)
    }
  }

  const scroll = (direction: 'prev' | 'next') => {
    if (circular) {
      void changePage(direction)
      return
    }
    const scroller = scrollerRef.current
    if (!scroller) return
    const maximum = Math.max(scroller.scrollWidth - scroller.clientWidth, 0)
    if (maximum <= TOLERANCE) return
    const current = Math.min(Math.max(scroller.scrollLeft, 0), maximum)
    const distance = Math.round(scroller.clientWidth * 0.85)
    scroller.scrollTo({ left: direction === 'next' ? Math.min(current + distance, maximum) : Math.max(current - distance, 0), behavior: 'smooth' })
  }

  const handleKeyboard = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    scroll(event.key === 'ArrowRight' ? 'next' : 'prev')
  }

  const titleId = id ?? `carousel-${title.replace(/\s+/g, '-').toLowerCase()}`
  if (!items.length) {
    return <section role="region" aria-roledescription="carrossel" aria-labelledby={titleId} className="w-full"><h2 id={titleId} className="mb-3 text-lg font-semibold text-slate-900 dark:text-white">{title}</h2><div className="flex min-h-[320px] items-center justify-center rounded-xl bg-slate-50/70 px-4 py-6 dark:bg-slate-900/30"><p className="max-w-md text-center text-sm text-slate-500 dark:text-slate-400">{emptyText ?? 'Nenhum item disponível.'}</p></div></section>
  }

  const previousDisabled = circular ? !hasMultiplePages || isAnimating : !canPrev
  const nextDisabled = circular ? !hasMultiplePages || isAnimating : !canNext
  const renderMeasurementItem = measureItem ?? renderItem

  const enteringX = enteringDirection === 'next' ? EXIT_DISTANCE : -EXIT_DISTANCE
  return <section aria-labelledby={titleId} aria-label={ariaLabel ?? title} className="w-full"><div className="mb-3 flex items-center justify-between gap-3"><h2 id={titleId} className="min-w-0 text-lg font-semibold text-slate-900 dark:text-white">{title}</h2><div className="flex shrink-0 items-center gap-2"><button type="button" aria-label="Anterior" onClick={() => scroll('prev')} disabled={previousDisabled} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-[var(--color-focus)] disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"><ChevronLeft className="h-4 w-4" aria-hidden="true" /></button><button type="button" aria-label="Próximo" onClick={() => scroll('next')} disabled={nextDisabled} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-[var(--color-focus)] disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"><ChevronRight className="h-4 w-4" aria-hidden="true" /></button></div></div><div ref={scope} className="relative"><div ref={viewportRef} className="relative overflow-hidden" style={viewportWidth > 0 ? ({ '--carousel-viewport-width': `${viewportWidth}px`, ...(renderedItemWidth > 0 ? { '--carousel-item-width': `${renderedItemWidth}px` } : {}) } as CSSProperties) : undefined}>{circular && <div ref={measurementRef} aria-hidden="true" inert={true} className="pointer-events-none absolute left-0 top-0 opacity-0" style={{ visibility: 'hidden' }}>{measureItem ? renderMeasurementItem(items[0], 0) : <div data-carousel-measure-item className="inline-block">{renderMeasurementItem(items[0], 0)}</div>}</div>}{circular ? <div ref={regionRef} role="region" aria-roledescription="carrossel" aria-label={`${ariaLabel ?? title}. Página ${page + 1} de ${Math.max(pageCount, 1)}`} tabIndex={-1} onKeyDown={handleKeyboard} className="focus-visible:outline-2 focus-visible:outline-[var(--color-focus)]"><div ref={pageRowRef} data-carousel-page className="flex items-start gap-3 py-3">{pageItems.map(({ item, index, offset }) => <div key={`${page}-${(item as { id?: string | number })?.id ?? index}-${offset}`} data-carousel-page-item className="shrink-0" style={enteringDirection ? { opacity: 0, transform: `translateX(${enteringX}px)` } : undefined}>{renderItem(item, index)}</div>)}</div><p className="sr-only" aria-live="polite">Página ${page + 1} de ${Math.max(pageCount, 1)}</p></div> : <div ref={scrollerRef} role="region" aria-roledescription="carrossel" tabIndex={0} onKeyDown={handleKeyboard} className="flex gap-3 overflow-x-auto overflow-y-visible scroll-smooth snap-x snap-mandatory px-1 py-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden focus-visible:outline-2 focus-visible:outline-[var(--color-focus)]" style={{ WebkitOverflowScrolling: 'touch' }}>{items.map((item, index) => <div key={(item as { id?: string | number })?.id ?? index} className="shrink-0 snap-start">{renderItem(item, index)}</div>)}</div>}</div></div></section>
}
