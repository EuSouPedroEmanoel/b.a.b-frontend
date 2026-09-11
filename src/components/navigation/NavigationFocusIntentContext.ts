import { createContext } from 'react'

export type NavigationFocusIntentValue = {
  registerMouseNavigation: (destination: string) => void
  consumeOperationalFocus: (destination: string) => boolean
}

export const noNavigationFocusIntent: NavigationFocusIntentValue = {
  registerMouseNavigation: () => undefined,
  consumeOperationalFocus: () => false,
}

export const NavigationFocusIntentContext = createContext<NavigationFocusIntentValue>(noNavigationFocusIntent)
