import { createContext } from 'react'

export type User = {
  id: number
  username: string
  name: string
  cpf_masked?: string | null
  birthdate?: string | null
  turma_numero?: number | null
  turma_letra?: string | null
  role: string
  school_id: number | null
  school_code?: string | null
  school_name?: string | null
  school_allows_student_condition_filter?: boolean
  school_allows_student_restricted_availability?: boolean
  is_active: boolean
  administrative_capabilities?: string[]
  terms_accepted_version?: string | null
  terms_accepted_at?: string | null
  terms_current_version?: string | null
}

export type AuthContextType = {
  user: User | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  loginGuest: (schoolCode: string, schoolName?: string) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
  acceptTerms: () => Promise<void>
  isAuthenticated: boolean
}

export const AuthContext = createContext<AuthContextType | null>(null)
