import { createContext } from 'react'

export type User = {
  id: number
  username: string
  name: string
  email: string | null
  cpf_masked?: string | null
  birthdate?: string | null
  turma_numero?: number | null
  turma_letra?: string | null
  role: string
  school_id: number | null
  school_code?: string | null
  school_name?: string | null
  is_active: boolean
  administrative_capabilities?: string[]
}

export type AuthContextType = {
  user: User | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  loginGuest: (schoolCode: string, schoolName?: string) => Promise<void>
  logout: () => Promise<void>
  isAuthenticated: boolean
}

export const AuthContext = createContext<AuthContextType | null>(null)
