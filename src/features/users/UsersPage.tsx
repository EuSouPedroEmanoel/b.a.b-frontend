import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Users, Pencil, Plus, AlertTriangle, MonitorCog, RefreshCw } from 'lucide-react'
import api from '@/lib/api'
import { formatCpfInput, onlyDigits, validateCpfDigits } from '@/lib/cpf'
import { getErrorFieldMessages, getErrorMessage } from '@/lib/errors'
import { useAnnouncer } from '@/components/feedback/LiveRegionContext'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Select } from '@/components/ui/Select'
import { Autocomplete, type AutocompleteOption } from '@/components/ui/Autocomplete'
import { PageDescription } from '@/components/ui/PageDescription'
import { SchoolSuggestion } from '@/components/ui/SchoolSuggestion'
import { ModalDialog } from '@/components/ui/ModalDialog'
import { Tooltip } from '@/components/ui/Tooltip'
import { Pagination } from '@/components/ui/Pagination'
import { UndoSnackbar } from '@/components/feedback/UndoSnackbar'
import { ActivationActions, ActivationInvitationDialog, ResetPasswordAction, type CreatedUserInvitation } from './ActivationInvitationDialog'

type AppUser = {
  id: number
  username: string
  name: string
  cpf_masked: string | null
  birthdate: string | null
  turma_numero: number | null
  turma_letra: string | null
  role: string
  school_id: number | null
  school_name: string | null
  school_code: string | null
  is_active: boolean
  account_status: 'pending_activation' | 'active' | 'disabled'
  created_at: string | null
  updated_at: string | null
  administrative_capabilities?: string[]
}
type Paginated<T> = { items: T[]; total: number; page: number; size: number; pages: number }
type School = { id: number; name: string; code: string; is_active: boolean }

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Todos os tipos' },
  { value: 'student', label: 'Aluno' },
  { value: 'librarian', label: 'Bibliotecário' },
  { value: 'teacher', label: 'Professor' },
  { value: 'school_admin', label: 'Admin da escola' },
  { value: 'super_admin', label: 'Super admin' },
]

function roleLabel(role: string): string {
  const found = ROLE_OPTIONS.find((o) => o.value === role)
  return found ? found.label : role
}

function turmaLabel(n: number | null, l: string | null): string {
  if (n === null || !l) return '—'
  return `${n}${l.toUpperCase()}`
}

function schoolLabel(name: string | null, code: string | null): string {
  if (name && code) return `${name} (${code})`
  if (name) return name
  return '—'
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  const [y, m, d] = value.slice(0, 10).split('-')
  if (!y || !m || !d) return value
  return `${d}/${m}/${y}`
}

function currentSchoolYear(now = new Date()): number {
  return now.getMonth() + 1 >= 2 ? now.getFullYear() : now.getFullYear() - 1
}

function schoolYearStart(year: number): Date {
  return new Date(year, 1, 1, 0, 0, 0, 0)
}

function isDeprecatedTurma(updatedAt: string | null, now = new Date()): boolean {
  if (!updatedAt) return false
  const studentUpdated = new Date(updatedAt)
  if (Number.isNaN(studentUpdated.getTime())) return false
  return studentUpdated < schoolYearStart(currentSchoolYear(now))
}

function parseDate(value: string): Date | null {
  const [y, m, d] = value.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function validateBirthdate(value: string): { ok: boolean; message?: string } {
  if (!value) return { ok: false, message: 'Informe a data de nascimento' }
  const dt = parseDate(value)
  if (!dt) return { ok: false, message: 'Data de nascimento inválida' }
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (dt >= today) return { ok: false, message: 'Nascimento deve ser uma data no passado' }
  let age = now.getFullYear() - dt.getFullYear()
  const m = now.getMonth() - dt.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < dt.getDate())) age--
  if (age < 4 || age > 20) return { ok: false, message: 'Idade fora do intervalo permitido (4–20 anos)' }
  return { ok: true }
}

type CreateForm = {
  type: string
  name: string
  username: string
  cpf: string
  birthdate: string
  turmaNumero: string
  turmaLetra: string
  schoolId: string
}

const emptyCreate: CreateForm = {
  type: 'student',
  name: '',
  username: '',
  cpf: '',
  birthdate: '',
  turmaNumero: '',
  turmaLetra: '',
  schoolId: '',
}

export function UsersPage() {
  const announce = useAnnouncer()
  const qc = useQueryClient()
  const [role, setRole] = useState('')
  const [schoolFilter, setSchoolFilter] = useState('')
  const [page, setPage] = useState(1)
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState<CreateForm>(emptyCreate)
  const [createError, setCreateError] = useState('')
  const [createFieldErrors, setCreateFieldErrors] = useState<Record<string, string>>({})
  const [createdInvitation, setCreatedInvitation] = useState<CreatedUserInvitation | null>(null)
  const [editing, setEditing] = useState<AppUser | null>(null)
  const [editForm, setEditForm] = useState({ name: '', birthdate: '', turmaNumero: '', turmaLetra: '', password: '', manageLibraryCalendar: false, manageCirculationRules: false })
  const [changingSituation, setChangingSituation] = useState<AppUser | null>(null)
  const [situationJustification, setSituationJustification] = useState('')
  const [situationError, setSituationError] = useState('')
  const [confirmSituation, setConfirmSituation] = useState<AppUser | null>(null)
  const [undoSituation, setUndoSituation] = useState<AppUser | null>(null)

  const { user: currentUser } = useAuth()

  const isSuperAdmin = currentUser?.role === 'super_admin'
  const canManageStaffCapabilities = currentUser?.role === 'school_admin'
  const canEditUser = (u: AppUser) => !isSuperAdmin || u.role === 'school_admin'

  const { data: schoolsData } = useQuery({
    queryKey: ['schools', 'options'],
    queryFn: async () => {
      const { data } = await api.get<Paginated<School>>('/schools/?size=100')
      return data
    },
    enabled: isSuperAdmin,
  })
  const schoolOptions: AutocompleteOption<School>[] = (schoolsData?.items ?? []).filter((school) => school.is_active).map((school) => ({
    value: String(school.id),
    label: school.name,
    data: school,
  }))
  const queryKey = ['users', role, schoolFilter, page]
  const { data, isLoading, isError, error } = useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), size: '10' })
      if (role) params.set('role', role)
      if (schoolFilter) params.set('school_id', schoolFilter)
      const { data } = await api.get<Paginated<AppUser>>(`/users/?${params.toString()}`)
      return data
    },
  })

  const create = useMutation({
    mutationFn: async () => {
      const f = createForm
      if (isSuperAdmin && !f.schoolId) {
        throw new Error('Selecione a escola do novo usuário.')
      }
      const schoolId = isSuperAdmin ? Number(f.schoolId) : undefined
      if (f.type === 'student') {
        const { data } = await api.post<AppUser & CreatedUserInvitation>('/users/', {
          name: f.name.trim(),
          cpf: f.cpf,
          birthdate: f.birthdate,
          turma_numero: Number(f.turmaNumero),
          turma_letra: f.turmaLetra,
          role: 'student',
          ...(schoolId ? { school_id: schoolId } : {}),
        })
        return data
      }
      if (f.type === 'school_admin' && isSuperAdmin) {
        const { data } = await api.post<AppUser & CreatedUserInvitation>(`/schools/${schoolId}/admins`, {
          username: f.username.trim(),
          name: f.name.trim(),
          cpf: f.cpf,
        })
        return data
      }
      const { data } = await api.post<AppUser & CreatedUserInvitation>('/users/', {
        username: f.username.trim(),
        name: f.name.trim(),
        cpf: f.cpf,
        role: f.type,
        ...(schoolId ? { school_id: schoolId } : {}),
      })
      return data
    },
    onSuccess: (createdUser) => {
      announce('Usuário criado com sucesso', 'polite')
      setShowCreate(false)
      setCreateForm(emptyCreate)
      setCreateError('')
      setCreateFieldErrors({})
      setCreatedInvitation(createdUser)
      qc.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (err: unknown) => {
      const message = getErrorMessage(err, 'Erro ao criar usuário')
      setCreateError(message)
      setCreateFieldErrors(getErrorFieldMessages(err))
      announce(message, 'assertive')
    },
  })

  const update = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = { name: editForm.name.trim() }
      if (editing?.role === 'student') {
        payload.birthdate = editForm.birthdate
        payload.turma_numero = Number(editForm.turmaNumero)
        payload.turma_letra = editForm.turmaLetra
      }
      const { data } = await api.put<AppUser>(`/users/${editing?.id}`, payload)
      if (editing?.role === 'librarian' && canManageStaffCapabilities) {
        await api.put(`/users/${editing.id}/administrative-capabilities`, {
          capabilities: [
            ...(editForm.manageLibraryCalendar ? ['manage_library_calendar'] : []),
            ...(editForm.manageCirculationRules ? ['manage_circulation_rules'] : []),
          ],
        })
      }
      return data
    },
    onSuccess: () => {
      announce('Usuário atualizado com sucesso', 'polite')
      closeEdit()
      qc.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (err: unknown) => {
      announce(getErrorMessage(err, 'Erro ao atualizar usuário'), 'assertive')
    },
  })

  const situation = useMutation({
    mutationFn: async ({ target, active, justification }: { target: AppUser; active: boolean; justification?: string }) => (await api.post<AppUser>(`/users/${target.id}/situation`, { is_active: active, justification })).data,
    onSuccess: (_, variables) => {
      setChangingSituation(null)
      setConfirmSituation(null)
      setUndoSituation(variables.target)
      setSituationError('')
      qc.invalidateQueries({ queryKey: ['users'] })
      announce(variables.active ? 'Usuário reativado.' : 'Usuário desativado.', 'polite')
    },
    onError: (error) => {
      const message = getErrorMessage(error, 'Não foi possível alterar a situação do usuário.')
      setSituationError(message)
      announce(message, 'assertive')
    },
  })
  const undoSituationMutation = useMutation({
    mutationFn: async (target: AppUser) => (await api.post<AppUser>(`/users/${target.id}/situation/undo`)).data,
    onSuccess: () => { setUndoSituation(null); qc.invalidateQueries({ queryKey: ['users'] }); announce('Situação anterior do usuário restaurada.', 'polite') },
    onError: (error) => announce(getErrorMessage(error, 'Não foi possível desfazer a alteração.'), 'assertive'),
  })

  const submitCreate = (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError('')
    setCreateFieldErrors({})
    const f = createForm
    const fail = (field: string, message: string) => {
      setCreateError(message)
      setCreateFieldErrors({ [field]: message })
      announce(message, 'assertive')
      window.requestAnimationFrame(() => document.getElementById(`create-${field}`)?.focus())
    }
    if (isSuperAdmin && !f.schoolId) {
      fail('school', 'Selecione a escola do novo usuário')
      return
    }
    if (f.type === 'student') {
      if (!f.name.trim()) return fail('name', 'Informe o nome completo')
      if (!validateCpfDigits(f.cpf)) return fail('cpf', 'Informe um CPF válido')
      const bd = validateBirthdate(f.birthdate)
      if (!bd.ok) return fail('birthdate', bd.message ?? 'Data de nascimento inválida')
      if (!f.turmaNumero) return fail('turmaNumero', 'Informe o número da turma')
      if (!f.turmaLetra.trim()) return fail('turmaLetra', 'Informe a letra da turma')
    } else {
      if (!f.username.trim()) return fail('username', 'Informe o nome de usuário')
      if (!f.name.trim()) return fail('name', 'Informe o nome completo')
      if (!validateCpfDigits(f.cpf)) return fail('cpf', 'Informe um CPF válido')
    }
    create.mutate()
  }

  const openEdit = (u: AppUser) => {
    if (!canEditUser(u)) return
    setEditing(u)
    setEditForm({
      name: u.name || u.username,
      birthdate: u.birthdate ?? '',
      turmaNumero: u.turma_numero === null ? '' : String(u.turma_numero),
      turmaLetra: u.turma_letra ?? '',
      password: '',
      manageLibraryCalendar: (u.administrative_capabilities ?? []).includes('manage_library_calendar'),
      manageCirculationRules: (u.administrative_capabilities ?? []).includes('manage_circulation_rules'),
    })
  }

  const closeEdit = () => {
    setEditing(null)
    setEditForm({ name: '', birthdate: '', turmaNumero: '', turmaLetra: '', password: '', manageLibraryCalendar: false, manageCirculationRules: false })
  }

  const availableCreateTypes = useMemo(() => {
    const allowed = isSuperAdmin
      ? ['student', 'librarian', 'teacher', 'school_admin']
      : ['student', 'librarian', 'teacher']
    return ROLE_OPTIONS.filter((o) => allowed.includes(o.value))
  }, [isSuperAdmin])

  const filterRoleOptions = useMemo(() => {
    return isSuperAdmin ? ROLE_OPTIONS : ROLE_OPTIONS.filter((o) => o.value !== 'super_admin')
  }, [isSuperAdmin])

  const deprecatedCount = useMemo(
    () => (role === '' || role === 'student' ? (data?.items ?? []).filter((u) => u.role === 'student' && isDeprecatedTurma(u.updated_at)).length : 0),
    [data, role],
  )

  const sections = useMemo(() => {
    if (role) {
      const isStudent = role === 'student'
      return [
        {
          key: role,
          title: roleLabel(role),
          roles: [role],
          showCpf: role !== 'super_admin',
          showSchool: isSuperAdmin,
          showTurma: isStudent,
          showNascimento: isStudent,
        },
      ]
    }
    if (isSuperAdmin) {
      return [
        {
          key: 'school_admin',
          title: 'Admins da escola',
          roles: ['school_admin'],
          showCpf: true,
          showSchool: isSuperAdmin,
          showTurma: false,
          showNascimento: false,
        },
        {
          key: 'librarian',
          title: 'Bibliotecários',
          roles: ['librarian'],
          showCpf: true,
          showSchool: isSuperAdmin,
          showTurma: false,
          showNascimento: false,
        },
        {
          key: 'teacher',
          title: 'Professores',
          roles: ['teacher'],
          showCpf: true,
          showSchool: isSuperAdmin,
          showTurma: false,
          showNascimento: false,
        },
        {
          key: 'student',
          title: 'Alunos',
          roles: ['student'],
          showCpf: true,
          showSchool: isSuperAdmin,
          showTurma: true,
          showNascimento: true,
        },
      ]
    }
    return [
      {
        key: 'student',
        title: 'Alunos',
        roles: ['student'],
        showCpf: true,
        showSchool: isSuperAdmin,
        showTurma: true,
        showNascimento: true,
      },
      {
        key: 'school_admin',
        title: 'Admin da escola',
        roles: ['school_admin'],
        showCpf: true,
        showSchool: isSuperAdmin,
        showTurma: false,
        showNascimento: false,
      },
      {
        key: 'staff',
        title: 'Bibliotecários e professores',
        roles: ['librarian', 'teacher'],
        showCpf: true,
        showSchool: isSuperAdmin,
        showTurma: false,
        showNascimento: false,
      },
      {
        key: 'super_admin',
        title: 'Super admin',
        roles: ['super_admin'],
        showCpf: false,
        showSchool: false,
        showTurma: false,
        showNascimento: false,
      },
    ]
  }, [isSuperAdmin, role])

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Usuários</h1>
          <PageDescription>
            {isSuperAdmin
              ? 'Visão global — filtre por tipo de usuário e por escola.'
              : 'Usuários da sua escola — filtre por tipo.'}
          </PageDescription>
        </div>
        <Button onClick={() => { setCreateError(''); setCreateFieldErrors({}); setCreateForm({ ...emptyCreate, type: isSuperAdmin ? 'school_admin' : 'student' }); setShowCreate(true) }}>
          <Plus className="h-4 w-4 mr-2" aria-hidden="true" /> Criar usuário
        </Button>
      </header>

      <Card>
        <CardBody className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Tipo de usuário"
              id="user-role"
              value={role}
              onChange={(value) => { setRole(value); setPage(1) }}
            options={filterRoleOptions.map((o) => ({ value: o.value, label: o.label }))}
          />
          {isSuperAdmin && (
            <Autocomplete
              label="Escola"
              id="user-school"
              value={schoolFilter}
              onChange={(value) => { setSchoolFilter(value); setPage(1) }}
              options={schoolOptions}
              placeholder="Todas as escolas"
              hint="Deixe vazio para exibir usuários de todas as escolas."
              renderOption={(option) => <SchoolSuggestion option={option} />}
            />
          )}
        </CardBody>
      </Card>

      {isSuperAdmin && (
        <p role="status" className="rounded-md border border-blue-200 bg-blue-50 p-4 text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100">
          Você está consultando usuários em modo somente leitura. Apenas administradores das escolas podem ser editados pelo Super Admin.
        </p>
      )}

      {deprecatedCount > 0 && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 text-sm text-amber-800 dark:text-amber-200"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" aria-hidden="true" />
          <p>
            <strong>{deprecatedCount} aluno(s)</strong> sem atualização na turma desde o início do
            ano letivo de {currentSchoolYear()}. Confirme e atualize as turmas.
          </p>
        </div>
      )}

      {isLoading && (
        <Card>
          <CardBody>
            <p aria-live="polite">Carregando usuários…</p>
          </CardBody>
        </Card>
      )}

      {isError && (
        <div role="alert" className="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 p-4 text-sm text-red-800 dark:text-red-200">
          Erro ao carregar usuários: {(error as { message?: string })?.message ?? 'tente novamente'}
        </div>
      )}

      {data && (
        <div className="flex flex-col gap-6">
          {sections
            .map((sec) => {
              const items = data.items.filter((u) => sec.roles.includes(u.role))
              return { ...sec, items }
            })
            .filter((sec) => sec.items.length > 0)
            .map((sec) => (
              <Card key={sec.key} className={isSuperAdmin && sec.items.every((u) => !canEditUser(u)) ? 'opacity-60' : ''}>
                <CardHeader className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-semibold flex items-center gap-2">
                    <Users className="h-5 w-5" aria-hidden="true" /> {sec.title}
                  </h2>
                  <Badge tone="info">{`${sec.items.length} registro(s)`}</Badge>
                </CardHeader>
                <CardBody className="p-0">
                  <div className="@container w-full max-w-full min-w-0">
                    <table className="w-full table-fixed border-spacing-0 min-w-0 text-sm @max-lg:hidden">
                      <caption className="sr-only">{sec.title}</caption>
                      <thead className="bg-slate-50 dark:bg-slate-700/50">
                        <tr>
                          <th scope="col" className="px-4 py-3 text-left font-semibold">Identificação</th>
                          {sec.showCpf && <th scope="col" className="px-4 py-3 text-left font-semibold @max-lg:hidden">CPF</th>}
                          {sec.showSchool && <th scope="col" className="px-4 py-3 text-left font-semibold @max-lg:hidden">Escola</th>}
                          {sec.showTurma && <th scope="col" className="px-4 py-3 text-left font-semibold">Turma</th>}
                          {sec.showNascimento && <th scope="col" className="px-4 py-3 text-left font-semibold @max-lg:hidden">Nascimento</th>}
                          <th scope="col" className="w-44 whitespace-nowrap px-4 py-3 text-right font-semibold @max-lg:w-auto">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {sec.items.map((u) => {
                          const deprecated = u.role === 'student' && isDeprecatedTurma(u.updated_at)
                          const readOnly = !canEditUser(u)
                          return (
                            <tr key={u.id} className={readOnly ? 'opacity-60' : undefined}>
                              <td className="break-words [overflow-wrap:anywhere] px-4 py-3 align-top font-medium">
                                <span>{u.name || u.username}</span>
                                <span className="ml-2"><Badge tone={u.account_status === 'active' ? 'success' : u.account_status === 'pending_activation' ? 'warning' : 'danger'}>{u.account_status === 'active' ? 'Ativa' : u.account_status === 'pending_activation' ? 'Pendente' : 'Desativada'}</Badge></span>
                                {currentUser?.id === u.id && <span className="ml-2 text-sm font-normal text-slate-600 dark:text-slate-300">(EU)</span>}
                                <div className="mt-1 space-y-0.5 text-xs font-normal text-slate-600 dark:text-slate-300">
                                  <p className="break-words font-mono">{u.username}</p>
                                  {sec.showCpf && <p className="hidden font-mono @max-lg:block">CPF: {u.cpf_masked ?? '—'}</p>}
                                  {sec.showSchool && <p className="hidden break-words @max-lg:block">Escola: {schoolLabel(u.school_name, u.school_code)}</p>}
                                  {sec.showTurma && <p className="hidden @max-lg:block">Turma: {turmaLabel(u.turma_numero, u.turma_letra)}{deprecated ? ' · Atualizar' : ''}</p>}
                                  {sec.showNascimento && <p className="hidden @max-lg:block">Nascimento: {formatDate(u.birthdate)}</p>}
                                </div>
                              </td>
                              {sec.showCpf && <td className="break-words px-4 py-3 align-top font-mono text-xs @max-lg:hidden">{u.cpf_masked ?? '—'}</td>}
                              {sec.showSchool && (
                                <td className="break-words px-4 py-3 align-top @max-lg:hidden">{schoolLabel(u.school_name, u.school_code)}</td>
                              )}
                              {sec.showTurma && (
                                <td className="px-4 py-3 align-top">
                                  <span className="flex items-center gap-2">
                                    {turmaLabel(u.turma_numero, u.turma_letra)}
                                    {deprecated && <Badge tone="warning">Atualizar</Badge>}
                                  </span>
                                </td>
                              )}
                              {sec.showNascimento && (
                                <td className="px-4 py-3 align-top @max-lg:hidden">{formatDate(u.birthdate)}</td>
                              )}
                              <td className="whitespace-nowrap px-4 py-3 text-right align-top @max-lg:w-auto">
                                <div className="flex flex-nowrap items-center justify-end gap-2">
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => openEdit(u)}
                                    disabled={readOnly}
                                    aria-label={`Editar usuário ${u.name || u.username}`}
                                    aria-describedby={`edit-user-tooltip-${u.id}`}
                                    className={`relative ${readOnly ? 'bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-400' : ''}`}
                                  >
                                    <Pencil className="h-5 w-5" aria-hidden="true" />
                                    <span className="sr-only">Editar</span>
                                    <Tooltip id={`edit-user-tooltip-${u.id}`}>Editar</Tooltip>
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    disabled
                                    aria-label={`Configurar usuário ${u.name || u.username}`}
                                    aria-describedby={`configure-user-tooltip-${u.id}`}
                                    className="relative"
                                  >
                                    <MonitorCog className="h-5 w-5" aria-hidden="true" />
                                    <span className="sr-only">Configurar usuário</span>
                                    <Tooltip id={`configure-user-tooltip-${u.id}`}>Configurar usuário</Tooltip>
                                  </Button>
                                  <ActivationActions user={u} onUpdated={() => void qc.invalidateQueries({ queryKey: ['users'] })} />
                                  <Button size="sm" variant="secondary" className="!px-3 @max-lg:!px-2.5" onClick={() => { if (u.is_active) { setChangingSituation(u); setSituationJustification(''); setSituationError('') } else setConfirmSituation(u) }} disabled={readOnly || currentUser?.id === u.id} aria-label={u.is_active ? `Alterar situação de ${u.name || u.username}` : `Reativar usuário ${u.name || u.username}`}>
                                    <RefreshCw className="hidden h-4 w-4 @max-lg:block" aria-hidden="true" />
                                    <span className="@max-lg:hidden">{u.is_active ? 'Alterar situação' : 'Reativar usuário'}</span>
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    <div className="hidden w-full min-w-0 gap-3 p-3 @max-lg:grid">
                      {sec.items.map((u) => {
                        const deprecated = u.role === 'student' && isDeprecatedTurma(u.updated_at)
                        const readOnly = !canEditUser(u)
                        return (
                          <article key={u.id} className={`w-full min-w-0 rounded-lg border border-slate-200 p-3 dark:border-slate-700 ${readOnly ? 'opacity-60' : ''}`}>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <strong className="break-words [overflow-wrap:anywhere]">{u.name || u.username}</strong>
                                <Badge tone={u.account_status === 'active' ? 'success' : u.account_status === 'pending_activation' ? 'warning' : 'danger'}>{u.account_status === 'active' ? 'Ativa' : u.account_status === 'pending_activation' ? 'Pendente' : 'Desativada'}</Badge>
                                {currentUser?.id === u.id && <span className="text-sm text-slate-600 dark:text-slate-300">(EU)</span>}
                              </div>
                              <dl className="mt-2 grid gap-1 text-xs text-slate-600 dark:text-slate-300">
                                <div><dt className="inline font-semibold">Usuário: </dt><dd className="inline break-words font-mono">{u.username}</dd></div>
                                {sec.showCpf && <div><dt className="inline font-semibold">CPF: </dt><dd className="inline font-mono">{u.cpf_masked ?? '—'}</dd></div>}
                                {sec.showSchool && <div><dt className="inline font-semibold">Escola: </dt><dd className="inline break-words">{schoolLabel(u.school_name, u.school_code)}</dd></div>}
                                {sec.showTurma && <div><dt className="inline font-semibold">Turma: </dt><dd className="inline">{turmaLabel(u.turma_numero, u.turma_letra)}{deprecated ? ' · Atualizar' : ''}</dd></div>}
                                {sec.showNascimento && <div><dt className="inline font-semibold">Nascimento: </dt><dd className="inline">{formatDate(u.birthdate)}</dd></div>}
                              </dl>
                            </div>
                            <div className="mt-3 flex flex-wrap justify-end gap-2">
                              <Button size="sm" variant="secondary" onClick={() => openEdit(u)} disabled={readOnly} aria-label={`Editar usuário ${u.name || u.username}`} className={`!px-3 ${readOnly ? 'bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-400' : ''}`}>
                                <Pencil className="h-5 w-5" aria-hidden="true" /><span className="sr-only">Editar</span>
                              </Button>
                              <Button type="button" size="sm" variant="secondary" disabled aria-label={`Configurar usuário ${u.name || u.username}`} className="!px-3">
                                <MonitorCog className="h-5 w-5" aria-hidden="true" /><span className="sr-only">Configurar usuário</span>
                              </Button>
                              <ActivationActions user={u} onUpdated={() => void qc.invalidateQueries({ queryKey: ['users'] })} />
                              <Button size="sm" variant="secondary" className="!px-3" onClick={() => { if (u.is_active) { setChangingSituation(u); setSituationJustification(''); setSituationError('') } else setConfirmSituation(u) }} disabled={readOnly || currentUser?.id === u.id} aria-label={u.is_active ? `Alterar situação de ${u.name || u.username}` : `Reativar usuário ${u.name || u.username}`}>
                                <RefreshCw className="h-4 w-4" aria-hidden="true" /><span className="sr-only">{u.is_active ? 'Alterar situação' : 'Reativar usuário'}</span>
                              </Button>
                            </div>
                          </article>
                        )
                      })}
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
          {data.items.length === 0 && (
            <Card>
              <CardBody>
                <p className="text-sm text-slate-500">Nenhum usuário encontrado para os filtros.</p>
              </CardBody>
            </Card>
          )}
          <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />
        </div>
      )}

      {showCreate && (
        <ModalDialog variant="form" title="Criar usuário" onClose={() => { setCreateError(''); setCreateFieldErrors({}); setShowCreate(false) }}>
          <form onSubmit={submitCreate} className="grid gap-4">
            {createError && (
              <p id="create-error" role="alert" aria-live="assertive" className="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-800 dark:text-red-200">
                {createError}
              </p>
            )}
            <Select
              label="Tipo de usuário"
              id="create-type"
              value={createForm.type}
              onChange={(v) => { setCreateFieldErrors({}); setCreateError(''); setCreateForm((f) => ({ ...f, type: v })) }}
              options={availableCreateTypes.filter((o) => o.value !== '').map((o) => ({ value: o.value, label: o.label }))}
            />

            {isSuperAdmin && (
              <div>
                <Select
                  label="Escola"
                  id="create-school"
                  value={createForm.schoolId}
                  onChange={(value) => setCreateForm((f) => ({ ...f, schoolId: value }))}
                  options={schoolOptions.map((option) => ({ value: option.value, label: schoolLabel(option.data.name, option.data.code) }))}
                  placeholder="Selecione uma escola"
                  disabled={!schoolOptions.length}
                />
                {createFieldErrors.school && <p role="alert" className="mt-1 text-sm text-red-700 dark:text-red-300">{createFieldErrors.school}</p>}
                {!schoolOptions.length && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Nenhuma escola ativa disponível.</p>}
              </div>
            )}

            {createForm.type === 'student' ? (
              <>
                <Input id="create-name" label="Nome completo" value={createForm.name} error={createFieldErrors.name} onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} required autoComplete="off" maxLength={120} />
                <Input id="create-cpf" label="CPF" value={formatCpfInput(createForm.cpf)} error={createFieldErrors.cpf} onChange={(e) => setCreateForm((f) => ({ ...f, cpf: onlyDigits(e.target.value) }))} placeholder="000.000.000-00" required inputMode="numeric" autoComplete="off" />
                <Input id="create-birthdate" label="Nascimento" type="date" value={createForm.birthdate} error={createFieldErrors.birthdate} onChange={(e) => setCreateForm((f) => ({ ...f, birthdate: e.target.value }))} required autoComplete="off" hint="A senha será criada pelo aluno no primeiro acesso." />
                <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))] gap-4">
                  <div className="min-w-0"><Input id="create-turmaNumero" label="Turma — número" value={createForm.turmaNumero} error={createFieldErrors.turmaNumero} onChange={(e) => setCreateForm((f) => ({ ...f, turmaNumero: e.target.value.replace(/[^0-9]/g, '').slice(0, 2) }))} placeholder="ex: 7" required inputMode="numeric" autoComplete="off" /></div>
                  <div className="min-w-0"><Input id="create-turmaLetra" label="Turma — letra" value={createForm.turmaLetra} error={createFieldErrors.turmaLetra} onChange={(e) => setCreateForm((f) => ({ ...f, turmaLetra: e.target.value.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 1) }))} placeholder="ex: A" required maxLength={1} autoComplete="off" /></div>
                </div>
              </>
            ) : (
              <>
                <Input id="create-username" label="Nome de usuário" value={createForm.username} error={createFieldErrors.username} onChange={(e) => setCreateForm((f) => ({ ...f, username: e.target.value }))} required autoComplete="off" maxLength={120} />
                <Input id="create-name" label="Nome completo" value={createForm.name} error={createFieldErrors.name} onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} required autoComplete="off" maxLength={120} />
                <Input id="create-cpf" label="CPF" value={formatCpfInput(createForm.cpf)} error={createFieldErrors.cpf} onChange={(e) => setCreateForm((f) => ({ ...f, cpf: onlyDigits(e.target.value) }))} placeholder="000.000.000-00" required inputMode="numeric" autoComplete="off" />
              </>
            )}

            <div className="flex flex-wrap gap-3 pt-2">
              <Button type="button" variant="danger-secondary" className="min-w-max flex-1" onClick={() => { setCreateError(''); setCreateFieldErrors({}); setShowCreate(false) }}>
                Cancelar
              </Button>
              <Button type="submit" variant="blue-secondary" className="min-w-max flex-1" disabled={create.isPending} aria-busy={create.isPending}>
                {create.isPending ? 'Criando…' : 'Criar'}
              </Button>
            </div>
          </form>
        </ModalDialog>
      )}

      {createdInvitation && <ActivationInvitationDialog created={createdInvitation} onClose={() => setCreatedInvitation(null)} />}

      {editing && (
        <ModalDialog variant="form" title={`Editar usuário — ${editing.name || editing.username}`} onClose={closeEdit}>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!editForm.name.trim()) {
                announce('Informe o nome completo', 'assertive')
                return
              }
              if (editing.role === 'student' && (!editForm.turmaNumero || !editForm.turmaLetra.trim())) {
                announce('Informe a turma (número e letra)', 'assertive')
                return
              }
              if (editing.role === 'student') {
                const bd = validateBirthdate(editForm.birthdate)
                if (!bd.ok) {
                  announce(bd.message ?? 'Data de nascimento inválida', 'assertive')
                  return
                }
              }
              update.mutate()
            }}
            className="grid gap-4"
          >
            <Input label="Nome completo" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} required autoComplete="off" />
            <Input label="Usuário" value={editing.username} disabled autoComplete="off" />
            {editing.role === 'student' && (
              <>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))] gap-4">
                  <div className="min-w-0"><Input label="Turma — número" value={editForm.turmaNumero} onChange={(e) => setEditForm((f) => ({ ...f, turmaNumero: e.target.value.replace(/[^0-9]/g, '').slice(0, 2) }))} required inputMode="numeric" autoComplete="off" /></div>
                  <div className="min-w-0"><Input label="Turma — letra" value={editForm.turmaLetra} onChange={(e) => setEditForm((f) => ({ ...f, turmaLetra: e.target.value.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 1) }))} required maxLength={1} autoComplete="off" /></div>
                </div>
                <Input label="Nascimento" type="date" value={editForm.birthdate} onChange={(e) => setEditForm((f) => ({ ...f, birthdate: e.target.value }))} required autoComplete="off" />
              </>
            )}
            {editing.role === 'librarian' && (
              <fieldset className="grid gap-2 rounded-md border border-slate-200 dark:border-slate-700 p-4">
                <legend className="px-1 text-sm font-semibold">Permissões administrativas</legend>
                {canManageStaffCapabilities ? (
                  <>
                    <label className="flex min-h-[44px] items-center gap-3 text-sm">
                      <input type="checkbox" checked={editForm.manageLibraryCalendar} onChange={(event) => setEditForm((f) => ({ ...f, manageLibraryCalendar: event.target.checked }))} className="h-5 w-5 rounded text-blue-600 focus-visible:outline-3 focus-visible:outline-[var(--color-focus)]" />
                      Gerenciar calendário da biblioteca
                    </label>
                    <label className="flex min-h-[44px] items-center gap-3 text-sm">
                      <input type="checkbox" checked={editForm.manageCirculationRules} onChange={(event) => setEditForm((f) => ({ ...f, manageCirculationRules: event.target.checked }))} className="h-5 w-5 rounded text-blue-600 focus-visible:outline-3 focus-visible:outline-[var(--color-focus)]" />
                      Gerenciar regras de circulação
                    </label>
                  </>
                ) : (
                  <p className="text-sm text-slate-600 dark:text-slate-300">Somente School Admin ou Super Admin podem alterar estas permissões.</p>
                )}
              </fieldset>
            )}
            <div className="rounded-md border border-slate-200 p-4 dark:border-slate-700">
              <p className="text-sm font-medium">Senha</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Resete a senha para gerar um novo código de primeiro acesso. A senha atual será invalidada.</p>
              <div className="mt-3"><ResetPasswordAction user={editing} onUpdated={() => void qc.invalidateQueries({ queryKey: ['users'] })} /></div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={closeEdit}>
                Cancelar
              </Button>
              <Button type="submit" disabled={update.isPending} aria-busy={update.isPending}>
                {update.isPending ? 'Salvando…' : 'Salvar'}
              </Button>
            </div>
          </form>
        </ModalDialog>
      )}
      {changingSituation && <ModalDialog variant="form" title={`Alterar situação — ${changingSituation.name || changingSituation.username}`} onClose={() => setChangingSituation(null)} describedBy="user-situation-description"><div id="user-situation-description" className="grid gap-4"><p className="text-sm text-slate-600 dark:text-slate-300">Situação atual: Ativo.</p><Select label="Nova situação" value="inactive" onChange={() => undefined} options={[{ value: 'inactive', label: 'Desativar usuário' }]} /><div><label htmlFor="user-situation-justification" className="text-sm font-medium text-slate-700 dark:text-slate-200">Justificativa</label><textarea id="user-situation-justification" value={situationJustification} onChange={(event) => setSituationJustification(event.target.value)} required className="mt-1.5 min-h-28 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-field)] px-3 py-2 text-sm focus-visible:outline-3 focus-visible:outline-[var(--color-focus)]" /></div>{situationError && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{situationError}</p>}<div className="flex flex-wrap gap-3"><Button type="button" variant="blue-secondary" className="min-w-max flex-1" onClick={() => setChangingSituation(null)}>Cancelar</Button><Button type="button" variant="danger-secondary" className="min-w-max flex-1" onClick={() => { if (!situationJustification.trim()) { setSituationError('Informe uma justificativa.'); return } setConfirmSituation(changingSituation) }}>Confirmar</Button></div></div></ModalDialog>}
      {confirmSituation && <ModalDialog title={confirmSituation.is_active ? 'Confirmar desativação?' : 'Confirmar reativação?'} onClose={() => !situation.isPending && setConfirmSituation(null)} describedBy="user-situation-confirmation"><div id="user-situation-confirmation" className="space-y-3 text-sm text-slate-600 dark:text-slate-300"><p><strong>{confirmSituation.name || confirmSituation.username}</strong></p><p>{confirmSituation.is_active ? 'O usuário será desativado. Seu histórico será preservado e ele não poderá utilizar normalmente o sistema; a situação poderá ser revertida posteriormente.' : 'O mesmo usuário será reativado, preservando seu identificador e histórico.'}</p></div><div className="mt-6 flex flex-wrap gap-3"><Button type="button" variant="blue-secondary" className="min-w-max flex-1" onClick={() => setConfirmSituation(null)} disabled={situation.isPending}>Cancelar</Button><Button type="button" variant="danger-secondary" className="min-w-max flex-1" onClick={() => situation.mutate({ target: confirmSituation, active: !confirmSituation.is_active, justification: confirmSituation.is_active ? situationJustification.trim() : undefined })} disabled={situation.isPending} aria-busy={situation.isPending}>{situation.isPending ? 'Confirmando…' : confirmSituation.is_active ? 'Confirmar desativação' : 'Confirmar reativação'}</Button></div></ModalDialog>}
      {undoSituation && <UndoSnackbar message={undoSituation.is_active ? 'Usuário desativado.' : 'Usuário reativado.'} onUndo={() => undoSituationMutation.mutate(undoSituation)} onClose={() => setUndoSituation(null)} />}
    </div>
  )
}
