import { useCallback, useEffect, useRef, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { NavigationFocusIntentContext } from './NavigationFocusIntentContext'

type PendingPointerNavigation = {
  destination: string
  expiresAt: number
}

const POINTER_INTENT_LIFETIME = 1000

function pathnameOf(destination: string) {
  return new URL(destination, window.location.origin).pathname
}

export function NavigationFocusIntentProvider({ children }: { children: ReactNode }) {
  const location = useLocation()
  const pendingRef = useRef<PendingPointerNavigation | null>(null)

  const registerMouseNavigation = useCallback((destination: string) => {
    pendingRef.current = {
      destination: pathnameOf(destination),
      expiresAt: Date.now() + POINTER_INTENT_LIFETIME,
    }
  }, [])

  const consumeOperationalFocus = useCallback((destination: string) => {
    const pending = pendingRef.current
    pendingRef.current = null
    return !!pending
      && pending.expiresAt >= Date.now()
      && pending.destination === pathnameOf(destination)
      && pending.destination === location.pathname
  }, [location.pathname])

  useEffect(() => {
    const pending = pendingRef.current
    if (pending && pending.destination !== location.pathname) pendingRef.current = null
  }, [location.key, location.pathname])

  return (
    <NavigationFocusIntentContext.Provider value={{ registerMouseNavigation, consumeOperationalFocus }}>
      {children}
    </NavigationFocusIntentContext.Provider>
  )
}
