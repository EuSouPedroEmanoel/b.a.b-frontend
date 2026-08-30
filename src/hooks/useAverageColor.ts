import { useEffect, useState } from 'react'
import { FastAverageColor } from 'fast-average-color'

const cache = new Map<string, string>()
const fac = typeof window !== 'undefined' ? new FastAverageColor() : null

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

export function useAverageColor(src: string | null, enabled = true) {
  const [color, setColor] = useState<string | null>(null)
  const [darkColor, setDarkColor] = useState<string | null>(null)
  const [rgba, setRgba] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || !src || !fac) {
      setColor(null)
      setDarkColor(null)
      setRgba(null)
      return
    }
    if (cache.has(src)) {
      const cached = cache.get(src)!
      setColor(cached)
      setDarkColor(darken(cached, 0.4))
      setRgba(toRgba(cached, 0.88))
      return
    }
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
        setColor(hex)
        setDarkColor(darken(hex, 0.4))
        setRgba(toRgba(hex, 0.88))
      } catch {
        if (!cancelled) {
          const fallback = '#0f4c75'
          cache.set(src, fallback)
          setColor(fallback)
          setDarkColor(darken(fallback, 0.4))
          setRgba(toRgba(fallback, 0.88))
        }
      }
    }
    img.onerror = () => {
      if (!cancelled) {
        const fallback = '#334155'
        cache.set(src, fallback)
        setColor(fallback)
        setDarkColor(darken(fallback, 0.4))
        setRgba(toRgba(fallback, 0.88))
      }
    }
    return () => {
      cancelled = true
      img.onload = null
      img.onerror = null
    }
  }, [src, enabled])

  return { color, darkColor, rgba }
}
