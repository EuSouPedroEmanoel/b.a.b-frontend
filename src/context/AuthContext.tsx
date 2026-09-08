import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import api from '@/lib/api'
import { AuthContext, type User } from './auth-context'

// Decode JWT payload without verification (only for display)
function decodeSub(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.sub ?? null
  } catch {
    return null
  }
}

function decodeClaim(token: string, claim: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return typeof payload[claim] === 'string' ? payload[claim] : null
  } catch {
    return null
  }
}

function guestUser(token: string): User | null {
  if (decodeClaim(token, 'role') !== 'guest') return null
  const schoolCode = decodeClaim(token, 'school_code')
  if (!schoolCode) return null
  return {
    id: 0,
    username: 'Visitante',
    name: 'Visitante',
    email: null,
    cpf_masked: null,
    birthdate: null,
    turma_numero: null,
    turma_letra: null,
    role: 'guest',
    school_id: null,
    school_code: schoolCode,
    school_name: sessionStorage.getItem('guest_school_name'),
    is_active: true,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchMe = useCallback(async () => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      setUser(null)
      setLoading(false)
      return
    }
    const guest = guestUser(token)
    if (guest) {
      setUser(guest)
      setLoading(false)
      return
    }
    const username = decodeSub(token)
    if (!username) {
      setLoading(false)
      return
    }
    try {
      // Backend retorna PaginatedResponse { items, ... } (atual) ou legado { users } — suporta ambos
      type PaginatedUsers = { items?: User[]; users?: User[] }
      const { data } = await api.get<PaginatedUsers>('/users/?size=100')
      const list: User[] = (data.items ?? data.users ?? []) as User[]
      const found = list.find((u) => u.username === username) ?? null
      if (found) setUser(found)
      else
        setUser({
          id: 0,
          username,
          name: username,
          email: null,
          cpf_masked: null,
          birthdate: null,
          turma_numero: null,
          turma_letra: null,
          role: 'unknown',
          school_id: null,
          is_active: true,
        })
    } catch {
      // se falhar listagem (permissão), mantém minimal user para não deslogar
      const sub = decodeSub(token)
      if (sub)
        setUser({ id: 0, username: sub, name: sub, email: null, cpf_masked: null, birthdate: null, turma_numero: null, turma_letra: null, role: 'unknown', school_id: null, is_active: true })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void fetchMe()
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [fetchMe])

  const login = useCallback(async (username: string, password: string) => {
    const form = new URLSearchParams()
    form.set('username', username)
    form.set('password', password)
    const { data } = await api.post<{ access_token: string; refresh_token: string }>('/auth/token', form, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    localStorage.setItem('access_token', data.access_token)
    localStorage.setItem('refresh_token', data.refresh_token)
    localStorage.setItem('session_kind', 'account')
    setLoading(true)
    await fetchMe()
  }, [fetchMe])

  const loginGuest = useCallback(async (schoolCode: string, schoolName?: string) => {
    const { data } = await api.post<{ access_token: string }>('/auth/guest', {
      school_code: schoolCode,
    })
    localStorage.setItem('access_token', data.access_token)
    localStorage.removeItem('refresh_token')
    localStorage.setItem('session_kind', 'guest')
    if (schoolName) sessionStorage.setItem('guest_school_name', schoolName)
    sessionStorage.setItem('guest_school_code', schoolCode)
    setLoading(true)
    await fetchMe()
  }, [fetchMe])

  const logout = useCallback(async () => {
    const refresh = localStorage.getItem('refresh_token')
    try {
      if (refresh) await api.post('/auth/logout', { refresh_token: refresh })
    } catch {
      // ignora
    } finally {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      localStorage.removeItem('session_kind')
      sessionStorage.removeItem('guest_school_name')
      sessionStorage.removeItem('guest_school_code')
      setUser(null)
    }
  }, [])

  const value = useMemo(
    () => ({ user, loading, login, loginGuest, logout, isAuthenticated: !!user }),
    [user, loading, login, loginGuest, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
