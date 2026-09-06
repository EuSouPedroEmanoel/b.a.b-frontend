import { useMemo, useState } from 'react'
import { generateFallbackCoverDataUrl } from '@/lib/coverFallback'
import { getCoverProxyUrl } from '@/lib/imageProxy'

type Props = {
  src: string | null | undefined
  title: string
  alt: string
  width?: number
  height?: number
  priority?: boolean
  className?: string
  fallbackVariant?: 'gradient' | 'muted'
  sizes?: string
}

type LoadState = 'loading' | 'loaded' | 'error'

export function CoverImage({
  src,
  title,
  alt,
  width = 320,
  height = 480,
  priority = false,
  className = '',
  fallbackVariant: _fallbackVariant = 'gradient',
  sizes,
}: Props) {
  // A chave só muda quando a origem real muda, evitando resetar uma capa já em cache em re-renders comuns.
  return <CoverImageContent key={src ?? 'no-cover'} src={src} title={title} alt={alt} width={width} height={height} priority={priority} className={className} fallbackVariant={_fallbackVariant} sizes={sizes} />
}

function CoverImageContent({
  src,
  title,
  alt,
  width = 320,
  height = 480,
  priority = false,
  className = '',
  fallbackVariant: _fallbackVariant = 'gradient',
  sizes,
}: Props) {
  const [loadState, setLoadState] = useState<LoadState>(() => (src ? 'loading' : 'error'))
  const [triedDirect, setTriedDirect] = useState(false)
  const proxiedSrc = useMemo(() => getCoverProxyUrl(src, width), [src, width])
  const displaySrc = triedDirect ? src : proxiedSrc
  const fallbackDataUrl = useMemo(() => generateFallbackCoverDataUrl(title, width, Math.round((width * 3) / 2)), [title, width])
  const hasSource = Boolean(src && displaySrc)
  const isLoading = hasSource && loadState === 'loading'
  const showFallback = !hasSource || loadState === 'error'

  const handleError = () => {
    if (!triedDirect && src && proxiedSrc && proxiedSrc !== src) {
      setTriedDirect(true)
      setLoadState('loading')
      return
    }
    setLoadState('error')
  }

  return (
    <div className={`relative overflow-hidden ${className}`} data-cover-state={isLoading ? 'loading' : showFallback ? 'fallback' : 'loaded'} style={{ aspectRatio: `${width} / ${height}` }}>
      {isLoading && <div aria-hidden="true" data-cover-placeholder="true" className="absolute inset-0 bg-slate-200 dark:bg-slate-700" />}

      {hasSource && (
        <img
          src={displaySrc ?? undefined}
          alt={loadState === 'loaded' ? alt : ''}
          aria-hidden={loadState === 'loaded' ? undefined : true}
          crossOrigin="anonymous"
          decoding="async"
          width={width}
          height={height}
          sizes={sizes}
          fetchPriority={priority ? 'high' : 'auto'}
          loading={priority ? 'eager' : 'lazy'}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ease-out motion-reduce:transition-none ${loadState === 'loaded' ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setLoadState('loaded')}
          onError={handleError}
        />
      )}

      {showFallback && (
        <img
          src={fallbackDataUrl}
          alt={alt}
          width={width}
          height={height}
          sizes={sizes}
          className="absolute inset-0 h-full w-full object-cover opacity-100 transition-opacity duration-200 ease-out motion-reduce:transition-none"
        />
      )}
    </div>
  )
}
