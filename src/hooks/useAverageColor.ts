import { useEffect, useState } from 'react'
import { FastAverageColor } from 'fast-average-color'

const cache = new Map<string, string>()
const fac = typeof window !== 'undefined' ? new FastAverageColor() : null

type Colors = {
  color: string | null
  darkColor: string | null
  rgba: string | null
}

const emptyColors: Colors = { color: null, darkColor: null, rgba: null }

function darken(hex: string, amount = 0.35): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const nr = Math.max(0, Math.round(r * (1 - amount)))
  const ng = Math.max(0, Math.round(g * (1 - amount)))
  const nb = Math.max(0, Math.round(b * (1 - amount)))
  return `rgb(${nr}, ${ng}, ${nb})`
}

function toRgba(hex: string, alpha = 0.92): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function makeColors(hex: string): Colors {
  return { color: hex, darkColor: darken(hex, 0.4), rgba: toRgba(hex, 0.88) }
}

export function useAverageColor(src: string | null, enabled = true) {
  const [computed, setComputed] = useState<{ src: string; colors: Colors } | null>(null)
  const cached = enabled && src ? cache.get(src) : undefined
  const colors = !enabled || !src || !fac
    ? emptyColors
    : cached
      ? makeColors(cached)
      : computed?.src === src ? computed.colors : emptyColors

  useEffect(() => {
    if (!enabled || !src || !fac || cache.has(src)) return
    let cancelled = false
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = src
    img.onload = async () => {
      try {
        const c = await fac.getColorAsync(img)
        if (cancelled) return
        const hex = c.hex
        cache.set(src, hex)
        setComputed({ src, colors: makeColors(hex) })
      } catch {
        if (!cancelled) {
          const fallback = '#0f4c75'
          cache.set(src, fallback)
          setComputed({ src, colors: makeColors(fallback) })
        }
      }
    }
    img.onerror = () => {
      if (!cancelled) {
        const fallback = '#334155'
        cache.set(src, fallback)
        setComputed({ src, colors: makeColors(fallback) })
      }
    }
    return () => {
      cancelled = true
      img.onload = null
      img.onerror = null
    }
  }, [src, enabled])

  return colors
}
