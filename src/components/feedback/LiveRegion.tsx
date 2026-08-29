import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

type Announce = (msg: string, politeness?: 'polite' | 'assertive') => void

const AnnouncerCtx = createContext<Announce>(() => {})

export function useAnnouncer() {
  return useContext(AnnouncerCtx)
}

export function LiveRegionProvider({ children }: { children: ReactNode }) {
  const [polite, setPolite] = useState<{ text: string; key: number }>({ text: '', key: 0 })
  const [assertive, setAssertive] = useState<{ text: string; key: number }>({ text: '', key: 0 })

  const announce = useCallback<Announce>((msg, pol = 'polite') => {
    // Limpa e recria o nó com key diferente — força releitura mesmo se msg repetir (WCAG: "só fala uma vez")
    if (pol === 'assertive') {
      setAssertive({ text: '', key: 0 })
      // timeout > rAF garante que ATs (NVDA/VO) percebam a remoção antes da reinserção
      setTimeout(() => setAssertive({ text: msg, key: Date.now() }), 50)
    } else {
      setPolite({ text: '', key: 0 })
      setTimeout(() => setPolite({ text: msg, key: Date.now() }), 50)
    }
  }, [])

  return (
    <AnnouncerCtx.Provider value={announce}>
      {children}
      {/* Duas regiões vivas — WCAG 4.1.3. key força remontagem para mensagens idênticas */}
      <div key={`polite-${polite.key}`} aria-live="polite" aria-atomic="true" className="sr-only">
        {polite.text}
      </div>
      <div key={`assertive-${assertive.key}`} aria-live="assertive" aria-atomic="true" className="sr-only">
        {assertive.text}
      </div>
    </AnnouncerCtx.Provider>
  )
}
