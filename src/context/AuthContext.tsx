import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import api from '@/lib/api'
import { AuthContext, type User } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchMe = useCallback(async () => {
    try {
      const { data } = await api.get<{ user: User }>('/auth/session')
      const sessionUser = data.user
      if (sessionUser.role === 'guest' && !sessionUser.school_name) sessionUser.school_name = sessionStorage.getItem('guest_school_name')
      setUser(sessionUser)
    } catch {
      setUser(null)
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

  const login = useCallback(async (username: string, password: string, schoolCode?: string) => {
    const form = new URLSearchParams()
    form.set('username', username)
    form.set('password', password)
    if (schoolCode) form.set('school_code', schoolCode)
    await api.post('/auth/token', form, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    setLoading(true)
    await fetchMe()
  }, [fetchMe])

  const loginGuest = useCallback(async (schoolCode: string, schoolName?: string) => {
    await api.post('/auth/guest', {
      school_code: schoolCode,
    })
    if (schoolName) sessionStorage.setItem('guest_school_name', schoolName)
    sessionStorage.setItem('guest_school_code', schoolCode)
    setLoading(true)
    await fetchMe()
  }, [fetchMe])

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      // ignora
    } finally {
      sessionStorage.removeItem('guest_school_name')
      sessionStorage.removeItem('guest_school_code')
      setUser(null)
    }
  }, [])

  const value = useMemo(
    () => ({ user, loading, login, loginGuest, logout, refreshUser: fetchMe, isAuthenticated: !!user }),
    [user, loading, login, loginGuest, logout, fetchMe],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
