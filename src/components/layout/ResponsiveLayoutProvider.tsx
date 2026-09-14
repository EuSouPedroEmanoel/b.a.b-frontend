import { useState, type ReactNode } from 'react'
import { ResponsiveLayoutContext } from './ResponsiveLayoutContextValue'

const defaultCompact = typeof window !== 'undefined' && window.innerWidth < 768

export function ResponsiveLayoutProvider({ children }: { children: ReactNode }) {
  const [isCompact, setIsCompact] = useState(defaultCompact)

  return (
    <ResponsiveLayoutContext.Provider value={{ isCompact, setIsCompact }}>
      {children}
    </ResponsiveLayoutContext.Provider>
  )
}
