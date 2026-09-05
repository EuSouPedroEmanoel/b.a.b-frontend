import { createContext, useContext } from 'react'

/**
 * Announces a message and resolves after React has committed it to the live
 * region. The promise does not indicate that a screen reader has finished
 * speaking the message.
 */
export type Announce = (
  msg: string,
  politeness?: 'polite' | 'assertive',
) => Promise<void>

export const AnnouncerContext = createContext<Announce>(() => Promise.resolve())

export function useAnnouncer() {
  return useContext(AnnouncerContext)
}
