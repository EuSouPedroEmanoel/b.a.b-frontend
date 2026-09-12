import { Navigate, useLocation, useParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import type { ReactNode } from 'react'

export function Protected({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return <p className="p-8 text-center" aria-live="polite">Carregando…</p>
  if (!isAuthenticated) return <Navigate to="/entrar" replace />
  return <>{children}</>
}

export function AccountOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <p className="p-8 text-center" aria-live="polite">Carregando…</p>
  if (!user) return <Navigate to="/entrar" replace />
  if (user.role === 'guest') {
    return <Navigate to="/acervo" replace state={{ accessDenied: true, from: location.pathname }} />
  }
  return <>{children}</>
}

export function StudentManagementOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <p className="p-8 text-center" aria-live="polite">Carregando…</p>
  if (!user) return <Navigate to="/entrar" replace />
  if (!['librarian', 'school_admin'].includes(user.role)) return <Navigate to="/" replace />
  return <>{children}</>
}

export function StudentOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <p className="p-8 text-center" aria-live="polite">Carregando…</p>
  if (!user) return <Navigate to="/entrar" replace />
  if (!['student', 'teacher'].includes(user.role)) return <Navigate to="/" replace />
  return <>{children}</>
}

export function PublicOnly({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return <p className="p-8 text-center" aria-live="polite">Carregando…</p>
  if (isAuthenticated) return <Navigate to="/" replace />
  return <>{children}</>
}

export function RedirectBookCopies() {
  const { bookId } = useParams<{ bookId: string }>()
  return <Navigate to={`/acervo/${bookId}`} replace />
}
