import { Navigate, useParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import type { ReactNode } from 'react'

export function Protected({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return <p className="p-8 text-center" aria-live="polite">Carregando…</p>
  if (!isAuthenticated) return <Navigate to="/entrar" replace />
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
