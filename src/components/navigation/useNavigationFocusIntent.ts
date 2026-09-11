import { useContext } from 'react'
import { NavigationFocusIntentContext } from './NavigationFocusIntentContext'

export function useNavigationFocusIntent() {
  return useContext(NavigationFocusIntentContext)
}
