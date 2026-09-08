import { useAuth } from '@/hooks/useAuth'
import { Navigate } from 'react-router-dom'
import { GuestHome } from './GuestHome'
import { StaffHome } from './StaffHome'
import { StudentHome } from './StudentHome'

const STAFF_ROLES = new Set(['super_admin', 'school_admin', 'librarian'])
const READER_ROLES = new Set(['student', 'teacher'])

export function HomePage() {
  const { user, loading } = useAuth()

  if (loading) return <p className="p-8 text-center" aria-live="polite">Carregando…</p>
  if (user?.role === 'guest') return <GuestHome />
  if (user && READER_ROLES.has(user.role)) return <Navigate to="/inicio" replace />

  // Perfis administrativos e o fallback preservam a Home operacional atual.
  if (user && STAFF_ROLES.has(user.role)) return <StaffHome />
  return <StaffHome />
}

export function DiscoveryHome() {
  const { user, loading } = useAuth()
  if (loading) return <p className="p-8 text-center" aria-live="polite">Carregando…</p>
  if (user?.role === 'guest') return <GuestHome />
  return <StudentHome />
}
