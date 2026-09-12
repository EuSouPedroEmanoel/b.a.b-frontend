import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Users, Pencil, Plus, AlertTriangle } from 'lucide-react'
import api from '@/lib/api'
import { formatCpfInput, onlyDigits, validateCpfDigits } from '@/lib/cpf'
import { getErrorMessage } from '@/lib/errors'
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

type AppUser = {
  id: number
  username: string
  name: string
  email: string | null
  cpf_masked: string | null
  birthdate: string | null
  turma_numero: number | null
  turma_letra: string | null
  role: string
  school_id: number | null
  school_name: string | null
  school_code: string | null
  is_active: boolean
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
  if (dt > now) return { ok: false, message: 'Nascimento deve ser uma data no passado' }
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
  email: string
  cpf: string
  birthdate: string
  turmaNumero: string
  turmaLetra: string
  password: string
}

const emptyCreate: CreateForm = {
  type: 'student',
  name: '',
  username: '',
  email: '',
  cpf: '',
  birthdate: '',
  turmaNumero: '',
  turmaLetra: '',
  password: '',
}

export function UsersPage() {
  const announce = useAnnouncer()
  const qc = useQueryClient()
  const [role, setRole] = useState('')
  const [schoolFilter, setSchoolFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState<CreateForm>(emptyCreate)
  const [createError, setCreateError] = useState('')
  const [editing, setEditing] = useState<AppUser | null>(null)
  const [editForm, setEditForm] = useState({ name: '', email: '', birthdate: '', turmaNumero: '', turmaLetra: '', password: '', manageLibraryCalendar: false, manageCirculationRules: false })

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
  const schoolOptions: AutocompleteOption<School>[] = (schoolsData?.items ?? []).map((school) => ({
    value: String(school.id),
    label: school.name,
    data: school,
  }))
  const createSchoolLabel = useMemo(() => {
    if (!isSuperAdmin) return ''
    const selected = schoolFilter
      ? schoolsData?.items.find((school) => school.id === Number(schoolFilter))
      : schoolsData?.items[0]
    return selected ? schoolLabel(selected.name, selected.code) : ''
  }, [isSuperAdmin, schoolFilter, schoolsData])

  const queryKey = ['users', role, schoolFilter]
  const { data, isLoading, isError, error } = useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams({ size: '100' })
      if (role) params.set('role', role)
      if (schoolFilter) params.set('school_id', schoolFilter)
      const { data } = await api.get<Paginated<AppUser>>(`/users/?${params.toString()}`)
      return data
    },
  })

  const create = useMutation({
    mutationFn: async () => {
      const f = createForm
      if (f.type === 'student') {
        const { data } = await api.post<AppUser>('/users/students', {
          name: f.name.trim(),
          cpf: f.cpf,
          birthdate: f.birthdate,
          turma_numero: Number(f.turmaNumero),
          turma_letra: f.turmaLetra,
        })
        return data
      }
      if (f.type === 'school_admin' && isSuperAdmin) {
        const schoolId = schoolFilter || (schoolsData?.items[0]?.id ?? 0)
        const { data } = await api.post<AppUser>(`/schools/${schoolId}/admins`, {
          username: f.username.trim(),
          name: f.name.trim(),
          email: f.email.trim(),
          cpf: f.cpf,
          password: f.password,
        })
        return data
      }
      const { data } = await api.post<AppUser>('/users/', {
        username: f.username.trim(),
        name: f.name.trim(),
        email: f.email.trim() || null,
        cpf: f.cpf,
        password: f.password,
        role: f.type,
        ...(isSuperAdmin && schoolFilter ? { school_id: Number(schoolFilter) } : {}),
      })
      return data
    },
    onSuccess: () => {
      announce('Usuário criado com sucesso', 'polite')
      setShowCreate(false)
      setCreateForm(emptyCreate)
      setCreateError('')
      qc.invalidateQueries({ queryKey: ['users'] })
      qc.invalidateQueries({ queryKey: ['students'] })
    },
    onError: (err: unknown) => {
      setCreateError(getErrorMessage(err, 'Erro ao criar usuário'))
      announce(getErrorMessage(err, 'Erro ao criar usuário'), 'assertive')
    },
  })

  const update = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = { name: editForm.name.trim(), email: editForm.email || null }
      if (editing?.role === 'student') {
        payload.birthdate = editForm.birthdate
        payload.turma_numero = Number(editForm.turmaNumero)
        payload.turma_letra = editForm.turmaLetra
      }
      if (editForm.password.trim()) payload.password = editForm.password
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
      qc.invalidateQueries({ queryKey: ['students'] })
    },
    onError: (err: unknown) => {
      announce(getErrorMessage(err, 'Erro ao atualizar usuário'), 'assertive')
    },
  })

  const submitCreate = (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError('')
    const f = createForm
    if (f.type === 'student') {
      if (!f.name.trim() || !f.turmaNumero || !f.turmaLetra.trim()) {
        setCreateError('Preencha nome e turma (número e letra)')
        announce('Preencha nome e turma (número e letra)', 'assertive')
        return
      }
      if (!validateCpfDigits(f.cpf)) {
        setCreateError('Informe um CPF válido')
        announce('Informe um CPF válido', 'assertive')
        return
      }
      const bd = validateBirthdate(f.birthdate)
      if (!bd.ok) {
        setCreateError(bd.message ?? 'Data de nascimento inválida')
        announce(bd.message ?? 'Data de nascimento inválida', 'assertive')
        return
      }
    } else if (!f.username.trim() || !f.name.trim() || !f.password) {
      setCreateError('Preencha usuário, nome e senha')
      announce('Preencha usuário, nome e senha', 'assertive')
      return
    } else if (!validateCpfDigits(f.cpf)) {
      setCreateError('Informe um CPF válido')
      announce('Informe um CPF válido', 'assertive')
      return
    }
    create.mutate()
  }

  const openEdit = (u: AppUser) => {
    if (!canEditUser(u)) return
    setEditing(u)
    setEditForm({
      name: u.name || u.username,
      email: u.email ?? '',
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
    setEditForm({ name: '', email: '', birthdate: '', turmaNumero: '', turmaLetra: '', password: '', manageLibraryCalendar: false, manageCirculationRules: false })
  }

  const availableCreateTypes = useMemo(() => {
    if (isSuperAdmin) {
      return ROLE_OPTIONS.filter((o) => o.value === 'school_admin')
    }
    return ROLE_OPTIONS.filter(
      (o) => o.value === '' || (o.value !== 'super_admin' && (o.value !== 'school_admin' || isSuperAdmin)),
    )
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
          showSchool: role !== 'super_admin',
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
          showSchool: true,
          showTurma: false,
          showNascimento: false,
        },
        {
          key: 'librarian',
          title: 'Bibliotecários',
          roles: ['librarian'],
          showCpf: true,
          showSchool: true,
          showTurma: false,
          showNascimento: false,
        },
        {
          key: 'teacher',
          title: 'Professores',
          roles: ['teacher'],
          showCpf: true,
          showSchool: true,
          showTurma: false,
          showNascimento: false,
        },
        {
          key: 'student',
          title: 'Alunos',
          roles: ['student'],
          showCpf: true,
          showSchool: true,
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
        showSchool: true,
        showTurma: true,
        showNascimento: true,
      },
      {
        key: 'school_admin',
        title: 'Admin da escola',
        roles: ['school_admin'],
        showCpf: true,
        showSchool: true,
        showTurma: false,
        showNascimento: false,
      },
      {
        key: 'staff',
        title: 'Bibliotecários e professores',
        roles: ['librarian', 'teacher'],
        showCpf: true,
        showSchool: true,
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
        <Button onClick={() => { setCreateError(''); setCreateForm(isSuperAdmin ? { ...emptyCreate, type: 'school_admin' } : emptyCreate); setShowCreate(true) }}>
          <Plus className="h-4 w-4 mr-2" aria-hidden="true" /> {isSuperAdmin ? 'Criar admin da escola' : 'Criar usuário'}
        </Button>
      </header>

      <Card>
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Tipo de usuário"
            id="user-role"
            value={role}
            onChange={setRole}
            options={filterRoleOptions.map((o) => ({ value: o.value, label: o.label }))}
          />
          {isSuperAdmin && (
            <Autocomplete
              label="Escola"
              id="user-school"
              value={schoolFilter}
              onChange={setSchoolFilter}
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
                  <div className="@container max-w-full overflow-x-auto overscroll-x-contain">
                    <table className="w-full table-fixed border-spacing-0 min-w-0 text-sm">
                      <caption className="sr-only">{sec.title}</caption>
                      <thead className="bg-slate-50 dark:bg-slate-700/50">
                        <tr>
                          <th scope="col" className="px-4 py-3 text-left font-semibold">Identificação</th>
                          {sec.showCpf && <th scope="col" className="px-4 py-3 text-left font-semibold @max-lg:hidden">CPF</th>}
                          {sec.showSchool && <th scope="col" className="px-4 py-3 text-left font-semibold @max-lg:hidden">Escola</th>}
                          {sec.showNascimento && <th scope="col" className="px-4 py-3 text-left font-semibold @max-lg:hidden">Nascimento</th>}
                          {sec.showTurma && <th scope="col" className="px-4 py-3 text-left font-semibold @max-lg:hidden">Turma</th>}
                          <th scope="col" className="w-32 break-words [overflow-wrap:anywhere] px-4 py-3 text-right font-semibold @max-[72rem]:w-20">Ações</th>
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
                                {currentUser?.id === u.id && <span className="ml-2 text-sm font-normal text-slate-600 dark:text-slate-300">(EU)</span>}
                                <div className="mt-1 space-y-0.5 text-xs font-normal text-slate-600 dark:text-slate-300">
                                  <p className="break-words font-mono">{u.username}</p>
                                  <p className="break-words">{u.email ?? 'Sem e-mail'}</p>
                                  {sec.showCpf && <p className="hidden font-mono @max-lg:block">CPF: {u.cpf_masked ?? '—'}</p>}
                                  {sec.showSchool && <p className="hidden break-words @max-lg:block">Escola: {schoolLabel(u.school_name, u.school_code)}</p>}
                                  {sec.showNascimento && <p className="hidden @max-lg:block">Nascimento: {formatDate(u.birthdate)}</p>}
                                  {sec.showTurma && <p className="hidden @max-lg:block">Turma: {turmaLabel(u.turma_numero, u.turma_letra)}{deprecated ? ' · Atualizar' : ''}</p>}
                                </div>
                              </td>
                              {sec.showCpf && <td className="break-words px-4 py-3 align-top font-mono text-xs @max-lg:hidden">{u.cpf_masked ?? '—'}</td>}
                              {sec.showSchool && (
                                <td className="break-words px-4 py-3 align-top @max-lg:hidden">{schoolLabel(u.school_name, u.school_code)}</td>
                              )}
                              {sec.showNascimento && (
                                <td className="px-4 py-3 align-top @max-lg:hidden">{formatDate(u.birthdate)}</td>
                              )}
                              {sec.showTurma && (
                                <td className="px-4 py-3 align-top @max-lg:hidden">
                                  <span className="flex items-center gap-2">
                                    {turmaLabel(u.turma_numero, u.turma_letra)}
                                    {deprecated && <Badge tone="warning">Atualizar</Badge>}
                                  </span>
                                </td>
                              )}
                              <td className="px-4 py-3 text-right align-top">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => openEdit(u)}
                                  disabled={readOnly}
                                  aria-label={`Editar usuário ${u.name || u.username}`}
                                  className={`relative group ${readOnly ? 'bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-500' : ''}`}
                                >
                                  <Pencil className="h-5 w-5 @max-lg:mr-0 @max-[80rem]:mr-0 mr-1" aria-hidden="true" />
                                  <span className="@max-lg:sr-only @max-[80rem]:sr-only">Editar</span>
                                  <Tooltip className="left-1/2 right-auto -translate-x-1/2">Editar</Tooltip>
                                </Button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
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
        </div>
      )}

      {showCreate && (
        <ModalDialog variant="form" title="Criar usuário" onClose={() => { setCreateError(''); setShowCreate(false) }}>
          <form onSubmit={submitCreate} className="grid gap-4">
            {createError && (
              <p role="alert" className="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-800 dark:text-red-200">
                {createError}
              </p>
            )}
            <Select
              label="Tipo de usuário"
              id="create-type"
              value={createForm.type}
              onChange={(v) => setCreateForm((f) => ({ ...f, type: v }))}
              options={availableCreateTypes.filter((o) => o.value !== '').map((o) => ({ value: o.value, label: o.label }))}
            />

            {createForm.type === 'student' ? (
              <>
                <Input label="Nome completo" value={createForm.name} onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} required autoComplete="off" />
                <Input label="CPF" value={formatCpfInput(createForm.cpf)} onChange={(e) => setCreateForm((f) => ({ ...f, cpf: onlyDigits(e.target.value) }))} placeholder="000.000.000-00" required inputMode="numeric" autoComplete="off" />
                <Input label="Nascimento" type="date" value={createForm.birthdate} onChange={(e) => setCreateForm((f) => ({ ...f, birthdate: e.target.value }))} required autoComplete="off" hint="A primeira senha do aluno será a data de nascimento como números (ddmmaaaa)." />
                <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))] gap-4">
                  <div className="min-w-0"><Input label="Turma — número" value={createForm.turmaNumero} onChange={(e) => setCreateForm((f) => ({ ...f, turmaNumero: e.target.value.replace(/[^0-9]/g, '').slice(0, 2) }))} placeholder="ex: 7" required inputMode="numeric" autoComplete="off" /></div>
                  <div className="min-w-0"><Input label="Turma — letra" value={createForm.turmaLetra} onChange={(e) => setCreateForm((f) => ({ ...f, turmaLetra: e.target.value.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 1) }))} placeholder="ex: A" required maxLength={1} autoComplete="off" /></div>
                </div>
              </>
            ) : (
              <>
                <Input label="Nome de usuário" value={createForm.username} onChange={(e) => setCreateForm((f) => ({ ...f, username: e.target.value }))} required autoComplete="off" />
                <Input label="Nome completo" value={createForm.name} onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} required autoComplete="off" />
                <Input label="E-mail" type="email" value={createForm.email} onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))} autoComplete="off" />
                <Input label="CPF" value={formatCpfInput(createForm.cpf)} onChange={(e) => setCreateForm((f) => ({ ...f, cpf: onlyDigits(e.target.value) }))} placeholder="000.000.000-00" required inputMode="numeric" autoComplete="off" />
                {isSuperAdmin && createForm.type === 'school_admin' && (
                  <Input label="Escola" value={createSchoolLabel} disabled autoComplete="off" />
                )}
              </>
            )}

            {createForm.type !== 'student' && (
              <Input label="Senha" type="password" value={createForm.password} onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))} required autoComplete="new-password" />
            )}

            <div className="flex flex-wrap gap-3 pt-2">
              <Button type="button" variant="danger-secondary" className="min-w-max flex-1" onClick={() => { setCreateError(''); setShowCreate(false) }}>
                Cancelar
              </Button>
              <Button type="submit" variant="blue-secondary" className="min-w-max flex-1" disabled={create.isPending} aria-busy={create.isPending}>
                {create.isPending ? 'Criando…' : 'Criar'}
              </Button>
            </div>
          </form>
        </ModalDialog>
      )}

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
            <Input label="E-mail" type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} autoComplete="off" />
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
            <Input label="Nova senha (opcional)" type="password" value={editForm.password} onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))} autoComplete="new-password" />
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
    </div>
  )
}
