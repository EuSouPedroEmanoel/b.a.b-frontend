import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import api from '@/lib/api'

type User = {
  id: number
  username: string
  email: string | null
  cpf: string | null
  birthdate: string | null
  turma_numero: number | null
  turma_letra: string | null
  role: string
  school_id: number | null
  is_active: boolean
}

type AuthContextType = {
  user: User | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  isAuthenticated: boolean
}

export const AuthContext = createContext<AuthContextType | null>(null)

// Decode JWT payload without verification (only for display)
function decodeSub(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.sub ?? null
  } catch {
    return null
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
          email: null,
          cpf: null,
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
        setUser({ id: 0, username: sub, email: null, cpf: null, birthdate: null, turma_numero: null, turma_letra: null, role: 'unknown', school_id: null, is_active: true })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMe()
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
      localStorage.clear()
      setUser(null)
    }
  }, [])

  const value = useMemo(
    () => ({ user, loading, login, logout, isAuthenticated: !!user }),
    [user, loading, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
