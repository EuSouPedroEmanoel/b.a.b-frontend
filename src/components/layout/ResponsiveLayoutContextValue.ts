import { createContext } from 'react'

export type ResponsiveLayoutContextValue = {
  isCompact: boolean
  setIsCompact: (isCompact: boolean) => void
}

export const ResponsiveLayoutContext = createContext<ResponsiveLayoutContextValue | null>(null)
