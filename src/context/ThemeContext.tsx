import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ThemeContext, type Resolved, type Theme } from './theme-context'

function getSystem(): Resolved {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const s = localStorage.getItem('theme') as Theme | null
      if (s === 'light' || s === 'dark' || s === 'system') return s
    } catch {}
    return 'system'
  })
  const [systemTheme, setSystemTheme] = useState<Resolved>(getSystem)
  const resolved = theme === 'system' ? systemTheme : theme

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', resolved === 'dark')
    root.style.colorScheme = resolved
    try {
      localStorage.setItem('theme', theme)
    } catch {}
  }, [resolved, theme])

  useEffect(() => {
    if (theme !== 'system') return
    const m = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => setSystemTheme(getSystem())
    m.addEventListener('change', handler)
    return () => m.removeEventListener('change', handler)
  }, [theme])

  const setTheme = useCallback((t: Theme) => setThemeState(t), [])
  const toggle = useCallback(() => {
    setThemeState((prev) => {
      const r = prev === 'system' ? getSystem() : prev
      const next: Theme = r === 'dark' ? 'light' : 'dark'
      return next
    })
  }, [])

  const value = useMemo(() => ({ theme, resolved, toggle, setTheme }), [theme, resolved, toggle, setTheme])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
