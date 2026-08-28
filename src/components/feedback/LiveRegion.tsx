import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

type Announce = (msg: string, politeness?: 'polite' | 'assertive') => void

const AnnouncerCtx = createContext<Announce>(() => {})

export function useAnnouncer() {
  return useContext(AnnouncerCtx)
}

export function LiveRegionProvider({ children }: { children: ReactNode }) {
  const [polite, setPolite] = useState('')
  const [assertive, setAssertive] = useState('')

  const announce = useCallback<Announce>((msg, pol = 'polite') => {
    if (pol === 'assertive') {
      setAssertive('')
      requestAnimationFrame(() => setAssertive(msg))
    } else {
      setPolite('')
      requestAnimationFrame(() => setPolite(msg))
    }
  }, [])

  return (
    <AnnouncerCtx.Provider value={announce}>
      {children}
      {/* Duas regiões vivas — WCAG 4.1.3 */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {polite}
      </div>
      <div aria-live="assertive" aria-atomic="true" className="sr-only">
        {assertive}
      </div>
    </AnnouncerCtx.Provider>
  )
}
