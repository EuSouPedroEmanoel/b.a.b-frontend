import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { bookStateLabel } from '@/lib/bookStates'
import { useAverageColor } from '@/hooks/useAverageColor'
import { OverflowTags } from '@/components/ui/OverflowTags'
import { generateCoverColor, getBookCoverGradient, getHoverGradientNoCover } from '@/lib/coverColor'
import { getCoverProxyUrl } from '@/lib/imageProxy'

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

export function GridCard({ book, index = 0 }: { book: Book; index?: number }) {
  const [imgError, setImgError] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [triedDirect, setTriedDirect] = useState(false)
  const originalHasCover = !!book.cover_url
  const hasCover = originalHasCover && !imgError
  const isLoadingCover = hasCover && !imgLoaded
  const isPriority = index < 6
  const proxiedUrl = getCoverProxyUrl(book.cover_url, 400)
  const displayUrl = triedDirect ? book.cover_url : proxiedUrl
  const { rgba, darkColor } = useAverageColor(proxiedUrl ?? null, !!proxiedUrl)
  const fallback = useMemo(() => generateCoverColor(book.title), [book.title])
  const coverGradient = useMemo(() => getBookCoverGradient(book.title), [book.title])
  const hoverGradientNoCover = useMemo(() => getHoverGradientNoCover(book.title), [book.title])
  const bg = rgba ?? fallback.bg
  const darkBg = darkColor ?? fallback.darkBg
  const hoverBg = hasCover ? `linear-gradient(135deg, ${bg} 0%, ${darkBg} 100%)` : hoverGradientNoCover
  const year = yearFromDate(book.published_date)

  useEffect(() => {
    setImgLoaded(false)
    setImgError(false)
    setTriedDirect(false)
  }, [book.cover_url])

  return (
    <div className="group relative w-full hover:z-50 focus-within:z-50">
      {/* Card base - tamanho fixo padrão no repouso: w-full + aspect-[2/3] garante mesma altura/largura */}
      <Link
        to={`/acervo/${book.id}`}
        aria-label={`${book.title} de ${book.authors[0]?.name ?? 'autor desconhecido'}`}
        className="flex w-full flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm transition-shadow duration-300 hover:shadow-lg focus-visible:outline-3 focus-visible:outline-[var(--color-focus)]"
      >
        <div className="relative aspect-[2/3] w-full overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800">
          {/* Fallback instantâneo para sem capa */}
          {!hasCover && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 overflow-hidden p-4 text-center" style={{ background: coverGradient }}>
              <div className="absolute inset-0 bg-black/10" aria-hidden="true" />
              <BookOpen className="relative h-8 w-8 shrink-0 text-white/80 drop-shadow-sm" aria-hidden="true" />
              <h3 className="relative line-clamp-3 overflow-hidden px-2 text-sm font-bold leading-snug text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
                {book.title}
              </h3>
            </div>
          )}
          {/* Imagem com fallback placeholder enquanto carrega – fade-in suave 200ms */}
          {hasCover && proxiedUrl && (
            <>
              <div
                className={`absolute inset-0 flex flex-col items-center justify-center gap-2 overflow-hidden p-4 text-center transition-opacity duration-200 ease-out ${isLoadingCover ? 'opacity-100' : 'opacity-0'}`}
                style={{ background: coverGradient }}
                aria-hidden={imgLoaded ? 'true' : undefined}
              >
                <div className="absolute inset-0 bg-black/10" aria-hidden="true" />
                <BookOpen className="relative h-8 w-8 shrink-0 text-white/80 drop-shadow-sm" aria-hidden="true" />
                <h3 className="relative line-clamp-3 overflow-hidden px-2 text-sm font-bold leading-snug text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
                  {book.title}
                </h3>
              </div>
              <img
                src={displayUrl!}
                alt={`Capa de ${book.title}`}
                crossOrigin="anonymous"
                decoding="async"
                width={320}
                height={480}
                fetchPriority={isPriority ? 'high' : 'auto'}
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ease-out ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
                loading={isPriority ? 'eager' : 'lazy'}
                onLoad={() => setImgLoaded(true)}
                onError={() => {
                  if (!triedDirect && book.cover_url && proxiedUrl !== book.cover_url) {
                    setTriedDirect(true)
                    setImgLoaded(false)
                  } else {
                    setImgError(true)
                    setImgLoaded(false)
                  }
                }}
              />
            </>
          )}
          <div className="absolute top-2 right-2 z-10">
            <Badge tone={book.derived_state === 'available' ? 'success' : 'neutral'} className="shadow text-[10px] px-2 py-0.5 backdrop-blur-sm">
              {bookStateLabel(book.derived_state)}
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
      <Link
          to={`/acervo/${book.id}`}
          aria-hidden="true"
          tabIndex={-1}
          className="pointer-events-none invisible absolute left-1/2 top-1/2 z-50 flex w-full aspect-[2/3] max-w-[90vw] -translate-x-1/2 -translate-y-1/2 scale-90 flex-col justify-between overflow-hidden rounded-2xl border border-white/20 opacity-0 shadow-2xl backdrop-blur-md will-change-transform transition-all duration-400 ease-out group-hover:visible group-hover:scale-125 group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:visible group-focus-within:scale-125 group-focus-within:opacity-100 group-focus-within:pointer-events-auto"
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
            {!hasCover ? (
              <div className="flex h-full w-full flex-col items-center justify-center gap-1 overflow-hidden p-1.5 text-center" style={{ background: coverGradient }}>
                <BookOpen className="h-5 w-5 shrink-0 text-white/80 drop-shadow-sm" aria-hidden="true" />
                <span className="line-clamp-3 overflow-hidden px-1 text-[10px] font-bold leading-tight text-white drop-shadow-sm">{book.title}</span>
              </div>
            ) : displayUrl ? (
              <>
                <div
                  className={`absolute inset-0 flex h-full w-full flex-col items-center justify-center gap-1 overflow-hidden p-1.5 text-center transition-opacity duration-200 ease-out ${isLoadingCover ? 'opacity-100' : 'opacity-0'}`}
                  style={{ background: coverGradient }}
                  aria-hidden={imgLoaded ? 'true' : undefined}
                >
                  <BookOpen className="h-5 w-5 shrink-0 text-white/80" aria-hidden="true" />
                  <span className="line-clamp-3 overflow-hidden px-1 text-[10px] font-bold leading-tight text-white drop-shadow-sm">{book.title}</span>
                </div>
                <img
                  src={displayUrl!}
                  alt=""
                  crossOrigin="anonymous"
                  decoding="async"
                  width={160}
                  height={240}
                  fetchPriority={isPriority ? 'high' : 'auto'}
                  className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ease-out ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
                  loading={isPriority ? 'eager' : 'lazy'}
                  onLoad={() => setImgLoaded(true)}
                  onError={() => {
                    if (!triedDirect && book.cover_url && proxiedUrl !== book.cover_url) {
                      setTriedDirect(true)
                      setImgLoaded(false)
                    } else {
                      setImgError(true)
                      setImgLoaded(false)
                    }
                  }}
                />
              </>
            ) : null}
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-between gap-3 py-0.5">
            <div className="flex flex-col gap-1">
              <h3 className="line-clamp-2 overflow-hidden text-sm font-bold leading-snug text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">{book.title}</h3>
              <span className="truncate text-[11px] font-medium leading-none text-white/70">{year ? `Ano ${year}` : 'Ano —'}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              <span
                className="inline-flex items-center whitespace-nowrap rounded-full bg-white px-2.5 py-1 text-xs font-bold leading-none text-slate-900 shadow-sm cursor-default"
                title={typeof book.total_copies === 'number' ? `${book.available_copies ?? 0}/${book.total_copies} cópias` : undefined}
              >
                {bookStateLabel(book.derived_state)}
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
              <OverflowTags items={book.genres} variant="dark" />
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
    </div>
  )
}
