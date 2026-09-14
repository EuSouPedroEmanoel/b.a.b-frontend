import { createContext, useContext, useState, type ReactNode } from 'react'

type ResponsiveLayoutContextValue = {
  isCompact: boolean
  setIsCompact: (isCompact: boolean) => void
}

const defaultCompact = typeof window !== 'undefined' && window.innerWidth < 768

export const ResponsiveLayoutContext = createContext<ResponsiveLayoutContextValue | null>(null)

export function ResponsiveLayoutProvider({ children }: { children: ReactNode }) {
  const [isCompact, setIsCompact] = useState(defaultCompact)

  return (
    <ResponsiveLayoutContext.Provider value={{ isCompact, setIsCompact }}>
      {children}
    </ResponsiveLayoutContext.Provider>
  )
}

export function useResponsiveLayout() {
  const context = useContext(ResponsiveLayoutContext)
  const [fallbackCompact, setFallbackCompact] = useState(defaultCompact)

  return context ?? { isCompact: fallbackCompact, setIsCompact: setFallbackCompact }
}
