import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { useAnnouncer } from '@/components/feedback/LiveRegionContext'
import { UndoSnackbar } from '@/components/feedback/UndoSnackbar'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Switch } from '@/components/ui/Switch'
import { PageDescription } from '@/components/ui/PageDescription'
import { Autocomplete, type AutocompleteOption } from '@/components/ui/Autocomplete'
import { SchoolSuggestion } from '@/components/ui/SchoolSuggestion'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { segmentedControlContainerClasses, segmentedControlIndicatorClasses, segmentedControlItemClasses } from '@/components/ui/SegmentedControl'

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

function normalizePolicy(policy: Policy): Policy {
  return {
    ...policy,
    count_only_business_days: policy.count_only_business_days ?? false,
    apply_overdue_due_date_reduction: policy.apply_overdue_due_date_reduction ?? true,
    overdue_due_date_reduction_days: policy.overdue_due_date_reduction_days ?? 1,
    max_overdue_reductions: policy.max_overdue_reductions ?? 14,
    minimum_loan_days_after_penalties: policy.minimum_loan_days_after_penalties ?? 1,
    overdue_recovery_mode: policy.overdue_recovery_mode ?? 'on_time_returns',
    overdue_recovery_on_time_returns: policy.overdue_recovery_on_time_returns ?? 3,
    overdue_recovery_days: policy.overdue_recovery_days ?? null,
  }
}

function normalizePolicies(policies: Policy[]) {
  return policies.map(normalizePolicy).sort((a, b) => a.reader_role.localeCompare(b.reader_role))
}

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
    if (field === 'move_due_date_to_next_business_day' && policy.count_only_business_days) return
    onChange({ ...policy, [field]: value })
  }

  const penaltySummary = policy.apply_overdue_due_date_reduction
    ? `Ativa · reduz ${policy.overdue_due_date_reduction_days} ${policy.overdue_due_date_reduction_days === 1 ? 'dia' : 'dias'} por atraso · limite de ${policy.max_overdue_reductions} ${policy.max_overdue_reductions === 1 ? 'redução' : 'reduções'}`
    : 'Desativada'

  return <Card className={`mx-auto w-full max-w-4xl ${muted ? 'opacity-60' : ''}`}>
    <CardHeader><h2 className="font-semibold">Configurações de {roleLabel[policy.reader_role]}</h2></CardHeader>
    <CardBody>
      <div className="grid gap-5">
      <section aria-labelledby={`${policy.reader_role}-loans-heading`} className="grid gap-3">
        <h3 id={`${policy.reader_role}-loans-heading`} className="text-base font-semibold">Empréstimos e reservas</h3>
        <div className="grid max-w-3xl gap-2">
          <Input ref={firstInputRef} className="max-w-xs" disabled={readOnly} label="Empréstimos simultâneos" type="number" min={0} max={20} value={policy.max_active_loans} onChange={(event) => updateNumber('max_active_loans', event.target.value)} />
          <Input className="max-w-xs" disabled={readOnly} label="Prazo do empréstimo (dias)" type="number" min={1} max={90} value={policy.loan_duration_days} onChange={(event) => updateNumber('loan_duration_days', event.target.value)} />
          <Input className="max-w-xs" disabled={readOnly} label="Renovações máximas" type="number" min={0} max={10} value={policy.max_renewals} onChange={(event) => updateNumber('max_renewals', event.target.value)} hint="Preparado para uma renovação futura; ainda não há fluxo de renovação." />
          <Input className="max-w-xs" disabled={readOnly} label="Reservas simultâneas" type="number" min={0} max={20} value={policy.max_active_reservations} onChange={(event) => updateNumber('max_active_reservations', event.target.value)} />
          <Switch controlOnRight label="Pode reservar livros" description="Permite que este perfil reserve itens do acervo." disabled={readOnly} checked={policy.can_reserve} onChange={(value) => updateBoolean('can_reserve', value)} />
          <Switch controlOnRight label="Bloquear novo empréstimo enquanto houver item vencido" description="Impede novos empréstimos até que os itens atrasados sejam devolvidos." disabled={readOnly} checked={policy.block_new_loans_when_overdue} onChange={(value) => updateBoolean('block_new_loans_when_overdue', value)} />
        </div>
      </section>
      <section aria-labelledby={`${policy.reader_role}-calendar-heading`} className="grid gap-3 border-t border-slate-200 pt-5 dark:border-slate-600">
        <h3 id={`${policy.reader_role}-calendar-heading`} className="text-base font-semibold">Calendário e vencimento</h3>
        <div className="grid max-w-3xl gap-2">
          <Switch controlOnRight label="Contar apenas dias úteis no prazo do empréstimo" description="Sábados, domingos e feriados não entram no cálculo da devolução." disabled={readOnly} checked={policy.count_only_business_days} onChange={(value) => updateBoolean('count_only_business_days', value)} />
          <Switch controlOnRight accessibleLabel="Se a data de entrega cair em dia não útil, mover para o próximo dia útil" label="Mover a entrega para o próximo dia útil" description="Ajusta a data quando ela cair em fim de semana ou dia não útil cadastrado." disabled={readOnly || policy.count_only_business_days} checked={policy.move_due_date_to_next_business_day} onChange={(value) => updateBoolean('move_due_date_to_next_business_day', value)} />
          <Input className="max-w-xs" disabled={readOnly} label="Dias de suspensão após devolução em atraso" hint="Use 0 para não aplicar suspensão." type="number" min={0} max={365} value={policy.post_overdue_suspension_days} onChange={(event) => updateNumber('post_overdue_suspension_days', event.target.value)} />
        </div>
      </section>
      <section className="border-t border-slate-200 pt-5 dark:border-slate-600">
        <button type="button" aria-expanded={penaltyOpen} aria-controls={`${policy.reader_role}-penalty-panel`} onClick={() => setPenaltyOpen((open) => !open)} className={`flex min-h-[64px] w-full cursor-pointer items-center justify-between gap-4 rounded-md border px-3 py-2 text-left transition-colors duration-200 focus-visible:outline-3 focus-visible:outline-[var(--color-focus)] ${penaltyOpen ? 'border-slate-500 bg-slate-800 text-white hover:border-slate-300 hover:bg-slate-800/90 dark:border-slate-500 dark:bg-slate-700 dark:hover:border-slate-300 dark:hover:bg-slate-700/90' : 'border-slate-400 bg-slate-300 text-slate-800 hover:border-slate-300 hover:bg-slate-400 hover:text-slate-950 dark:border-slate-600 dark:bg-slate-700/70 dark:text-slate-200 dark:hover:border-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'}`}>
          <span><span className="block font-semibold">Penalidade por atrasos</span><span className="mt-1 block text-sm font-normal text-slate-500 dark:text-slate-300">{penaltySummary}</span></span>
          {penaltyOpen ? <ChevronUp className="h-5 w-5 shrink-0" aria-hidden="true" /> : <ChevronDown className="h-5 w-5 shrink-0" aria-hidden="true" />}
        </button>
        {penaltyOpen && <div id={`${policy.reader_role}-penalty-panel`} className="grid max-w-3xl gap-3 pt-3"><p className="mb-1 max-w-xl text-xs leading-5 text-slate-500 dark:text-slate-400">A cada devolução em atraso, o prazo dos próximos empréstimos pode ser reduzido. A penalidade pode ser removida após um período sem atrasos ou após devoluções realizadas no prazo.</p>
          <Switch controlOnRight label="Reduzir prazo após atrasos" description="Diminui o prazo dos próximos empréstimos quando houver atraso." disabled={readOnly} checked={policy.apply_overdue_due_date_reduction} onChange={(value) => updateBoolean('apply_overdue_due_date_reduction', value)} />
          {policy.apply_overdue_due_date_reduction && <><div className="grid gap-3"><Input className="sm:max-w-xs" disabled={readOnly} label="Dias reduzidos por atraso" type="number" min={0} max={90} value={policy.overdue_due_date_reduction_days} onChange={(event) => updateNumber('overdue_due_date_reduction_days', event.target.value)} /><Input className="sm:max-w-xs" disabled={readOnly} label="Máximo de reduções acumuladas" type="number" min={0} max={90} value={policy.max_overdue_reductions} onChange={(event) => updateNumber('max_overdue_reductions', event.target.value)} /><Input className="sm:max-w-xs" disabled={readOnly} label="Prazo mínimo após penalidades" type="number" min={1} max={90} value={policy.minimum_loan_days_after_penalties} onChange={(event) => updateNumber('minimum_loan_days_after_penalties', event.target.value)} /></div><fieldset className="grid gap-3 sm:grid-cols-2" aria-label="Forma de recuperação da penalidade"><legend className="col-span-full text-sm font-medium">Limpar penalidade após</legend><label className={`grid cursor-pointer gap-2 rounded-md border p-3 text-sm transition-colors focus-within:outline-3 focus-within:outline-[var(--color-focus)] ${policy.overdue_recovery_mode === 'on_time_returns' ? 'border-slate-500 bg-slate-600/80 text-white hover:border-slate-400 hover:bg-slate-700/80 dark:border-slate-500 dark:bg-slate-600/80 dark:hover:border-slate-400 dark:hover:bg-slate-700/80' : 'border-slate-600 bg-slate-800/50 text-slate-200 hover:border-slate-500 hover:bg-slate-400 hover:text-slate-950 dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-200 dark:hover:border-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'}`}><span className="flex items-center gap-3"><input type="radio" disabled={readOnly} name={`recovery-${policy.reader_role}`} checked={policy.overdue_recovery_mode === 'on_time_returns'} onChange={() => onChange({ ...policy, overdue_recovery_mode: 'on_time_returns', overdue_recovery_on_time_returns: policy.overdue_recovery_on_time_returns ?? 3 })} />Devoluções no prazo</span>{policy.overdue_recovery_mode === 'on_time_returns' && <span className="flex flex-wrap items-center gap-2 pl-7">Limpar após <input aria-label="Devoluções realizadas no prazo para limpar a penalidade" className="h-9 w-20 rounded-md border border-slate-300 bg-white px-2 text-center dark:border-slate-600 dark:bg-slate-800" type="number" min={1} max={100} disabled={readOnly} value={policy.overdue_recovery_on_time_returns ?? 3} onChange={(event) => onChange({ ...policy, overdue_recovery_on_time_returns: Number(event.target.value) })} /> devoluções realizadas no prazo.</span>}</label><label className={`grid cursor-pointer gap-2 rounded-md border p-3 text-sm transition-colors focus-within:outline-3 focus-within:outline-[var(--color-focus)] ${policy.overdue_recovery_mode === 'elapsed_days' ? 'border-slate-500 bg-slate-600/80 text-white hover:border-slate-400 hover:bg-slate-700/80 dark:border-slate-500 dark:bg-slate-600/80 dark:hover:border-slate-400 dark:hover:bg-slate-700/80' : 'border-slate-600 bg-slate-800/50 text-slate-200 hover:border-slate-500 hover:bg-slate-400 hover:text-slate-950 dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-200 dark:hover:border-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'}`}><span className="flex items-center gap-3"><input type="radio" disabled={readOnly} name={`recovery-${policy.reader_role}`} checked={policy.overdue_recovery_mode === 'elapsed_days'} onChange={() => onChange({ ...policy, overdue_recovery_mode: 'elapsed_days', overdue_recovery_days: policy.overdue_recovery_days ?? 30 })} />Período sem atrasos</span>{policy.overdue_recovery_mode === 'elapsed_days' && <span className="flex flex-wrap items-center gap-2 pl-7">Limpar após <input aria-label="Dias sem atrasos para limpar a penalidade" className="h-9 w-20 rounded-md border border-slate-300 bg-white px-2 text-center dark:border-slate-600 dark:bg-slate-800" type="number" min={1} max={3650} disabled={readOnly} value={policy.overdue_recovery_days ?? 30} onChange={(event) => onChange({ ...policy, overdue_recovery_days: Number(event.target.value) })} /> dias sem registrar um novo atraso.</span>}</label></fieldset></>}
        </div>}
      </section>
      </div>
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
  const restoreTriggerRef = useRef<HTMLButtonElement>(null)
  const restoreCancelRef = useRef<HTMLButtonElement>(null)
  const [schoolId, setSchoolId] = useState(() => searchParams.get('school') ?? '')
  const [policies, setPolicies] = useState<Policy[]>([])
  const [originalPolicies, setOriginalPolicies] = useState<Policy[]>([])
  const [defaultPolicies, setDefaultPolicies] = useState<Policy[]>([])
  const [restoreOpen, setRestoreOpen] = useState(false)
  const [restoreUndo, setRestoreUndo] = useState<Policy[] | null>(null)
  const restoreUndoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
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
  const schoolOptions: AutocompleteOption<School>[] = (schools ?? []).map((school) => ({
    value: String(school.id),
    label: school.name,
    data: school,
  }))

  const policyQuery = useQuery({
    queryKey: ['circulation-policies', effectiveSchoolId],
    queryFn: async () => (await api.get<{ policies: Policy[]; defaults: Policy[] }>(`/circulation-policies/${effectiveSchoolId}`)).data,
    enabled: !!effectiveSchoolId && canView,
  })

  useEffect(() => {
    if (policyQuery.data) {
      const normalized = normalizePolicies(policyQuery.data.policies)
      setPolicies(normalized)
      setOriginalPolicies(normalized)
      setDefaultPolicies(normalizePolicies(policyQuery.data.defaults ?? policyQuery.data.policies))
    }
  }, [policyQuery.data])

  useEffect(() => {
    if (!restoreOpen) return
    restoreCancelRef.current?.focus()
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setRestoreOpen(false)
      requestAnimationFrame(() => restoreTriggerRef.current?.focus())
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [restoreOpen])

  const save = useMutation({
    mutationFn: async (nextPolicies: Policy[] = policies) => (await api.put<{ policies: Policy[] }>(`/circulation-policies/${effectiveSchoolId}`, { policies: nextPolicies })).data.policies,
    onSuccess: (savedPolicies) => {
      const normalized = normalizePolicies(savedPolicies)
      setPolicies(normalized)
      setOriginalPolicies(normalized)
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
  const hasPendingChanges = JSON.stringify(normalizePolicies(policies)) !== JSON.stringify(normalizePolicies(originalPolicies))
  const savedPoliciesDifferFromDefaults = defaultPolicies.length === 2
    && JSON.stringify(normalizePolicies(originalPolicies)) !== JSON.stringify(normalizePolicies(defaultPolicies))
  const currentPoliciesDifferFromDefaults = defaultPolicies.length === 2
    && JSON.stringify(normalizePolicies(policies)) !== JSON.stringify(normalizePolicies(defaultPolicies))
  const canRestoreDefaults = savedPoliciesDifferFromDefaults && currentPoliciesDifferFromDefaults
  const saveDisabled = save.isPending || invalid || !hasPendingChanges

  const closeRestoreDialog = () => {
    setRestoreOpen(false)
    requestAnimationFrame(() => restoreTriggerRef.current?.focus())
  }

  const clearRestoreUndo = () => {
    if (restoreUndoTimer.current) clearTimeout(restoreUndoTimer.current)
    restoreUndoTimer.current = null
    setRestoreUndo(null)
  }

  useEffect(() => () => clearRestoreUndo(), [])

  const restoreDefaults = () => {
    const previousPolicies = normalizePolicies(originalPolicies)
    const restored = defaultPolicies.map(normalizePolicy)
    setPolicies(restored)
    save.mutate(restored, {
      onSuccess: () => {
        setRestoreUndo(previousPolicies)
        if (restoreUndoTimer.current) clearTimeout(restoreUndoTimer.current)
        restoreUndoTimer.current = setTimeout(clearRestoreUndo, 5 * 60 * 1000)
        closeRestoreDialog()
      },
    })
  }

  const undoRestoreDefaults = () => {
    if (!restoreUndo) return
    const previousPolicies = restoreUndo
    clearRestoreUndo()
    setPolicies(previousPolicies)
    save.mutate(previousPolicies)
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl sm:text-3xl font-bold">Regras de circulação</h1>
        <PageDescription>Defina limites de empréstimos e reservas para cada perfil de leitor da escola.</PageDescription>
      </header>

      {isSuperAdmin && showSchoolSelector && (
        <div className="max-w-xl">
          <Autocomplete
            id="circulation-school-search"
            label="Escola"
            value={schoolId}
            options={schoolOptions}
            placeholder="Busque uma escola"
            onChange={(nextSchoolId) => setSchoolId(nextSchoolId)}
            renderOption={(option) => <SchoolSuggestion option={option} />}
          />
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
          save.mutate(policies)
        }} className="flex flex-col gap-5">
          <div role="tablist" aria-label="Perfil de leitor" className={`${segmentedControlContainerClasses} mx-auto max-w-4xl`}>
            <span aria-hidden="true" className={segmentedControlIndicatorClasses('secondary', activeRole === 'teacher' ? 1 : 0)} />
            {(['student', 'teacher'] as ReaderRole[]).map((role) => <button key={role} ref={(element) => { tabRefs.current[role] = element }} type="button" role="tab" id={`${role}-policy-tab`} aria-selected={activeRole === role} aria-controls={`${role}-policy-panel`} tabIndex={activeRole === role ? 0 : -1} onClick={() => selectRole(role)} onKeyDown={handleTabKeyDown} className={segmentedControlItemClasses(activeRole === role)}>{roleLabel[role]}</button>)}
          </div>
          {policies.filter((policy) => policy.reader_role === activeRole).map((policy) => <div key={policy.reader_role} id={`${policy.reader_role}-policy-panel`} role="tabpanel" aria-labelledby={`${activeRole}-policy-tab`} tabIndex={-1}><PolicyForm policy={normalizePolicy(policy)} onChange={updatePolicy} firstInputRef={firstInputRef} readOnly={!canEdit} muted={isSuperAdmin} /></div>)}
          {canEdit && <div className="flex w-fit self-end justify-end gap-2 rounded-md border border-slate-300 bg-transparent p-2 dark:border-slate-600">
            <span className="group relative" tabIndex={saveDisabled ? 0 : undefined} aria-describedby={saveDisabled ? 'save-rules-tooltip' : undefined}>
              <Button type="submit" className="disabled:opacity-40" disabled={saveDisabled} aria-busy={save.isPending}>{save.isPending ? 'Salvando…' : 'Salvar regras'}</Button>
              {saveDisabled && <span id="save-rules-tooltip" role="tooltip" className="pointer-events-none absolute bottom-[calc(100%+0.5rem)] left-1/2 z-30 -translate-x-1/2 translate-y-1 whitespace-nowrap rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 opacity-0 shadow-lg transition-opacity duration-150 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100 dark:border-slate-600 dark:bg-slate-800 dark:text-white">Nenhuma alteração para salvar.</span>}
            </span>
            {canRestoreDefaults && <Button ref={restoreTriggerRef} type="button" variant="danger-secondary" onClick={() => setRestoreOpen(true)}>Restaurar padrões</Button>}
          </div>}
        </form>
      )}
      {restoreOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) closeRestoreDialog() }}>
        <section role="dialog" aria-modal="true" aria-labelledby="restore-defaults-title" aria-describedby="restore-defaults-description" className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl dark:bg-slate-800" onMouseDown={(event) => event.stopPropagation()}>
          <h2 id="restore-defaults-title" className="text-lg font-semibold">Restaurar regras padrão?</h2>
          <p id="restore-defaults-description" className="mt-2 text-sm text-slate-600 dark:text-slate-300">Esta ação substituirá as regras de circulação atuais pelos valores padrão do sistema. Após a restauração, as configurações administrativas específicas desta escola precisarão ser ajustadas novamente, se necessário.</p>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button ref={restoreCancelRef} type="button" variant="blue-secondary" onClick={closeRestoreDialog} disabled={save.isPending}>Cancelar</Button>
            <Button type="button" variant="danger-secondary" onClick={restoreDefaults} disabled={save.isPending} aria-busy={save.isPending}>{save.isPending ? 'Restaurando…' : 'Restaurar padrões'}</Button>
          </div>
        </section>
      </div>}
      {restoreUndo && <UndoSnackbar message="Regras de circulação restauradas." onUndo={undoRestoreDefaults} onClose={clearRestoreUndo} />}
    </div>
  )
}
