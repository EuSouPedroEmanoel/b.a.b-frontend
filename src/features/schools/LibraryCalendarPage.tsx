import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, ChevronLeft, ChevronRight, Trash2, X } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import api from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { useAnnouncer } from '@/components/feedback/LiveRegionContext'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { PageDescription } from '@/components/ui/PageDescription'
import { Autocomplete, type AutocompleteOption } from '@/components/ui/Autocomplete'
import { SchoolSuggestion } from '@/components/ui/SchoolSuggestion'
import { Tooltip } from '@/components/ui/Tooltip'
import { calendarMarkedOutlineClasses, dangerSubtleClasses } from '@/components/ui/Badge'

type NonWorkingDay = { date: string }
type NationalHoliday = { date: string; name: string; already_added: boolean }
type NationalHolidayPreview = { year: number; holidays: NationalHoliday[]; added_count: number; already_added_count: number }
type School = { id: number; name: string }
type Paginated<T> = { items: T[] }

const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const weekNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function isWeekend(year: number, month: number, day: number) {
  const weekday = new Date(year, month, day).getDay()
  return weekday === 0 || weekday === 6
}

function monthDays(year: number, month: number) {
  const first = new Date(year, month, 1)
  const offset = first.getDay()
  const days = new Date(year, month + 1, 0).getDate()
  return { offset, days }
}

function UnavailableDayMark({ children }: { children: ReactNode }) {
  return <span className="relative inline-flex h-6 min-w-6 items-center justify-center align-middle">
    <span className="relative z-0">{children}</span>
    <X className="pointer-events-none absolute inset-0 z-10 h-full w-full stroke-[1.5] opacity-90" aria-hidden="true" />
  </span>
}

export function LibraryCalendarPage({ schoolIdOverride, showSchoolSelector = true }: {
  schoolIdOverride?: string
  showSchoolSelector?: boolean
}) {
  const { user } = useAuth()
  const announce = useAnnouncer()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const [year, setYear] = useState(() => Number(searchParams.get('year')) || new Date().getFullYear())
  const [schoolId, setSchoolId] = useState(() => searchParams.get('school') ?? '')
  const [rangeStart, setRangeStart] = useState('')
  const [rangeEnd, setRangeEnd] = useState('')
  const [singleDate, setSingleDate] = useState('')
  const [dialog, setDialog] = useState<'date' | 'range' | 'holidays' | 'month' | null>(null)
  const [monthAction, setMonthAction] = useState<'select' | 'remove'>('select')
  const [selectedMonth, setSelectedMonth] = useState(0)
  const dateDialogTrigger = useRef<HTMLButtonElement>(null)
  const rangeDialogTrigger = useRef<HTMLButtonElement>(null)
  const holidayDialogTrigger = useRef<HTMLButtonElement>(null)
  const monthDialogTrigger = useRef<HTMLButtonElement>(null)
  const dateInputRef = useRef<HTMLInputElement>(null)
  const rangeStartRef = useRef<HTMLInputElement>(null)
  const holidayDialogRef = useRef<HTMLDivElement>(null)
  const monthDialogRef = useRef<HTMLDivElement>(null)
  const calendarHeadingRef = useRef<HTMLHeadingElement>(null)
  const nonWorkingHeadingRef = useRef<HTMLHeadingElement>(null)
  const isSuperAdmin = user?.role === 'super_admin'
  const isManager = isSuperAdmin || user?.role === 'school_admin' || (user?.role === 'librarian' && user.administrative_capabilities?.includes('manage_library_calendar'))
  const effectiveSchoolId = schoolIdOverride ?? (isSuperAdmin ? schoolId : String(user?.school_id ?? ''))

  const schoolsQuery = useQuery({
    queryKey: ['schools', 'library-calendar'],
    queryFn: async () => (await api.get<Paginated<School>>('/schools/?size=100')).data.items,
    enabled: isSuperAdmin,
  })
  const schoolOptions: AutocompleteOption<School>[] = (schoolsQuery.data ?? []).map((school) => ({
    value: String(school.id),
    label: school.name,
    data: school,
  }))
  const daysQuery = useQuery({
    queryKey: ['library-calendar', effectiveSchoolId, year],
    queryFn: async () => (await api.get<{ days?: NonWorkingDay[]; items?: NonWorkingDay[] }>(`/library-calendar/${effectiveSchoolId}?year=${year}`)).data,
    enabled: !!effectiveSchoolId && !!user && user.role !== 'guest',
  })
  const holidayPreview = useQuery({
    queryKey: ['national-holidays', effectiveSchoolId, year],
    queryFn: async () => (await api.get<NationalHolidayPreview>(`/library-calendar/${effectiveSchoolId}/national-holidays?year=${year}`)).data,
    enabled: false,
  })
  const days = daysQuery.data?.days ?? daysQuery.data?.items ?? []
  const dayMap = useMemo(() => new Map(days.map((day) => [day.date, day])), [days])
  const groupedDays = useMemo(() => {
    const groups = new Map<string, NonWorkingDay[]>()
    days.slice().sort((a, b) => a.date.localeCompare(b.date)).forEach((day) => {
      const month = day.date.slice(5, 7)
      const current = groups.get(month) ?? []
      current.push(day)
      groups.set(month, current)
    })
    return Array.from(groups.entries())
  }, [days])

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['library-calendar', effectiveSchoolId, year] })
  const addDay = useMutation({
    mutationFn: async (date: string) => api.post(`/library-calendar/${effectiveSchoolId}/non-working-days`, { date }),
    onSuccess: () => { announce('Dia não útil marcado.', 'polite'); invalidate() },
    onError: (error: unknown) => announce((error as { response?: { status?: number } })?.response?.status === 409 ? 'Esta data já está marcada como não útil.' : 'Não foi possível marcar o dia.', 'assertive'),
  })
  const addRange = useMutation({
    mutationFn: async () => api.post(`/library-calendar/${effectiveSchoolId}/non-working-days/range`, { start_date: rangeStart, end_date: rangeEnd }),
    onSuccess: (response) => { const count = Array.isArray(response.data) ? response.data.length : 0; announce(count ? `${count} dia(s) não útil(eis) marcado(s).` : 'O intervalo já estava marcado.', 'polite'); setRangeStart(''); setRangeEnd(''); invalidate() },
    onError: () => announce('Não foi possível marcar o intervalo.', 'assertive'),
  })
  const removeDay = useMutation({
    mutationFn: async (date: string) => api.delete(`/library-calendar/${effectiveSchoolId}/non-working-days/${date}`),
    onSuccess: () => { announce('Dia não útil removido.', 'polite'); invalidate() },
    onError: () => announce('Não foi possível remover o dia.', 'assertive'),
  })
  const monthSelect = useMutation({
    mutationFn: async ({ month }: { month: number }) => api.post<NonWorkingDay[]>(`/library-calendar/${effectiveSchoolId}/non-working-days/month`, { year, month: month + 1 }),
    onSuccess: (response) => { announce(response.data.length ? `${response.data.length} dia(s) útil(eis) marcado(s) como não útil(eis).` : 'Todos os dias úteis do mês já estavam marcados.', 'polite'); invalidate(); closeDialog() },
    onError: () => announce('Não foi possível marcar o mês.', 'assertive'),
  })
  const monthRemove = useMutation({
    mutationFn: async ({ month }: { month: number }) => api.delete(`/library-calendar/${effectiveSchoolId}/non-working-days/month/${year}/${month + 1}`),
    onSuccess: () => { announce(`Dias não úteis de ${monthNames[selectedMonth]} de ${year} desmarcados.`, 'polite'); invalidate(); closeDialog() },
    onError: () => announce('Não foi possível desmarcar o mês.', 'assertive'),
  })
  const importHolidays = useMutation({
    mutationFn: async () => (await api.post<NationalHolidayPreview>(`/library-calendar/${effectiveSchoolId}/national-holidays/import?year=${year}`)).data,
    onSuccess: (result) => {
      announce(result.added_count ? `${result.added_count} feriados nacionais adicionados.` : 'Nenhum feriado novo foi adicionado.', 'polite')
      invalidate()
      closeDialog()
    },
    onError: () => announce('Não foi possível consultar ou importar os feriados nacionais.', 'assertive'),
  })

  useEffect(() => {
    if (!dialog) return
    const focusTarget = dialog === 'date' ? dateInputRef : dialog === 'range' ? rangeStartRef : dialog === 'holidays' ? holidayDialogRef : monthDialogRef
    requestAnimationFrame(() => {
      if (dialog === 'holidays') holidayDialogRef.current?.focus()
      else if (dialog === 'month') monthDialogRef.current?.focus()
      else focusTarget.current?.focus()
    })
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setDialog(null)
      requestAnimationFrame(() => (dialog === 'date' ? dateDialogTrigger : dialog === 'range' ? rangeDialogTrigger : dialog === 'month' ? monthDialogTrigger : holidayDialogTrigger).current?.focus())
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [dialog])

  const closeDialog = () => {
    const trigger = dialog === 'date' ? dateDialogTrigger : dialog === 'range' ? rangeDialogTrigger : dialog === 'month' ? monthDialogTrigger : holidayDialogTrigger
    setDialog(null)
    requestAnimationFrame(() => trigger.current?.focus())
  }
  const submitSingleDate = (event: React.FormEvent) => {
    event.preventDefault()
    if (!singleDate) return
    addDay.mutate(singleDate, {
      onSuccess: () => {
        setYear(Number(singleDate.slice(0, 4)))
        setSingleDate('')
        closeDialog()
      },
    })
  }
  const submitRange = (event: React.FormEvent) => {
    event.preventDefault()
    if (!rangeStart || !rangeEnd || rangeStart > rangeEnd) return
    addRange.mutate(undefined, { onSuccess: closeDialog })
  }
  const openHolidayDialog = () => {
    setDialog('holidays')
    void holidayPreview.refetch()
  }
  const openMonthAction = (month: number, action: 'select' | 'remove') => {
    setSelectedMonth(month)
    setMonthAction(action)
    setDialog('month')
  }
  const focusSection = (target: React.RefObject<HTMLElement | null>) => {
    target.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    target.current?.focus({ preventScroll: true })
  }

  if (!user || user.role === 'guest' || !['super_admin', 'school_admin', 'librarian'].includes(user.role)) {
    return <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">Você não tem permissão para consultar o calendário da biblioteca.</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><h1 ref={calendarHeadingRef} id="library-calendar-heading" tabIndex={-1} className="text-2xl sm:text-3xl font-bold flex items-center gap-2 focus-visible:outline-3 focus-visible:outline-[var(--color-focus)]"><CalendarDays aria-hidden="true" /> Calendário da biblioteca</h1><PageDescription>Consulte os dias não úteis da escola e o calendário anual de funcionamento.</PageDescription></div>
        <div className="flex flex-wrap items-center justify-end gap-2" aria-label="Ações do calendário">
          <div className="flex items-center gap-2" aria-label="Navegação do ano"><Button variant="secondary" size="sm" onClick={() => setYear((value) => value - 1)} aria-label="Ano anterior"><ChevronLeft aria-hidden="true" /></Button><span className="min-w-[4rem] text-center font-semibold" aria-live="polite">{year}</span><Button variant="secondary" size="sm" onClick={() => setYear((value) => value + 1)} aria-label="Próximo ano"><ChevronRight aria-hidden="true" /></Button></div>
          {isManager && <><Button ref={dateDialogTrigger} variant="secondary" size="sm" onClick={() => setDialog('date')}>Adicionar por data</Button><Button ref={rangeDialogTrigger} variant="secondary" size="sm" onClick={() => setDialog('range')}>Marcar intervalo</Button><Button ref={holidayDialogTrigger} variant="secondary" size="sm" onClick={openHolidayDialog}>Importar feriados nacionais</Button></>}
        </div>
      </header>
      <nav aria-label="Atalhos do calendário" className="flex flex-wrap gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
        <Button variant="secondary" size="sm" onClick={() => focusSection(calendarHeadingRef)}>Ir para o calendário</Button>
        {days.length > 0 && <Button variant="secondary" size="sm" onClick={() => focusSection(nonWorkingHeadingRef)}>Ir para dias não úteis cadastrados</Button>}
      </nav>
      {isSuperAdmin && showSchoolSelector && (
        <div className="max-w-xl">
          <Autocomplete
            id="library-calendar-school"
            label="Escola"
            value={schoolId}
            onChange={setSchoolId}
            options={schoolOptions}
            placeholder="Busque uma escola"
            renderOption={(option) => <SchoolSuggestion option={option} />}
          />
        </div>
      )}
      {!effectiveSchoolId && <p aria-live="polite" className="text-slate-600 dark:text-slate-300">Selecione uma escola para consultar o calendário.</p>}
      {effectiveSchoolId && <p aria-live="polite" className="text-sm text-slate-600 dark:text-slate-300">{isManager ? 'Você pode gerenciar os dias não úteis.' : 'Modo de consulta: somente leitura.'}</p>}
      {effectiveSchoolId && <div className="flex flex-wrap gap-3 text-sm" aria-label="Legenda do calendário"><span className="rounded-md border border-slate-300 px-2 py-1 dark:border-slate-600">Dia útil</span><span className="rounded-md bg-slate-100 px-2 py-1 text-slate-600 dark:bg-slate-700/50 dark:text-slate-300">Fim de semana</span><span className={`inline-flex items-center gap-1 rounded-md border-2 px-2 py-1 font-semibold ${calendarMarkedOutlineClasses}`}><X className="h-4 w-4" aria-hidden="true" /><span>Dia não útil</span></span></div>}
      {effectiveSchoolId && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {monthNames.map((monthName, month) => { const { offset, days: total } = monthDays(year, month); const weekdays = Array.from({ length: total }, (_, index) => index + 1).filter((day) => !isWeekend(year, month, day)); const markedWeekdays = weekdays.filter((day) => dayMap.has(isoDate(year, month, day))).length; const complete = markedWeekdays === weekdays.length; return <Card key={monthName}><CardHeader className="flex items-center justify-between gap-2"><h2 className="font-semibold">{monthName}</h2>{isManager && <Button variant="secondary" size="sm" className="shrink-0 !px-2.5 !py-1.5 text-xs" onClick={(event) => { monthDialogTrigger.current = event.currentTarget; openMonthAction(month, complete ? 'remove' : 'select') }} aria-label={complete ? `Desmarcar os dias não úteis de ${monthName.toLowerCase()} de ${year}` : `Marcar todos os dias úteis de ${monthName.toLowerCase()} de ${year} como não úteis`}>{complete ? 'Desmarcar mês' : 'Selecionar mês'}</Button>}</CardHeader><CardBody className="p-3"><div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-500" aria-hidden="true">{weekNames.map((name) => <span key={name}>{name}</span>)}</div><div className="mt-1 grid grid-cols-7 gap-1" role="grid" aria-label={`${monthName} de ${year}`}>
          {Array.from({ length: offset }).map((_, index) => <span key={`empty-${index}`} aria-hidden="true" />)}
          {Array.from({ length: total }, (_, index) => { const day = index + 1; const date = isoDate(year, month, day); const marked = dayMap.has(date); const weekend = isWeekend(year, month, day); const status = marked ? 'Dia não útil' : weekend ? 'Fim de semana' : 'Dia útil'; const action = marked ? 'pressione para tornar útil' : weekend ? 'fim de semana' : 'dia útil, pressione para marcar como não útil'; return <button key={date} type="button" role="gridcell" aria-label={`${day} de ${monthName} de ${year}, ${marked ? 'dia não útil, pressione para tornar útil' : action}`} aria-pressed={marked} disabled={!isManager || weekend} onClick={() => { if (marked) void removeDay.mutateAsync(date); else void addDay.mutateAsync(date) }} className={`group relative min-h-[38px] rounded-md border text-sm focus-visible:outline-3 focus-visible:outline-[var(--color-focus)] ${marked ? `cursor-pointer border-2 ${calendarMarkedOutlineClasses}` : weekend ? 'border-transparent bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300' : 'border-transparent bg-slate-100 text-slate-900 hover:bg-blue-100 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600'}`}>{marked ? <UnavailableDayMark>{day}</UnavailableDayMark> : day}<Tooltip><strong className="text-base leading-5">{day}</strong><span>{status}</span></Tooltip></button> })}
        </div></CardBody></Card> })}
      </div>}
      {days.length > 0 && <Card><CardHeader><h2 ref={nonWorkingHeadingRef} id="non-working-days-heading" tabIndex={-1} className="font-semibold focus-visible:outline-3 focus-visible:outline-[var(--color-focus)]">Dias não úteis cadastrados</h2></CardHeader><CardBody><div className="grid gap-5" aria-label="Dias não úteis cadastrados">{groupedDays.map(([month, monthDays]) => <section key={month} aria-labelledby={`non-working-month-${month}`}><h3 id={`non-working-month-${month}`} className="mb-2 text-base font-bold text-slate-800 dark:text-slate-100 sm:text-lg">{monthNames[Number(month) - 1]}</h3><ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{monthDays.map((day) => <li key={day.date} className={`flex min-h-0 items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 ${dangerSubtleClasses}`}><strong className="text-base font-semibold sm:text-lg">{day.date.split('-').reverse().join('/')}</strong>{isManager && <Button size="sm" className="!min-h-11 !min-w-11 !p-2 cursor-pointer" variant="danger-secondary" onClick={() => void removeDay.mutateAsync(day.date)} aria-label={`Remover ${day.date.split('-').reverse().join('/')} dos dias não úteis`}><Trash2 className="h-5 w-5" aria-hidden="true" /></Button>}</li>)}</ul></section>)}</div><div className="mt-5"><Button variant="secondary" size="sm" onClick={() => focusSection(calendarHeadingRef)}>Voltar ao início do calendário</Button></div></CardBody></Card>}
      {dialog && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDialog() }}><section role="dialog" aria-modal="true" aria-labelledby="calendar-dialog-title" tabIndex={-1} ref={dialog === 'holidays' ? holidayDialogRef : dialog === 'month' ? monthDialogRef : undefined} className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-slate-800"><h2 id="calendar-dialog-title" className="text-lg font-semibold">{dialog === 'date' ? 'Adicionar por data' : dialog === 'range' ? 'Marcar intervalo' : dialog === 'month' ? (monthAction === 'remove' ? `Desmarcar os dias não úteis de ${monthNames[selectedMonth]} de ${year}?` : `Marcar todos os dias úteis de ${monthNames[selectedMonth].toLowerCase()} de ${year} como não úteis?`) : `Importar feriados nacionais — ${year}`}</h2>{dialog === 'month' ? <div className="mt-4 flex justify-end gap-2"><Button type="button" variant="secondary" onClick={closeDialog}>Cancelar</Button><Button type="button" variant="secondary" onClick={() => monthAction === 'remove' ? monthRemove.mutate({ month: selectedMonth }) : monthSelect.mutate({ month: selectedMonth })} disabled={monthRemove.isPending || monthSelect.isPending}>{monthRemove.isPending || monthSelect.isPending ? 'Salvando…' : monthAction === 'remove' ? 'Desmarcar' : 'Selecionar'}</Button></div> : dialog === 'date' ? <form className="mt-4 grid gap-4" onSubmit={submitSingleDate}><Input ref={dateInputRef} type="date" label="Data" value={singleDate} onChange={(event) => setSingleDate(event.target.value)} required /><div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={closeDialog}>Cancelar</Button><Button type="submit" disabled={!singleDate || addDay.isPending}>{addDay.isPending ? 'Salvando…' : 'Marcar como não útil'}</Button></div></form> : dialog === 'range' ? <form className="mt-4 grid gap-4" onSubmit={submitRange}><div className="grid gap-4 sm:grid-cols-2"><Input ref={rangeStartRef} type="date" label="Data inicial" value={rangeStart} onChange={(event) => setRangeStart(event.target.value)} required /><Input type="date" label="Data final" value={rangeEnd} onChange={(event) => setRangeEnd(event.target.value)} required /></div><div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={closeDialog}>Cancelar</Button><Button type="submit" disabled={!rangeStart || !rangeEnd || rangeStart > rangeEnd || addRange.isPending}>{addRange.isPending ? 'Salvando…' : 'Marcar intervalo'}</Button></div></form> : <div className="mt-4 grid gap-4"><div aria-live="polite">{holidayPreview.isFetching ? 'Consultando feriados nacionais…' : holidayPreview.isError ? 'Não foi possível consultar os feriados nacionais.' : `${holidayPreview.data?.added_count ?? 0} novos dias serão adicionados. ${holidayPreview.data?.already_added_count ?? 0} já estão cadastrados.`}</div>{holidayPreview.data && <ul className="max-h-72 overflow-y-auto rounded-md border border-slate-200 dark:border-slate-600">{holidayPreview.data.holidays.map((holiday) => <li key={holiday.date} className="flex items-center justify-between gap-3 border-b border-slate-200 px-3 py-2 last:border-b-0 dark:border-slate-700"><span>{holiday.date.split('-').reverse().join('/')} — {holiday.name}</span>{holiday.already_added && <span className="shrink-0 text-sm text-slate-500 dark:text-slate-300">Já adicionado</span>}</li>)}</ul>}<div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={closeDialog}>Cancelar</Button><Button type="button" onClick={() => importHolidays.mutate()} disabled={!holidayPreview.data || holidayPreview.data.added_count === 0 || importHolidays.isPending}>{importHolidays.isPending ? 'Importando…' : 'Importar feriados'}</Button></div></div>}</section></div>}
    </div>
  )
}
