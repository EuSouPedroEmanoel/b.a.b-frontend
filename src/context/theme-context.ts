import { createContext } from 'react'

export type Theme = 'light' | 'dark' | 'system'
export type Resolved = 'light' | 'dark'

export type ThemeContextType = {
  theme: Theme
  resolved: Resolved
  toggle: () => void
  setTheme: (theme: Theme) => void
}

export const ThemeContext = createContext<ThemeContextType | null>(null)
