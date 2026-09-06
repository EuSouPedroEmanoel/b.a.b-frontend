import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { bookStateLabel, bookStateTone, publicBookStateLabel, publicBookStateTone } from '@/lib/bookStates'
import { useAverageColor } from '@/hooks/useAverageColor'
import { OverflowTags } from '@/components/ui/OverflowTags'
import { CoverImage } from '@/components/ui/CoverImage'
import { generateCoverColor, getHoverGradientNoCover } from '@/lib/coverColor'
import { getCoverProxyUrl } from '@/lib/imageProxy'
import { catalogRouteState, createCatalogOrigin, detailRouteState, getCatalogOrigin, saveCatalogSnapshot } from '@/lib/catalogNavigation'

type Book = {
  id: number
  title: string
  description: string | null
  derived_state: string
  isbn: string | null
  cover_url: string | null
  published_date: string | null
  genres: { id: number; name: string; slug: string }[]
  authors: { id: number; name: string; slug: string }[]
  total_copies?: number
  available_copies?: number
}

function yearFromDate(dateStr: string | null): string | null {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return null
  return String(d.getFullYear())
}

export function GridCard({ book, index = 0, disableHover = false, portalHover = false, isGuest = false }: { book: Book; index?: number; disableHover?: boolean; portalHover?: boolean; isGuest?: boolean }) {
  return <GridCardContent book={book} index={index} disableHover={disableHover} portalHover={portalHover} isGuest={isGuest} />
}

function GridCardContent({ book, index = 0, disableHover = false, portalHover = false, isGuest = false }: { book: Book; index?: number; disableHover?: boolean; portalHover?: boolean; isGuest?: boolean }) {
  const navigate = useNavigate()
  const location = useLocation()
  const catalogOrigin = getCatalogOrigin(location.state)
    ?? (location.pathname === '/acervo' ? createCatalogOrigin(`${location.pathname}${location.search}`) : undefined)
  const savePosition = () => {
    if (location.pathname === '/acervo' && catalogOrigin) saveCatalogSnapshot(catalogOrigin, window.scrollY)
  }
  const openCatalogQuery = (url: string) => navigate(url, { state: catalogRouteState('new-catalog-navigation') })
  const hasCover = !!book.cover_url
  const isPriority = index < 6
  const proxiedUrl = getCoverProxyUrl(book.cover_url, 400)
  const { rgba, darkColor } = useAverageColor(proxiedUrl ?? null, !!proxiedUrl)
  const fallback = useMemo(() => generateCoverColor(book.title), [book.title])
  const hoverGradientNoCover = useMemo(() => getHoverGradientNoCover(book.title), [book.title])
  const bg = rgba ?? fallback.bg
  const darkBg = darkColor ?? fallback.darkBg
  const hoverBg = hasCover ? `linear-gradient(135deg, ${bg} 0%, ${darkBg} 100%)` : hoverGradientNoCover
  const year = yearFromDate(book.published_date)
  const cardRef = useRef<HTMLDivElement>(null)
  const [portalHovered, setPortalHovered] = useState(false)
  const [portalRect, setPortalRect] = useState<DOMRect | null>(null)
  const hideTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    if (!portalHover || !portalHovered) return
    const onScroll = () => {
      if (cardRef.current) setPortalRect(cardRef.current.getBoundingClientRect())
    }
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [portalHover, portalHovered])

  return (
    <div
      ref={cardRef}
      onMouseEnter={() => {
        if (portalHover) {
          if (hideTimeoutRef.current) {
            window.clearTimeout(hideTimeoutRef.current)
            hideTimeoutRef.current = null
          }
          if (cardRef.current) setPortalRect(cardRef.current.getBoundingClientRect())
          setPortalHovered(true)
        }
      }}
      onMouseLeave={() => {
        if (portalHover) {
          if (hideTimeoutRef.current) window.clearTimeout(hideTimeoutRef.current)
          hideTimeoutRef.current = window.setTimeout(() => setPortalHovered(false), 80)
        }
      }}
      className={`group relative w-full ${disableHover ? '' : 'hover:z-10 focus-within:z-10'}`}
    >
      {/* Card base - tamanho fixo padrão no repouso: w-full + aspect-[2/3] garante mesma altura/largura */}
      <Link
        to={`/acervo/${book.id}`}
        state={detailRouteState(catalogOrigin)}
        onClick={savePosition}
        aria-label={`${book.title} de ${book.authors[0]?.name ?? 'autor desconhecido'}`}
        className="flex w-full flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm transition-shadow duration-300 hover:shadow-lg focus-visible:outline-3 focus-visible:outline-[var(--color-focus)]"
      >
        <div className="relative aspect-[2/3] w-full overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800">
          <CoverImage
            src={book.cover_url}
            title={book.title}
            alt={`Capa de ${book.title}`}
            width={320}
            height={480}
            priority={isPriority}
            className="absolute inset-0 h-full w-full"
          />
          <div className="absolute top-2 right-2 z-10">
            <Badge
              tone={isGuest ? publicBookStateTone(book.derived_state) : bookStateTone(book.derived_state)}
              className="shadow text-[10px] px-2 py-0.5 backdrop-blur-sm cursor-pointer"
              role="button"
              tabIndex={0}
              title={isGuest ? publicBookStateLabel(book.derived_state) : `Buscar por estado: ${bookStateLabel(book.derived_state)}`}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                openCatalogQuery(`/acervo?state=${book.derived_state}`)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  e.stopPropagation()
                  openCatalogQuery(`/acervo?state=${book.derived_state}`)
                }
              }}
            >
              {isGuest ? publicBookStateLabel(book.derived_state) : bookStateLabel(book.derived_state)}
            </Badge>
          </div>
          {/* Rodapé da capa – igual para com imagem e fallback: Título + Autor sobre gradiente escuro */}
          <div className="absolute inset-x-0 bottom-0 overflow-hidden bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 pt-8">
            <h3 className="line-clamp-2 overflow-hidden text-sm font-bold leading-snug text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">{book.title}</h3>
            {book.authors[0] && <p className="truncate text-xs text-white/80">{book.authors[0].name}</p>}
          </div>
        </div>
      </Link>

      {/* Hover expandido - banner padronizado: ambos exibem capa no mesmo slot */}
      {!disableHover && !portalHover && (
        <Link
          to={`/acervo/${book.id}`}
          state={detailRouteState(catalogOrigin)}
          onClick={savePosition}
          aria-hidden="true"
          tabIndex={-1}
          className="pointer-events-none invisible absolute left-1/2 top-1/2 z-10 flex w-full aspect-[2/3] max-w-[90vw] -translate-x-1/2 -translate-y-1/2 scale-90 flex-col justify-between overflow-hidden rounded-2xl border border-white/20 opacity-0 shadow-2xl backdrop-blur-md will-change-transform transition-all duration-400 ease-out group-hover:visible group-hover:scale-125 group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:visible group-focus-within:scale-125 group-focus-within:opacity-100 group-focus-within:pointer-events-auto"
        style={{
          background: hoverBg,
          boxShadow: '0 24px 48px rgba(0,0,0,0.38), 0 10px 20px rgba(0,0,0,0.28)',
          transformOrigin: 'center center',
          transition: 'opacity 0.45s ease-out 70ms, transform 0.45s cubic-bezier(0.16,1,0.3,1) 70ms, background 0.3s ease-in-out, filter 0.45s ease-out',
          filter: 'saturate(1.05)',
        }}
      >
        {/* Overlay sutil de gradiente escuro para garantir contraste WCAG (transparente -> rgba(0,0,0,0.85)) */}
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/60"
          style={{ background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.55))' }}
          aria-hidden="true"
        />
        {/* Conteúdo superior - capa no canto superior esquerdo (reduzida) */}
        <div className="relative flex shrink-0 gap-2 p-3">
          <div className="relative w-16 aspect-[2/3] shrink-0 overflow-hidden rounded-lg border border-white/20 shadow-md flex items-center justify-center bg-white/10">
            <CoverImage src={book.cover_url} title={book.title} alt="" width={64} height={96} priority={isPriority} className="absolute inset-0 h-full w-full" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-between gap-3 py-0.5">
            <div className="flex flex-col gap-1">
              <h3 className="line-clamp-2 overflow-hidden text-sm font-bold leading-snug text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">{book.title}</h3>
              <span className="truncate text-[11px] font-medium leading-none text-white/70">{year ? `Ano ${year}` : 'Ano —'}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              <span
                role="button"
                tabIndex={0}
                title={isGuest ? publicBookStateLabel(book.derived_state) : `Buscar por estado: ${bookStateLabel(book.derived_state)}`}
                className="inline-flex items-center whitespace-nowrap rounded-full bg-white px-2.5 py-1 text-xs font-bold leading-none text-slate-900 shadow-sm cursor-pointer transition-colors duration-200 hover:brightness-110 hover:shadow-md focus-visible:outline-2 focus-visible:outline-white"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  openCatalogQuery(`/acervo?state=${book.derived_state}`)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    e.stopPropagation()
                    openCatalogQuery(`/acervo?state=${book.derived_state}`)
                  }
                }}
              >
                {isGuest ? publicBookStateLabel(book.derived_state) : bookStateLabel(book.derived_state)}
              </span>
            </div>
          </div>
        </div>

        {/* Gêneros – badges reduzidas text-[10px] compact, linha única nowrap +N */}
        <div className="relative shrink-0 overflow-hidden px-3.5 pb-3">
          <div className="mb-1 flex items-center gap-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">Gêneros</span>
          </div>
          <div className="flex flex-nowrap overflow-hidden">
            {book.genres.length > 0 ? (
              <OverflowTags
                items={book.genres}
                variant="dark"
                onItemClick={(item) => {
                  openCatalogQuery(`/acervo?genre_id=${item.id}`)
                }}
              />
            ) : (
              <span className="text-xs text-white/60">—</span>
            )}
          </div>
        </div>

        {/* Descrição ocupando espaço livre entre gêneros e fim do card – gap maior */}
        {book.description ? (
          <div className="relative flex flex-1 min-h-0 overflow-hidden px-3.5 pb-3 pt-2">
            <div className="flex w-full flex-1 items-start rounded-lg bg-black/10 border border-white/10 px-3 py-1.5 backdrop-blur-sm overflow-hidden">
              <p className="truncate w-full overflow-hidden text-xs leading-relaxed text-white/90">{book.description}</p>
            </div>
          </div>
        ) : (
          <div className="relative flex flex-1 min-h-0" aria-hidden="true" />
        )}
      </Link>
      )}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {!disableHover && portalHover && portalHovered && portalRect && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{
                duration: 0.45,
                ease: [0.16, 1, 0.3, 1] as any,
                delay: 0.07,
                opacity: { duration: 0.45, ease: 'easeOut' as any, delay: 0.07 },
              }}
              style={{
                position: 'fixed',
                left: `${portalRect.left - portalRect.width * 0.125}px`,
                top: `${portalRect.top - portalRect.height * 0.125}px`,
                width: `${portalRect.width * 1.25}px`,
                height: `${portalRect.height * 1.25}px`,
                maxWidth: '90vw',
                maxHeight: '90vh',
                zIndex: 20,
                transformOrigin: 'center center',
                willChange: 'transform, opacity',
              }}
              onMouseEnter={() => {
                if (hideTimeoutRef.current) {
                  window.clearTimeout(hideTimeoutRef.current)
                  hideTimeoutRef.current = null
                }
                setPortalHovered(true)
              }}
              onMouseLeave={() => {
                if (hideTimeoutRef.current) window.clearTimeout(hideTimeoutRef.current)
                hideTimeoutRef.current = window.setTimeout(() => setPortalHovered(false), 80)
              }}
            >
              <Link
                to={`/acervo/${book.id}`}
                state={detailRouteState(catalogOrigin)}
                onClick={savePosition}
                aria-hidden="true"
                tabIndex={-1}
                className="flex h-full w-full flex-col justify-between overflow-hidden rounded-2xl border border-white/20 shadow-2xl backdrop-blur-md"
                style={{
                  background: hoverBg,
                  boxShadow: '0 24px 48px rgba(0,0,0,0.38), 0 10px 20px rgba(0,0,0,0.28)',
                  filter: 'saturate(1.05)',
                }}
              >
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/60" style={{ background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.55))' }} aria-hidden="true" />
          <div className="relative flex shrink-0 gap-2 p-3">
            <div className="relative w-16 aspect-[2/3] shrink-0 overflow-hidden rounded-lg border border-white/20 shadow-md flex items-center justify-center bg-white/10">
              <CoverImage src={book.cover_url} title={book.title} alt="" width={64} height={96} priority={isPriority} className="absolute inset-0 h-full w-full" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col justify-between gap-3 py-0.5">
              <div className="flex flex-col gap-1">
                <h3 className="line-clamp-2 overflow-hidden text-sm font-bold leading-snug text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">{book.title}</h3>
                <span className="truncate text-[11px] font-medium leading-none text-white/70">{year ? `Ano ${year}` : 'Ano —'}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                <span role="button" tabIndex={0} title={isGuest ? publicBookStateLabel(book.derived_state) : `Buscar por estado: ${bookStateLabel(book.derived_state)}`} className="inline-flex items-center whitespace-nowrap rounded-full bg-white px-2.5 py-1 text-xs font-bold leading-none text-slate-900 shadow-sm cursor-pointer transition-colors duration-200 hover:brightness-110 hover:shadow-md focus-visible:outline-2 focus-visible:outline-white">{isGuest ? publicBookStateLabel(book.derived_state) : bookStateLabel(book.derived_state)}</span>
              </div>
            </div>
          </div>
          <div className="relative shrink-0 overflow-hidden px-3.5 pb-3">
            <div className="mb-1 flex items-center gap-1"><span className="text-[10px] font-bold uppercase tracking-widest text-white/60">Gêneros</span></div>
            <div className="flex flex-nowrap overflow-hidden">
              {book.genres.length > 0 ? <OverflowTags items={book.genres} variant="dark" onItemClick={(item) => { openCatalogQuery(`/acervo?genre_id=${item.id}`) }} /> : <span className="text-xs text-white/60">—</span>}
            </div>
          </div>
          {book.description ? (
            <div className="relative flex flex-1 min-h-0 overflow-hidden px-3.5 pb-3 pt-2">
              <div className="flex w-full flex-1 items-start rounded-lg bg-black/10 border border-white/10 px-3 py-1.5 backdrop-blur-sm overflow-hidden">
                <p className="truncate w-full overflow-hidden text-xs leading-relaxed text-white/90">{book.description}</p>
              </div>
            </div>
          ) : <div className="relative flex flex-1 min-h-0" aria-hidden="true" />}
        </Link>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  )
}
