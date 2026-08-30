import { useEffect, useMemo, useState } from 'react'
import { getCoverProxyUrl } from '@/lib/imageProxy'
import { generateFallbackCoverDataUrl } from '@/lib/coverFallback'

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

export function CoverImage({ src, title, alt, width = 320, height = 480, priority = false, className = '', fallbackVariant: _fallbackVariant = 'gradient', sizes }: Props) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const [triedDirect, setTriedDirect] = useState(false)
  const hasCover = !!src && !error
  const isLoading = hasCover && !loaded
  const proxied = useMemo(() => getCoverProxyUrl(src, width), [src, width])
  const displaySrc = triedDirect ? src : proxied
  const fallbackDataUrl = useMemo(() => generateFallbackCoverDataUrl(title, width, Math.round((width * 3) / 2)), [title, width])

  useEffect(() => {
    setLoaded(false)
    setError(false)
    setTriedDirect(false)
  }, [src])

  const showFallback = !hasCover || isLoading

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* fallback como <img> Data URL – mesmas classes w-full h-full object-cover e aspect do pai */}
      {showFallback && (
        <img
          src={fallbackDataUrl}
          alt={alt}
          width={width}
          height={height}
          sizes={sizes}
          fetchPriority={priority ? 'high' : 'auto'}
          loading={priority ? 'eager' : 'lazy'}
          className="absolute inset-0 h-full w-full object-cover"
          aria-hidden={loaded ? 'true' : undefined}
        />
      )}
      {hasCover && displaySrc && (
        <img
          src={displaySrc}
          alt={alt}
          crossOrigin="anonymous"
          decoding="async"
          width={width}
          height={height}
          sizes={sizes}
          fetchPriority={priority ? 'high' : 'auto'}
          loading={priority ? 'eager' : 'lazy'}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ease-out ${loaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setLoaded(true)}
          onError={() => {
            if (!triedDirect && src && proxied !== src) {
              setTriedDirect(true)
              setLoaded(false)
            } else {
              setError(true)
              setLoaded(false)
            }
          }}
        />
      )}
    </div>
  )
}
