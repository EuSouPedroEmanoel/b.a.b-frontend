import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AnnouncerContext, type Announce } from './LiveRegionContext'

type LiveMessage = { text: string; id: number }
type PendingAnnouncement = LiveMessage & { resolve: () => void }
type Politeness = 'polite' | 'assertive'

export function LiveRegionProvider({ children }: { children: ReactNode }) {
  const [polite, setPolite] = useState<LiveMessage>({ text: '', id: 0 })
  const [assertive, setAssertive] = useState<LiveMessage>({ text: '', id: 0 })
  const nextMessageId = useRef(0)
  const pendingAnnouncements = useRef(new Map<number, PendingAnnouncement>())
  const queues = useRef<Record<Politeness, PendingAnnouncement[]>>({
    polite: [],
    assertive: [],
  })
  const active = useRef<Record<Politeness, boolean>>({
    polite: false,
    assertive: false,
  })

  const showNext = useCallback((politeness: Politeness) => {
    const next = queues.current[politeness].shift()
    if (!next) {
      active.current[politeness] = false
      return
    }

    active.current[politeness] = true
    if (politeness === 'assertive') {
      setAssertive(next)
    } else {
      setPolite(next)
    }
  }, [])

  useLayoutEffect(() => {
    const announcement = pendingAnnouncements.current.get(polite.id)
    if (announcement) {
      pendingAnnouncements.current.delete(polite.id)
      announcement.resolve()
      showNext('polite')
    }
  }, [polite.id, showNext])

  useLayoutEffect(() => {
    const announcement = pendingAnnouncements.current.get(assertive.id)
    if (announcement) {
      pendingAnnouncements.current.delete(assertive.id)
      announcement.resolve()
      showNext('assertive')
    }
  }, [assertive.id, showNext])

  const announce = useCallback<Announce>((msg, pol = 'polite') => {
    const id = ++nextMessageId.current

    return new Promise<void>((resolve) => {
      const announcement = { text: msg, id, resolve }
      pendingAnnouncements.current.set(id, announcement)
      queues.current[pol].push(announcement)

      if (!active.current[pol]) {
        showNext(pol)
      }
    })
  }, [showNext])

  return (
    <AnnouncerContext.Provider value={announce}>
      {children}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        <span key={polite.id}>{polite.text}</span>
      </div>
      <div role="alert" aria-live="assertive" aria-atomic="true" className="sr-only">
        <span key={assertive.id}>{assertive.text}</span>
      </div>
    </AnnouncerContext.Provider>
  )
}
