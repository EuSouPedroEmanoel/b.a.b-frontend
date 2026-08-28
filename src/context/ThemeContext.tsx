import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

type Theme = 'light' | 'dark' | 'system'
type Resolved = 'light' | 'dark'

type Ctx = {
  theme: Theme
  resolved: Resolved
  toggle: () => void
  setTheme: (t: Theme) => void
}

export const ThemeContext = createContext<Ctx | null>(null)

function getSystem(): Resolved {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function resolve(theme: Theme): Resolved {
  return theme === 'system' ? getSystem() : theme
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const s = localStorage.getItem('theme') as Theme | null
      if (s === 'light' || s === 'dark' || s === 'system') return s
    } catch {}
    return 'system'
  })
  const [resolved, setResolved] = useState<Resolved>(() => resolve(theme as Theme))

  const apply = useCallback((t: Theme) => {
    const r = resolve(t)
    setResolved(r)
    const root = document.documentElement
    root.classList.toggle('dark', r === 'dark')
    root.style.colorScheme = r
    try {
      localStorage.setItem('theme', t)
    } catch {}
  }, [])

  useEffect(() => {
    apply(theme)
  }, [theme, apply])

  useEffect(() => {
    if (theme !== 'system') return
    const m = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => apply('system')
    m.addEventListener('change', handler)
    return () => m.removeEventListener('change', handler)
  }, [theme, apply])

  const setTheme = useCallback((t: Theme) => setThemeState(t), [])
  const toggle = useCallback(() => {
    setThemeState((prev) => {
      const r = resolve(prev)
      const next: Theme = r === 'dark' ? 'light' : 'dark'
      return next
    })
  }, [])

  const value = useMemo(() => ({ theme, resolved, toggle, setTheme }), [theme, resolved, toggle, setTheme])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
