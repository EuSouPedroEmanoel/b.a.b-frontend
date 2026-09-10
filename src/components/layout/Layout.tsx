import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { SkipLink } from './SkipLink'
import { AccessibilityMenu } from '../accessibility/AccessibilityMenu'

export function Layout() {
  return (
    <>
      <SkipLink />
      <AccessibilityMenu />
      <div className="min-h-dvh flex flex-col">
        <Header />
        <main id="main-content" tabIndex={-1} className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <Outlet />
        </main>
        <footer className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row justify-between gap-2 text-sm text-slate-500">
            <p>© {new Date().getFullYear()} Base de Acesso Bibliotecário — FATEC TCC. Interface acessível WCAG 2.2 AA.</p>
            <p>
              <a href="https://www.w3.org/WAI/standards-guidelines/wcag/" target="_blank" rel="noreferrer" className="underline underline-offset-2">
                Diretrizes W3C
              </a>
            </p>
          </div>
        </footer>
      </div>
    </>
  )
}
