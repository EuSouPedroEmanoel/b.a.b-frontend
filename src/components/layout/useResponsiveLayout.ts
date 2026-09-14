import { useContext, useState } from 'react'
import { ResponsiveLayoutContext } from './ResponsiveLayoutContextValue'

const defaultCompact = typeof window !== 'undefined' && window.innerWidth < 768

export function useResponsiveLayout() {
  const context = useContext(ResponsiveLayoutContext)
  const [fallbackCompact, setFallbackCompact] = useState(defaultCompact)

  return context ?? { isCompact: fallbackCompact, setIsCompact: setFallbackCompact }
}
