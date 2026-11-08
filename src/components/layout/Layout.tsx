import { useLayoutEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Header } from './Header'
import { SkipLink } from './SkipLink'
import { AccessibilityMenu } from '../accessibility/AccessibilityMenu'
import { NavigationFocusIntentProvider } from '../navigation/NavigationFocusIntent'
import { ResponsiveLayoutProvider } from './ResponsiveLayoutProvider'

export function Layout() {
  const { pathname, search, hash } = useLocation()

  useLayoutEffect(() => {
    if (hash) return
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior })
  }, [hash, pathname, search])

  return (
    <ResponsiveLayoutProvider>
      <NavigationFocusIntentProvider>
        <SkipLink />
        <AccessibilityMenu />
        <div className="min-h-dvh flex flex-col">
          <Header />
          <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            <Outlet />
          </main>
          <footer className="border-t border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
            <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row md:items-end md:justify-between lg:px-8">
              <div className="space-y-1">
                <p className="text-sm text-slate-600 dark:text-slate-400">© {new Date().getFullYear()} Base de Acesso Bibliotecário</p>
              </div>
              <nav aria-label="Links do rodapé" className="flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium">
                <a href="/privacidade" className="text-slate-700 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 dark:text-slate-300">Privacidade</a>
              </nav>
            </div>
          </footer>
        </div>
      </NavigationFocusIntentProvider>
    </ResponsiveLayoutProvider>
  )
}
