import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { useAnnouncer } from '@/components/feedback/LiveRegionContext'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { PageDescription } from '@/components/ui/PageDescription'
import { ChevronDown, ChevronUp } from 'lucide-react'

type ReaderRole = 'student' | 'teacher'

type Policy = {
  reader_role: ReaderRole
  max_active_loans: number
  loan_duration_days: number
  max_renewals: number
  can_reserve: boolean
  max_active_reservations: number
  block_new_loans_when_overdue: boolean
  post_overdue_suspension_days: number
  count_only_business_days: boolean
  move_due_date_to_next_business_day: boolean
  apply_overdue_due_date_reduction: boolean
  overdue_due_date_reduction_days: number
  max_overdue_reductions: number
  minimum_loan_days_after_penalties: number
  overdue_recovery_mode: 'on_time_returns' | 'elapsed_days'
  overdue_recovery_on_time_returns: number | null
  overdue_recovery_days: number | null
}

type School = { id: number; name: string }
type Paginated<T> = { items: T[] }

const roleLabel: Record<ReaderRole, string> = {
  student: 'Aluno',
  teacher: 'Professor',
}

const numericFields: Array<keyof Pick<Policy,
  'max_active_loans' | 'loan_duration_days' | 'max_renewals' |
  'max_active_reservations' | 'post_overdue_suspension_days'
  | 'overdue_due_date_reduction_days' | 'max_overdue_reductions'
  | 'minimum_loan_days_after_penalties'
>> = [
  'max_active_loans',
  'loan_duration_days',
  'max_renewals',
  'max_active_reservations',
  'post_overdue_suspension_days',
  'overdue_due_date_reduction_days',
  'max_overdue_reductions',
  'minimum_loan_days_after_penalties',
]

function PolicyForm({ policy, onChange, firstInputRef, readOnly, muted = false }: {
  policy: Policy
  onChange: (next: Policy) => void
  firstInputRef?: RefObject<HTMLInputElement | null>
  readOnly: boolean
  muted?: boolean
}) {
  const [penaltyOpen, setPenaltyOpen] = useState(false)
  const updateNumber = (field: typeof numericFields[number], value: string) => {
    onChange({ ...policy, [field]: Number(value) })
  }
  const updateBoolean = (field: 'can_reserve' | 'block_new_loans_when_overdue' | 'count_only_business_days' | 'move_due_date_to_next_business_day' | 'apply_overdue_due_date_reduction', value: boolean) => {
    onChange({ ...policy, [field]: value })
  }

  const penaltySummary = policy.apply_overdue_due_date_reduction
    ? `Ativa · -${policy.overdue_due_date_reduction_days} dia(s) por atraso · máximo ${policy.max_overdue_reductions} reduções`
    : 'Desativada'

  return <Card className={muted ? 'opacity-60' : ''}>
    <CardHeader><h2 className="font-semibold">Configurações de {roleLabel[policy.reader_role]}</h2></CardHeader>
    <CardBody className="grid gap-5">
      <section aria-labelledby={`${policy.reader_role}-loans-heading`} className="grid gap-4">
        <h3 id={`${policy.reader_role}-loans-heading`} className="text-base font-semibold">Empréstimos e reservas</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input ref={firstInputRef} disabled={readOnly} label="Empréstimos simultâneos" type="number" min={0} max={20} value={policy.max_active_loans} onChange={(event) => updateNumber('max_active_loans', event.target.value)} />
          <Input disabled={readOnly} label="Prazo do empréstimo (dias)" type="number" min={1} max={90} value={policy.loan_duration_days} onChange={(event) => updateNumber('loan_duration_days', event.target.value)} />
          <Input disabled={readOnly} label="Renovações máximas" type="number" min={0} max={10} value={policy.max_renewals} onChange={(event) => updateNumber('max_renewals', event.target.value)} hint="Preparado para uma renovação futura; ainda não há fluxo de renovação." />
          <Input disabled={readOnly} label="Reservas simultâneas" type="number" min={0} max={20} value={policy.max_active_reservations} onChange={(event) => updateNumber('max_active_reservations', event.target.value)} />
          <label className="flex min-h-[44px] items-center gap-3 text-sm"><input type="checkbox" disabled={readOnly} checked={policy.can_reserve} onChange={(event) => updateBoolean('can_reserve', event.target.checked)} className="h-5 w-5 rounded border-slate-400 text-blue-600 focus-visible:outline-3 focus-visible:outline-[var(--color-focus)]" />Pode reservar livros</label>
          <label className="flex min-h-[44px] items-center gap-3 text-sm"><input type="checkbox" disabled={readOnly} checked={policy.block_new_loans_when_overdue} onChange={(event) => updateBoolean('block_new_loans_when_overdue', event.target.checked)} className="h-5 w-5 rounded border-slate-400 text-blue-600 focus-visible:outline-3 focus-visible:outline-[var(--color-focus)]" />Bloquear novo empréstimo enquanto houver item vencido</label>
        </div>
      </section>
      <section aria-labelledby={`${policy.reader_role}-calendar-heading`} className="grid gap-4 border-t border-slate-200 pt-5 dark:border-slate-600">
        <h3 id={`${policy.reader_role}-calendar-heading`} className="text-base font-semibold">Calendário e vencimento</h3>
          <label className="flex min-h-[44px] items-start gap-3 text-sm"><input type="checkbox" disabled={readOnly} checked={policy.count_only_business_days} onChange={(event) => updateBoolean('count_only_business_days', event.target.checked)} className="mt-0.5 h-5 w-5 rounded border-slate-400 text-blue-600 focus-visible:outline-3 focus-visible:outline-[var(--color-focus)]" /><span><span className="block">Contar apenas dias úteis no prazo do empréstimo</span><span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">Quando ativado, sábados, domingos e feriados não são contabilizados no cálculo da data de devolução.</span></span></label>
          <label className={`flex min-h-[44px] items-start gap-3 text-sm transition-opacity ${policy.count_only_business_days ? 'opacity-60' : ''}`}><input type="checkbox" disabled={readOnly} checked={policy.move_due_date_to_next_business_day} onChange={(event) => updateBoolean('move_due_date_to_next_business_day', event.target.checked)} className="mt-0.5 h-5 w-5 rounded border-slate-400 text-blue-600 focus-visible:outline-3 focus-visible:outline-[var(--color-focus)]" /><span><span className="block">Se a data de entrega cair em dia não útil, mover para o próximo dia útil</span><span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">Ajusta a data final quando ela cair em fim de semana ou dia não útil cadastrado.</span></span></label>
        <Input disabled={readOnly} label="Suspensão após devolução em atraso (dias)" type="number" min={0} max={365} value={policy.post_overdue_suspension_days} onChange={(event) => updateNumber('post_overdue_suspension_days', event.target.value)} />
      </section>
      <section className="border-t border-slate-200 pt-5 dark:border-slate-600">
        <button type="button" aria-expanded={penaltyOpen} aria-controls={`${policy.reader_role}-penalty-panel`} onClick={() => setPenaltyOpen((open) => !open)} className={`flex min-h-[64px] w-full cursor-pointer items-center justify-between gap-4 rounded-md border px-3 py-2 text-left transition-colors focus-visible:outline-3 focus-visible:outline-[var(--color-focus)] ${penaltyOpen ? 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-700' : 'border-transparent hover:border-slate-300 hover:bg-slate-100 dark:border-transparent dark:hover:border-slate-600 dark:hover:bg-slate-700'}`}>
          <span><span className="block font-semibold">Penalidade por atrasos</span><span className="mt-1 block text-sm font-normal text-slate-500 dark:text-slate-300">{penaltySummary}</span></span>
          {penaltyOpen ? <ChevronUp className="h-5 w-5 shrink-0" aria-hidden="true" /> : <ChevronDown className="h-5 w-5 shrink-0" aria-hidden="true" />}
        </button>
        {penaltyOpen && <div id={`${policy.reader_role}-penalty-panel`} className="grid gap-4 pt-4"><p className="text-sm text-slate-600 dark:text-slate-300">A cada devolução em atraso, o prazo dos próximos empréstimos pode ser reduzido. A penalidade pode ser removida após um período sem atrasos ou após devoluções realizadas no prazo.</p>
          <label className="flex min-h-[44px] items-center gap-3 text-sm"><input type="checkbox" disabled={readOnly} checked={policy.apply_overdue_due_date_reduction} onChange={(event) => updateBoolean('apply_overdue_due_date_reduction', event.target.checked)} className="h-5 w-5 rounded border-slate-400 text-blue-600 focus-visible:outline-3 focus-visible:outline-[var(--color-focus)]" />Reduzir prazo após atrasos</label>
          {policy.apply_overdue_due_date_reduction && <><div className="grid gap-4 sm:grid-cols-3"><Input disabled={readOnly} label="Dias reduzidos por atraso" type="number" min={0} max={90} value={policy.overdue_due_date_reduction_days} onChange={(event) => updateNumber('overdue_due_date_reduction_days', event.target.value)} /><Input disabled={readOnly} label="Máximo de reduções acumuladas" type="number" min={0} max={90} value={policy.max_overdue_reductions} onChange={(event) => updateNumber('max_overdue_reductions', event.target.value)} /><Input disabled={readOnly} label="Prazo mínimo após penalidades" type="number" min={1} max={90} value={policy.minimum_loan_days_after_penalties} onChange={(event) => updateNumber('minimum_loan_days_after_penalties', event.target.value)} /></div><fieldset className="grid gap-3" aria-label="Forma de recuperação da penalidade"><legend className="text-sm font-medium">Limpar penalidade após</legend><label className={`grid cursor-pointer gap-2 rounded-md border p-3 text-sm transition ${policy.overdue_recovery_mode === 'on_time_returns' ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/30' : 'border-slate-200 dark:border-slate-600'}`}><span className="flex items-center gap-3"><input type="radio" disabled={readOnly} name={`recovery-${policy.reader_role}`} checked={policy.overdue_recovery_mode === 'on_time_returns'} onChange={() => onChange({ ...policy, overdue_recovery_mode: 'on_time_returns', overdue_recovery_on_time_returns: policy.overdue_recovery_on_time_returns ?? 3 })} />Devoluções no prazo</span>{policy.overdue_recovery_mode === 'on_time_returns' && <span className="flex flex-wrap items-center gap-2 pl-7">Limpar após <input aria-label="Devoluções realizadas no prazo para limpar a penalidade" className="h-9 w-20 rounded-md border border-slate-300 bg-white px-2 text-center dark:border-slate-600 dark:bg-slate-800" type="number" min={1} max={100} disabled={readOnly} value={policy.overdue_recovery_on_time_returns ?? 3} onChange={(event) => onChange({ ...policy, overdue_recovery_on_time_returns: Number(event.target.value) })} /> devoluções realizadas no prazo.</span>}</label><label className={`grid cursor-pointer gap-2 rounded-md border p-3 text-sm transition ${policy.overdue_recovery_mode === 'elapsed_days' ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/30' : 'border-slate-200 dark:border-slate-600'}`}><span className="flex items-center gap-3"><input type="radio" disabled={readOnly} name={`recovery-${policy.reader_role}`} checked={policy.overdue_recovery_mode === 'elapsed_days'} onChange={() => onChange({ ...policy, overdue_recovery_mode: 'elapsed_days', overdue_recovery_days: policy.overdue_recovery_days ?? 30 })} />Período sem atrasos</span>{policy.overdue_recovery_mode === 'elapsed_days' && <span className="flex flex-wrap items-center gap-2 pl-7">Limpar após <input aria-label="Dias sem atrasos para limpar a penalidade" className="h-9 w-20 rounded-md border border-slate-300 bg-white px-2 text-center dark:border-slate-600 dark:bg-slate-800" type="number" min={1} max={3650} disabled={readOnly} value={policy.overdue_recovery_days ?? 30} onChange={(event) => onChange({ ...policy, overdue_recovery_days: Number(event.target.value) })} /> dias sem registrar um novo atraso.</span>}</label></fieldset></>}
        </div>}
      </section>
    </CardBody>
  </Card>
}

export function CirculationPoliciesPage({ schoolIdOverride, showSchoolSelector = true }: {
  schoolIdOverride?: string
  showSchoolSelector?: boolean
}) {
  const { user } = useAuth()
  const announce = useAnnouncer()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const firstInputRef = useRef<HTMLInputElement>(null)
  const tabRefs = useRef<Record<ReaderRole, HTMLButtonElement | null>>({ student: null, teacher: null })
  const [schoolId, setSchoolId] = useState(() => searchParams.get('school') ?? '')
  const [schoolSearch, setSchoolSearch] = useState('')
  const [policies, setPolicies] = useState<Policy[]>([])
  const [activeRole, setActiveRole] = useState<ReaderRole>('student')
  const isSuperAdmin = user?.role === 'super_admin'
  const isSchoolAdmin = user?.role === 'school_admin'
  const isLibrarian = user?.role === 'librarian'
  const canView = isSuperAdmin || isSchoolAdmin || isLibrarian
  const canEdit = isSchoolAdmin || (isLibrarian && user?.administrative_capabilities?.includes('manage_circulation_rules'))
  const effectiveSchoolId = schoolIdOverride ?? (isSuperAdmin ? schoolId : String(user?.school_id ?? ''))

  const { data: schools } = useQuery({
    queryKey: ['schools', 'circulation-policies'],
    queryFn: async () => (await api.get<Paginated<School>>('/schools/?size=100')).data.items,
    enabled: isSuperAdmin,
  })
  const schoolOptions = useMemo(() => (schools ?? []).filter((school) => school.name.toLowerCase().includes(schoolSearch.toLowerCase())), [schools, schoolSearch])
  const selectedSchoolName = schools?.find((school) => String(school.id) === schoolId)?.name ?? ''

  const policyQuery = useQuery({
    queryKey: ['circulation-policies', effectiveSchoolId],
    queryFn: async () => (await api.get<{ policies: Policy[] }>(`/circulation-policies/${effectiveSchoolId}`)).data.policies,
    enabled: !!effectiveSchoolId && canView,
  })

  useEffect(() => {
    if (policyQuery.data) setPolicies(policyQuery.data)
  }, [policyQuery.data])

  const save = useMutation({
    mutationFn: async () => api.put(`/circulation-policies/${effectiveSchoolId}`, { policies }),
    onSuccess: () => {
      announce('Regras de circulação atualizadas.', 'polite')
      void queryClient.invalidateQueries({ queryKey: ['circulation-policies', effectiveSchoolId] })
    },
    onError: (error: unknown) => {
      const message = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Não foi possível atualizar as regras de circulação.'
      announce(message, 'assertive')
      firstInputRef.current?.focus()
    },
  })

  const updatePolicy = (next: Policy) => {
    setPolicies((current) => current.map((policy) => policy.reader_role === next.reader_role ? next : policy))
  }

  const selectRole = (role: ReaderRole, moveFocus = false) => {
    setActiveRole(role)
    if (moveFocus) requestAnimationFrame(() => tabRefs.current[role]?.focus())
  }
  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const roles: ReaderRole[] = ['student', 'teacher']
    const currentIndex = roles.indexOf(activeRole)
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      selectRole(roles[(currentIndex + 1) % roles.length], true)
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      selectRole(roles[(currentIndex - 1 + roles.length) % roles.length], true)
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      selectRole(event.key === 'Home' ? roles[0] : roles[roles.length - 1], true)
    }
  }

  if (!canView) {
    return <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">Você não tem permissão para administrar regras de circulação.</p>
  }

  const invalid = policies.some((policy) => (
    policy.loan_duration_days < 1 || numericFields.some((field) => (
      field !== 'loan_duration_days' && policy[field] < 0
    ))
  ))

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl sm:text-3xl font-bold">Regras de circulação</h1>
        <PageDescription>Defina limites de empréstimos e reservas para cada perfil de leitor da escola.</PageDescription>
      </header>

      {isSuperAdmin && showSchoolSelector && (
        <div className="max-w-xl">
          <label htmlFor="circulation-school-search" className="mb-1 block text-sm font-medium">Escola</label>
          <div className="relative">
            <input id="circulation-school-search" role="combobox" aria-autocomplete="list" aria-controls="circulation-school-listbox" aria-expanded={schoolSearch.length > 0 && schoolOptions.length > 0} value={schoolSearch || selectedSchoolName} onChange={(event) => setSchoolSearch(event.target.value)} onFocus={() => { if (!schoolSearch) setSchoolSearch(selectedSchoolName) }} className="min-h-[44px] w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800" placeholder="Busque uma escola" />
            {schoolSearch && schoolOptions.length > 0 && <ul id="circulation-school-listbox" role="listbox" className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-slate-300 bg-white p-1 shadow-lg dark:border-slate-600 dark:bg-slate-800">{schoolOptions.map((school) => <li key={school.id} role="option" aria-selected={String(school.id) === schoolId} onMouseDown={(event) => event.preventDefault()}><button type="button" className="w-full cursor-pointer rounded px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700" onClick={() => { setSchoolId(String(school.id)); setSchoolSearch('') }}>{school.name}</button></li>)}</ul>}
          </div>
        </div>
      )}

      {isLibrarian && !canEdit && effectiveSchoolId && (
        <p role="status" className="rounded-md border border-blue-200 bg-blue-50 p-4 text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100">
          Você está consultando as regras da sua escola em modo somente leitura. A alteração exige a permissão administrativa correspondente.
        </p>
      )}

      {!effectiveSchoolId && <p aria-live="polite" className="text-slate-600 dark:text-slate-300">Selecione uma escola para consultar as regras.</p>}
      {policyQuery.isLoading && <p aria-live="polite">Carregando regras de circulação…</p>}
      {policyQuery.isError && <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">Não foi possível carregar as regras de circulação.</p>}

      {policies.length === 2 && (
        <form onSubmit={(event) => {
          event.preventDefault()
          if (invalid) {
            announce('Revise os valores informados antes de salvar.', 'assertive')
            firstInputRef.current?.focus()
            return
          }
          save.mutate()
        }} className="flex flex-col gap-5">
          <div role="tablist" aria-label="Perfil de leitor" className="flex w-full gap-1 rounded-lg border border-slate-300 bg-slate-100 p-1 dark:border-slate-600 dark:bg-slate-800">
            {(['student', 'teacher'] as ReaderRole[]).map((role) => <button key={role} ref={(element) => { tabRefs.current[role] = element }} type="button" role="tab" id={`${role}-policy-tab`} aria-selected={activeRole === role} aria-controls={`${role}-policy-panel`} tabIndex={activeRole === role ? 0 : -1} onClick={() => selectRole(role)} onKeyDown={handleTabKeyDown} className={`min-h-11 flex-1 rounded-md px-4 py-2 text-sm font-semibold transition focus-visible:outline-3 focus-visible:outline-[var(--color-focus)] ${activeRole === role ? 'bg-slate-700 text-white shadow-sm dark:bg-slate-600' : 'text-slate-700 hover:bg-white dark:text-slate-200 dark:hover:bg-slate-700'}`}>{roleLabel[role]}</button>)}
          </div>
          {policies.filter((policy) => policy.reader_role === activeRole).map((policy) => <div key={policy.reader_role} id={`${policy.reader_role}-policy-panel`} role="tabpanel" aria-labelledby={`${policy.reader_role}-policy-tab`} tabIndex={-1}><PolicyForm policy={{ ...policy, count_only_business_days: policy.count_only_business_days ?? false, apply_overdue_due_date_reduction: policy.apply_overdue_due_date_reduction ?? true, overdue_due_date_reduction_days: policy.overdue_due_date_reduction_days ?? 1, max_overdue_reductions: policy.max_overdue_reductions ?? 14, minimum_loan_days_after_penalties: policy.minimum_loan_days_after_penalties ?? 1, overdue_recovery_mode: policy.overdue_recovery_mode ?? 'on_time_returns', overdue_recovery_on_time_returns: policy.overdue_recovery_on_time_returns ?? 3, overdue_recovery_days: policy.overdue_recovery_days ?? null }} onChange={updatePolicy} firstInputRef={firstInputRef} readOnly={!canEdit} muted={isSuperAdmin} /></div>)}
          {canEdit && <div className="flex justify-end">
            <Button type="submit" disabled={save.isPending || invalid} aria-busy={save.isPending}>{save.isPending ? 'Salvando…' : 'Salvar regras'}</Button>
          </div>}
        </form>
      )}
    </div>
  )
}
