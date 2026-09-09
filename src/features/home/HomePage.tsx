import { lazy, Suspense, type ReactNode } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Navigate } from 'react-router-dom'

const GuestHome = lazy(() => import('./GuestHome').then((module) => ({ default: module.GuestHome })))
const StaffHome = lazy(() => import('./StaffHome').then((module) => ({ default: module.StaffHome })))
const StudentHome = lazy(() => import('./StudentHome').then((module) => ({ default: module.StudentHome })))

const STAFF_ROLES = new Set(['super_admin', 'school_admin', 'librarian'])
const READER_ROLES = new Set(['student', 'teacher'])

function HomeContent({ children }: { children: ReactNode }) {
  return <Suspense fallback={<div role="status" aria-live="polite" aria-busy="true" className="flex min-h-[18rem] items-center justify-center text-sm text-[var(--color-text-muted)]">Carregando conteúdo…</div>}>{children}</Suspense>
}

export function HomePage() {
  const { user, loading } = useAuth()

  if (loading) return <p className="p-8 text-center" aria-live="polite">Carregando…</p>
  if (user?.role === 'guest') return <HomeContent><GuestHome /></HomeContent>
  if (user && READER_ROLES.has(user.role)) return <Navigate to="/inicio" replace />

  // Perfis administrativos e o fallback preservam a Home operacional atual.
  if (user && STAFF_ROLES.has(user.role)) return <HomeContent><StaffHome /></HomeContent>
  return <HomeContent><StaffHome /></HomeContent>
}

export function DiscoveryHome() {
  const { user, loading } = useAuth()
  if (loading) return <p className="p-8 text-center" aria-live="polite">Carregando…</p>
  if (user?.role === 'guest') return <HomeContent><GuestHome /></HomeContent>
  return <HomeContent><StudentHome /></HomeContent>
}
