import { createContext, useContext } from 'react'

export type Announce = (msg: string, politeness?: 'polite' | 'assertive') => void

export const AnnouncerContext = createContext<Announce>(() => {})

export function useAnnouncer() {
  return useContext(AnnouncerContext)
}
