import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Funnel } from 'lucide-react'
import api from '@/lib/api'
import { useAnnouncer } from '@/components/feedback/LiveRegionContext'
import { useNavigationFocusIntent } from '@/components/navigation/useNavigationFocusIntent'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Pagination } from '@/components/ui/Pagination'
import { Select } from '@/components/ui/Select'
import { Autocomplete, type AutocompleteOption } from '@/components/ui/Autocomplete'
import { CoverImage } from '@/components/ui/CoverImage'
import { PageDescription } from '@/components/ui/PageDescription'
import { SchoolSuggestion } from '@/components/ui/SchoolSuggestion'
import { ModalDialog } from '@/components/ui/ModalDialog'
import { bookConditionLabel, bookStateLabel, bookStateTone } from '@/lib/bookStates'
import { formatCpfInput, onlyDigits, validateCpfDigits } from '@/lib/cpf'
import { useAuth } from '@/hooks/useAuth'
import { hasPersonalReaderCapability } from '@/lib/permissions'

type Loan = { id: number; copy_id: number; user_id: number; school_id: number; status: string; borrowed_at: string; due_date: string; returned_at: string | null; late_days: number; internal_code: string; book_id: number; book_title: string; book_cover_url: string | null; borrower_username: string; borrower_cpf_masked: string | null }
type Copy = { id: number; code: string; state: string; condition: string; book_id: number; school_id: number }
type Book = { id: number; title: string; cover_url: string | null }
type User = { id: number; username: string; role: string; school_id: number | null; school_name: string | null; turma_numero: number | null; turma_letra: string | null; is_active: boolean }
type Paginated<T> = { items: T[]; total: number; page: number; size: number; pages: number }
type CopyPreview = Copy & { book: Book }
type CopyLookupResult = { kind: 'copy'; copy: CopyPreview } | { kind: 'ambiguous'; copies: Copy[] }
type School = { id: number; name: string; code: string; is_active: boolean }
type ReturnCopySearchResult = { kind: 'copy'; loan: Loan } | { kind: 'ambiguous'; copies: Copy[] }
type Operation = 'borrow' | 'return'
type ReturnLookup = { kind: 'copy' | 'user'; value: string }
type ReturnSearchResult = { kind: 'copy'; loan: Loan } | { kind: 'user'; user: User; loans: Loan[] }
type ReturnRequest = { id: number; source: 'table' | 'copy' | 'user' }
type LoanSituation = '' | 'borrowed' | 'overdue' | 'due_soon' | 'returned'
type PickupReservation = { id: number; book_id: number; user_id: number; school_id: number; status: string; book_title: string; reserver_username: string; reserver_role: string; reserver_is_active: boolean; reserver_turma_numero: number | null; reserver_turma_letra: string | null; copy_id: number | null; internal_code: string | null }

const statusLabel = (status: string) => ({ active: 'Ativo', overdue: 'Atrasado', returned: 'Devolvido' }[status] ?? status)
const statusTone = (status: string) => status === 'active' ? 'warning' : status === 'overdue' ? 'danger' : 'success' as const
const roleLabel = (role: string) => ({ student: 'Aluno', teacher: 'Professor', librarian: 'Bibliotecário', school_admin: 'Administrador escolar', super_admin: 'Superadministrador' }[role] ?? role)
const formatDate = (value: string) => new Date(value).toLocaleDateString('pt-BR')

function returnLookupKind(value: string): 'copy' | 'user' | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  return /^\d/.test(trimmed) ? 'user' : 'copy'
}

function loanLateDays(dueDate: string) {
  const due = new Date(`${dueDate.slice(0, 10)}T00:00:00`)
  const today = new Date()
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.max(0, Math.floor((current.getTime() - due.getTime()) / 86400000))
}

function loanDisplayStatus(loan: Loan) {
  return loan.status !== 'returned' && loanLateDays(loan.due_date) > 0 ? 'overdue' : loan.status
}

function loanDisplayLateDays(loan: Loan) {
  return loan.status === 'returned' ? loan.late_days : loanLateDays(loan.due_date)
}

function getErrorMessage(error: unknown, fallback: string) {
  return (error as { response?: { data?: { detail?: string } }; message?: string })?.response?.data?.detail
    ?? (error as { message?: string })?.message
    ?? fallback
}

function getLoanCreationError(error: unknown) {
  const rawDetail = getErrorMessage(error, 'Ocorreu um erro ao confirmar o empréstimo.')
  const detail = typeof rawDetail === 'string'
    ? rawDetail
    : 'Ocorreu um erro ao confirmar o empréstimo.'
  const normalizedDetail = detail.toLocaleLowerCase('pt-BR')
  const copyError = /copy is not available|copy not found|internal code is ambiguous|exemplar|c[oó]digo/.test(normalizedDetail)
  const userError = /borrower not found|borrower is inactive|borrower does not belong|cpf inv[aá]lido|leitor|usu[aá]rio|cpf/.test(normalizedDetail)
  const accessibleDetail = /copy is not available/.test(normalizedDetail)
    ? 'Este exemplar não está disponível para empréstimo.'
    : /copy not found/.test(normalizedDetail)
      ? 'Exemplar não encontrado. Verifique o código e tente novamente.'
      : /internal code is ambiguous/.test(normalizedDetail)
        ? 'O código interno do exemplar é ambíguo entre escolas. Selecione a escola do exemplar.'
        : /borrower not found/.test(normalizedDetail)
          ? 'Leitor não encontrado. Verifique os dados e tente novamente.'
          : /borrower is inactive/.test(normalizedDetail)
            ? 'Este leitor está inativo e não pode realizar empréstimos.'
            : /borrower does not belong/.test(normalizedDetail)
              ? 'O leitor não pertence à mesma escola do exemplar.'
              : /cpf inv[aá]lido/.test(normalizedDetail)
                ? 'Informe um CPF válido para o leitor.'
                : 'O serviço não conseguiu confirmar a operação. Tente novamente.'

  return {
    detail: accessibleDetail,
    field: copyError ? 'copy' : userError ? 'user' : undefined,
    announcement: `Não foi possível realizar o empréstimo. ${accessibleDetail}`,
  }
}

const personalLoanStatusLabel = (status: string) => ({
  active: 'Em andamento',
  overdue: 'Atrasado',
  returned: 'Devolvido',
}[status] ?? 'Em andamento')

function PersonalLoansView() {
  const [page, setPage] = useState(1)
  const pageSize = 20
  const { data, isLoading, isError } = useQuery({
    queryKey: ['loans', 'me', page, pageSize],
    queryFn: async () => (await api.get<Paginated<Loan>>('/loans/me', {
      params: { page, size: pageSize },
    })).data,
  })

  if (isLoading) {
    return <p role="status" className="text-sm text-slate-600 dark:text-slate-300">Carregando seus empréstimos…</p>
  }

  if (isError || !data) {
    return <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">Não foi possível carregar seus empréstimos. Atualize a página para tentar novamente.</div>
  }

  const activeLoans = data.items.filter((loan) => loan.status !== 'returned')
  const historyLoans = data.items.filter((loan) => loan.status === 'returned')

  return <div className="flex flex-col gap-6">
    <header>
      <h1 className="text-2xl font-bold sm:text-3xl">Meus empréstimos</h1>
      <PageDescription>Acompanhe seus empréstimos atuais e o histórico de devoluções.</PageDescription>
    </header>
    {data.total === 0 ? <Card><CardBody><p className="text-sm text-slate-600 dark:text-slate-300">Você ainda não possui empréstimos.</p></CardBody></Card> : <>
      <PersonalLoanSection title="Empréstimos atuais" empty="Você não possui empréstimos em andamento." loans={activeLoans} />
      <PersonalLoanSection title="Histórico" empty="Seu histórico de empréstimos está vazio." loans={historyLoans} />
      <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />
    </>}
  </div>
}

function PersonalLoanSection({ title, empty, loans }: { title: string; empty: string; loans: Loan[] }) {
  return <section aria-labelledby={`personal-${title === 'Histórico' ? 'history' : 'active'}-loans-heading`} className="flex flex-col gap-3">
    <div>
      <h2 id={`personal-${title === 'Histórico' ? 'history' : 'active'}-loans-heading`} className="text-xl font-semibold">{title}</h2>
    </div>
    {loans.length === 0 ? <Card><CardBody><p className="text-sm text-slate-600 dark:text-slate-300">{empty}</p></CardBody></Card> : <ul className="grid gap-3" role="list">{loans.map((loan) => <PersonalLoanCard key={loan.id} loan={loan} />)}</ul>}
  </section>
}

function PersonalLoanCard({ loan }: { loan: Loan }) {
  const displayStatus = loanDisplayStatus(loan)
  const lateDays = loanDisplayLateDays(loan)
  const returned = loan.status === 'returned'
  const dateLabel = returned ? 'Devolvido em' : 'Vencimento'
  const dateValue = returned && loan.returned_at ? formatDate(loan.returned_at) : formatDate(loan.due_date)

  return <li>
    <Card className="h-full">
      <CardBody>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <CoverImage src={loan.book_cover_url} title={loan.book_title} alt="" width={80} height={120} className="h-28 w-[4.75rem] shrink-0 rounded-md border border-slate-200 dark:border-slate-600 sm:h-32 sm:w-[5.25rem]" sizes="84px" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="text-lg font-semibold">{loan.book_title}</h3>
              <Badge tone={displayStatus === 'overdue' ? 'danger' : returned ? 'neutral' : 'warning'}>{personalLoanStatusLabel(displayStatus)}</Badge>
            </div>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div><dt className="text-slate-600 dark:text-slate-400">Exemplar</dt><dd className="font-mono font-medium">{loan.internal_code}</dd></div>
              <div><dt className="text-slate-600 dark:text-slate-400">Retirada</dt><dd>{formatDate(loan.borrowed_at)}</dd></div>
              <div><dt className="text-slate-600 dark:text-slate-400">{dateLabel}</dt><dd>{dateValue}</dd></div>
              {!returned && lateDays > 0 && <div><dt className="text-slate-600 dark:text-slate-400">Atraso</dt><dd className="font-medium text-red-700 dark:text-red-300">{lateDays} {lateDays === 1 ? 'dia' : 'dias'}</dd></div>}
              {returned && loan.late_days > 0 && <div><dt className="text-slate-600 dark:text-slate-400">Atraso registrado</dt><dd>{loan.late_days} {loan.late_days === 1 ? 'dia' : 'dias'}</dd></div>}
            </dl>
            <Link to={`/acervo/${loan.book_id}`} className="mt-4 inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-3 focus-visible:outline-[var(--color-focus)] focus-visible:outline-offset-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white">Ver livro</Link>
          </div>
        </div>
      </CardBody>
    </Card>
  </li>
}

export function LoansPage() {
  const { user, loading } = useAuth()
  if (loading) return <p role="status" className="text-sm text-slate-600 dark:text-slate-300">Carregando empréstimos…</p>
  if (user && hasPersonalReaderCapability(user.role)) return <PersonalLoansView />
  return <OperationalLoansPage />
}

function OperationalLoansPage() {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(() => {
    const saved = localStorage.getItem('emprestimos:pageSize')
    return saved && [10, 20, 30, 50].includes(Number(saved)) ? Number(saved) : 10
  })
  const [situation, setSituation] = useState<LoanSituation>('')
  const [internalCode, setInternalCode] = useState('')
  const [cpf, setCpf] = useState('')
  const [copyLookupCode, setCopyLookupCode] = useState('')
  const [copySchoolId, setCopySchoolId] = useState('')
  const [userLookupCpf, setUserLookupCpf] = useState('')
  const [copyInputError, setCopyInputError] = useState<string | undefined>()
  const [userInputError, setUserInputError] = useState<string | undefined>()
  const [operation, setOperation] = useState<Operation>('borrow')
  const [returnLookup, setReturnLookup] = useState('')
  const [returnSearch, setReturnSearch] = useState<ReturnLookup | null>(null)
  const [returnSchoolId, setReturnSchoolId] = useState('')
  const [returnInputError, setReturnInputError] = useState<string | undefined>()
  const [loanConfirmationOpen, setLoanConfirmationOpen] = useState(false)
  const [loanConfirmationError, setLoanConfirmationError] = useState<string | null>(null)
  const [loanSuccessMessage, setLoanSuccessMessage] = useState<string | null>(null)
  const focusCpfAfterLookup = useRef(false)
  const focusCodeAfterLookup = useRef(false)
  const focusConfirmAfterLookup = useRef(false)
  const codeRef = useRef<HTMLInputElement>(null)
  const cpfRef = useRef<HTMLInputElement>(null)
  const confirmLoanRef = useRef<HTMLButtonElement>(null)
  const cancelLoanConfirmationRef = useRef<HTMLButtonElement>(null)
  const acceptLoanConfirmationRef = useRef<HTMLButtonElement>(null)
  const returnLookupRef = useRef<HTMLInputElement>(null)
  const focusReturnAfterId = useRef<number | null>(null)
  const announcedCopyKey = useRef<string | null>(null)
  const announcedUserKey = useRef<string | null>(null)
  const announcedReturnKey = useRef<string | null>(null)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const bookIdParam = Number(searchParams.get('book_id'))
  const reservationIdParam = Number(searchParams.get('reservation_id'))
  const reservationId = Number.isSafeInteger(reservationIdParam) && reservationIdParam > 0
    ? reservationIdParam : undefined
  const reservationQuery = useQuery({
    queryKey: ['loan-reservation', reservationId],
    enabled: !!reservationId,
    retry: false,
    queryFn: async () => (await api.get<PickupReservation>(`/reservations/${reservationId}`)).data,
  })
  const pickupReservation = reservationQuery.data?.status === 'ready'
    ? reservationQuery.data : undefined
  const preselectedBookId = pickupReservation?.book_id
    ?? (Number.isSafeInteger(bookIdParam) && bookIdParam > 0 ? bookIdParam : undefined)
  const announce = useAnnouncer()
  const { consumeOperationalFocus } = useNavigationFocusIntent()
  const qc = useQueryClient()
  const { user: currentUser } = useAuth()
  const isSuperAdmin = currentUser?.role === 'super_admin'
  const canManageLoans = !isSuperAdmin

  const selectedBookQuery = useQuery({
    queryKey: ['loan-selected-book', preselectedBookId],
    enabled: canManageLoans && operation === 'borrow' && !!preselectedBookId,
    retry: false,
    queryFn: async () => (await api.get<Book>(`/books/${preselectedBookId}`)).data,
  })
  const selectedBookCopiesQuery = useQuery({
    queryKey: ['loan-selected-book-copies', preselectedBookId],
    enabled: canManageLoans && operation === 'borrow' && !!preselectedBookId,
    retry: false,
    queryFn: async () => (await api.get<Paginated<Copy>>('/copies/', { params: { book_id: preselectedBookId, size: 100 } })).data,
  })

  const { data: schoolsData } = useQuery({
    queryKey: ['schools', 'loan-lookup'],
    queryFn: async () => (await api.get<Paginated<School>>('/schools/?size=100')).data,
    enabled: isSuperAdmin,
  })
  const schoolOptions: AutocompleteOption<School>[] = (schoolsData?.items ?? []).map((school) => ({
    value: String(school.id),
    label: `${school.name} (${school.code})`,
    data: school,
  }))

  const initialFocusDecisionRef = useRef(false)
  const previousOperationRef = useRef(operation)

  useEffect(() => {
    if (!initialFocusDecisionRef.current) {
      initialFocusDecisionRef.current = true
      if (!consumeOperationalFocus('/emprestimos')) return
    } else if (previousOperationRef.current === operation) {
      return
    }
    previousOperationRef.current = operation

    const timer = window.setTimeout(() => {
      const input = operation === 'borrow' ? codeRef.current : returnLookupRef.current
      input?.focus()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [consumeOperationalFocus, operation])

  useEffect(() => { localStorage.setItem('emprestimos:pageSize', String(pageSize)) }, [pageSize])

  useEffect(() => {
    if (!loanSuccessMessage) return
    const timer = window.setTimeout(() => setLoanSuccessMessage(null), 6000)
    return () => window.clearTimeout(timer)
  }, [loanSuccessMessage])

  const { data: loans } = useQuery({
    queryKey: ['loans', page, pageSize, situation],
    queryFn: async () => (await api.get<Paginated<Loan>>('/loans/', { params: { page, size: pageSize, ...(situation === 'returned' ? { status: 'returned' } : situation ? { situation } : {}) } })).data,
  })

  const copyQuery = useQuery({
    queryKey: ['loan-copy-preview', copyLookupCode, copySchoolId],
    enabled: !!copyLookupCode,
    retry: false,
    queryFn: async (): Promise<CopyLookupResult> => {
      const { data } = await api.get<Paginated<Copy>>('/copies/', { params: { internal_code: copyLookupCode, size: 100, ...(copySchoolId ? { school_id: copySchoolId } : {}) } })
      if (data.total === 0) throw new Error('Exemplar não encontrado para o código informado.')
      if (data.total > 1) return { kind: 'ambiguous', copies: data.items }
      const copy = data.items[0]
      const { data: book } = await api.get<Book>(`/books/${copy.book_id}`)
      return { kind: 'copy', copy: { ...copy, book } }
    },
  })

  const copyMatchesInput = copyLookupCode === internalCode.trim()
  const userMatchesInput = userLookupCpf === cpf
  const copy = copyMatchesInput && copyQuery.data?.kind === 'copy' ? copyQuery.data.copy : undefined
  const copyAmbiguous = copyMatchesInput && copyQuery.data?.kind === 'ambiguous' ? copyQuery.data : undefined
  const borrowSchoolId = isSuperAdmin ? (copySchoolId || (copy ? String(copy.school_id) : '')) : copySchoolId

  const userQuery = useQuery({
    queryKey: ['loan-user-preview', userLookupCpf, borrowSchoolId],
    enabled: !!userLookupCpf && !!copy,
    retry: false,
    queryFn: async (): Promise<User> => {
      const { data } = await api.get<Paginated<User>>('/users/', { params: { cpf: userLookupCpf, size: 1, ...(borrowSchoolId ? { school_id: borrowSchoolId } : {}) } })
      if (data.total === 0) throw new Error('Usuário não encontrado para o CPF informado.')
      return data.items[0]
    },
  })

  const user = userMatchesInput ? userQuery.data : undefined
  const sameSchool = !!copy && !!user && copy.school_id === user.school_id
  const reader = pickupReservation
    ? { id: pickupReservation.user_id, username: pickupReservation.reserver_username, role: pickupReservation.reserver_role, school_id: pickupReservation.school_id, school_name: null, turma_numero: pickupReservation.reserver_turma_numero, turma_letra: pickupReservation.reserver_turma_letra, is_active: pickupReservation.reserver_is_active }
    : sameSchool ? user : undefined
  const copyAvailable = copy?.state === 'available'
  const userEligible = !!reader?.is_active
  const copyBelongsToSelectedBook = !preselectedBookId || !copy || copy.book_id === preselectedBookId
  const copyMatchesPickupReservation = !pickupReservation || !copy || copy.id === pickupReservation.copy_id
  const copyEligible = pickupReservation
    ? copy?.state === 'reserved' && copyMatchesPickupReservation
    : copyAvailable
  const canCreate = !!copy && copyBelongsToSelectedBook && copyMatchesPickupReservation && !!reader && copyEligible && userEligible && !copyQuery.isFetching && !userQuery.isFetching
  const copyError = copyInputError
    ?? (!copyBelongsToSelectedBook ? 'O exemplar informado não pertence ao livro selecionado.' : undefined)
    ?? (!copyMatchesPickupReservation ? 'Este exemplar está reservado para outro atendimento.' : undefined)
    ?? (copyMatchesInput && copy && !copyAvailable && !pickupReservation ? 'Este exemplar não está disponível para empréstimo.' : undefined)
    ?? (copyMatchesInput && copyQuery.isError ? 'Exemplar não encontrado. Verifique o código e tente novamente.' : undefined)
  const userError = userInputError ?? (userMatchesInput && (userQuery.isError || (!!user && !reader)) ? 'Leitor não encontrado. Verifique o CPF e tente novamente.' : undefined)

  const returnKind = returnLookupKind(returnLookup)
  const returnValue = returnKind === 'user' ? onlyDigits(returnLookup) : returnLookup.trim()
  const returnSearchMatchesInput = !!returnSearch && returnSearch.kind === returnKind && returnSearch.value === returnValue
  const returnCopyQuery = useQuery({
    queryKey: ['loan-return-copy', returnSearch?.kind === 'copy' ? returnSearch.value : '', returnSchoolId],
    enabled: operation === 'return' && returnSearchMatchesInput && returnSearch?.kind === 'copy',
    retry: false,
    queryFn: async (): Promise<ReturnCopySearchResult> => {
      const { data } = await api.get<Paginated<Copy>>('/copies/', { params: { internal_code: returnSearch?.value, size: 100, ...(returnSchoolId ? { school_id: returnSchoolId } : {}) } })
      if (data.total === 0) throw new Error('Exemplar não encontrado para o código informado.')
      if (data.total > 1) return { kind: 'ambiguous', copies: data.items }
      const { data: loansData } = await api.get<Paginated<Loan>>('/loans/', { params: { copy_id: data.items[0].id, situation: 'borrowed', size: 100 } })
      const loan = loansData.items[0]
      if (!loan) throw new Error('Não há empréstimo ativo para este exemplar.')
      return { kind: 'copy', loan }
    },
  })
  const returnUserQuery = useQuery({
    queryKey: ['loan-return-user', returnSearch?.kind === 'user' ? returnSearch.value : ''],
    enabled: operation === 'return' && returnSearchMatchesInput && returnSearch?.kind === 'user',
    retry: false,
    queryFn: async (): Promise<ReturnSearchResult> => {
      const { data: userData } = await api.get<Paginated<User>>('/users/', { params: { cpf: returnSearch?.value, size: 1 } })
      if (userData.total === 0) throw new Error('Usuário não encontrado para o CPF informado.')
      const user = userData.items[0]
      const firstPage = await api.get<Paginated<Loan>>('/loans/', { params: { user_id: user.id, situation: 'borrowed', page: 1, size: 100 } })
      const pages = await Promise.all(Array.from({ length: Math.max(0, firstPage.data.pages - 1) }, (_, index) => api.get<Paginated<Loan>>('/loans/', { params: { user_id: user.id, situation: 'borrowed', page: index + 2, size: 100 } })))
      return { kind: 'user', user, loans: [firstPage.data, ...pages.map((response) => response.data)].flatMap((page) => page.items) }
    },
  })

  const returnCopyResult = returnSearchMatchesInput && returnCopyQuery.data?.kind === 'copy' ? returnCopyQuery.data : undefined
  const returnCopyAmbiguous = returnSearchMatchesInput && returnCopyQuery.data?.kind === 'ambiguous' ? returnCopyQuery.data : undefined
  const returnUserResult = returnSearchMatchesInput && returnUserQuery.data?.kind === 'user' ? returnUserQuery.data : undefined
  const returnResult = returnKind === 'copy' ? returnCopyResult : returnKind === 'user' ? returnUserResult : undefined
  const returnQuery = returnKind === 'copy' ? returnCopyQuery : returnUserQuery
  const returnError = returnInputError ?? (returnSearchMatchesInput && returnQuery.isError ? getErrorMessage(returnQuery.error, 'Não foi possível localizar o empréstimo.') : undefined)

  useEffect(() => {
    if (operation !== 'borrow' || copyQuery.isFetching || !copyMatchesInput) return
    const shouldRestoreFocus = focusCodeAfterLookup.current || focusCpfAfterLookup.current
    const invalidCopy = copyQuery.isError || !copy || !copyBelongsToSelectedBook || !copyEligible
    if (!invalidCopy) return
    const message = !copyBelongsToSelectedBook
      ? 'O exemplar informado não pertence ao livro selecionado. Verifique o código e tente novamente.'
      : !copy || copyQuery.isError
        ? 'Exemplar não encontrado. Verifique o código e tente novamente.'
        : pickupReservation ? `Este não é o exemplar reservado para retirada. Identifique o exemplar correto.` : `Exemplar ${copy.code} não está disponível para empréstimo. Verifique o código e tente novamente.`
    const key = `error:${copyLookupCode}:${message}`
    if (announcedCopyKey.current !== key) {
      announcedCopyKey.current = key
      announce(message, 'assertive')
    }
    if (shouldRestoreFocus) {
      focusCodeAfterLookup.current = false
      focusCpfAfterLookup.current = false
      window.setTimeout(() => codeRef.current?.focus(), 150)
    }
  }, [announce, copy, copyEligible, copyBelongsToSelectedBook, copyLookupCode, copyMatchesInput, copyQuery.isError, copyQuery.isFetching, operation, pickupReservation])

  useEffect(() => {
    if (operation !== 'borrow' || !copy || copyQuery.isFetching || copyQuery.isError || !copyEligible || !copyBelongsToSelectedBook) return
    const key = `${copyLookupCode}:${copy.state}`
    if (announcedCopyKey.current === key) return
    announcedCopyKey.current = key
    announce(`Livro ${copy.book.title}, exemplar ${copy.code}, identificado.`, 'polite')
    if (focusCpfAfterLookup.current && !pickupReservation) {
      focusCpfAfterLookup.current = false
      window.setTimeout(() => cpfRef.current?.focus(), 150)
    } else if (focusCpfAfterLookup.current && pickupReservation && canCreate) {
      focusCpfAfterLookup.current = false
      window.setTimeout(() => confirmLoanRef.current?.focus(), 150)
    }
  }, [announce, canCreate, copy, copyEligible, copyBelongsToSelectedBook, copyLookupCode, copyQuery.isError, copyQuery.isFetching, operation, pickupReservation])

  useEffect(() => {
    if (operation !== 'borrow' || userQuery.isFetching || !userMatchesInput) return
    if (!reader || userQuery.isError) {
      const key = `error:${userLookupCpf}`
      if (announcedUserKey.current !== key) {
        announcedUserKey.current = key
        announce('Leitor não encontrado. Verifique o CPF e tente novamente.', 'assertive')
      }
      if (focusCodeAfterLookup.current) {
        focusCodeAfterLookup.current = false
        window.setTimeout(() => cpfRef.current?.focus(), 150)
      }
      return
    }
    const key = `${userLookupCpf}:${reader.is_active}`
    if (announcedUserKey.current === key) return
    announcedUserKey.current = key
    const schoolInfo = reader.turma_numero && reader.turma_letra
      ? `${roleLabel(reader.role)}, ${reader.turma_numero}º ${reader.turma_letra}.`
      : `${roleLabel(reader.role)}.`
    const eligibility = !reader.is_active
      ? ' Existe um impedimento: leitor inativo. Empréstimo não permitido.'
      : ' Nenhuma pendência impeditiva. Empréstimo permitido.'
    announce(`Leitor ${reader.username} encontrado. ${schoolInfo}${eligibility}`, 'polite')
    if (userEligible && focusConfirmAfterLookup.current) {
      focusConfirmAfterLookup.current = false
      window.setTimeout(() => setLoanConfirmationOpen(true), 150)
    }
  }, [announce, operation, reader, userEligible, userLookupCpf, userMatchesInput, userQuery.isError, userQuery.isFetching])

  const identifyCopy = (moveFocus = false) => {
    const code = internalCode.trim()
    setCopyInputError(undefined)
    setUserLookupCpf('')
    setUserInputError(undefined)
    if (!code) {
      const message = 'Informe o código interno do exemplar.'
      setCopyInputError(message)
      announce(message, 'assertive')
      window.setTimeout(() => codeRef.current?.focus(), 150)
      return
    }
    announcedCopyKey.current = null
    focusCodeAfterLookup.current = moveFocus
    focusCpfAfterLookup.current = moveFocus
    if (code === copyLookupCode) void copyQuery.refetch()
    else setCopyLookupCode(code)
  }

  const selectCopyFromList = (selected: Copy) => {
    setInternalCode(selected.code)
    setCopyLookupCode(selected.code)
    setCopySchoolId(isSuperAdmin ? String(selected.school_id) : '')
    setCopyInputError(undefined)
    setUserLookupCpf('')
    setUserInputError(undefined)
    announcedCopyKey.current = null
    focusCpfAfterLookup.current = true
  }

  const identifyUser = () => {
    setUserInputError(undefined)
    if (!copy || !copyEligible || !copyBelongsToSelectedBook) {
      const message = 'Identifique um exemplar disponível antes de informar o CPF do leitor.'
      setUserInputError(message)
      announce(message, 'assertive')
      window.setTimeout(() => codeRef.current?.focus(), 150)
      return
    }
    if (!validateCpfDigits(cpf)) {
      const message = 'Informe um CPF válido com 11 dígitos.'
      setUserInputError(message)
      announce(message, 'assertive')
      window.setTimeout(() => cpfRef.current?.focus(), 150)
      return
    }
    announcedUserKey.current = null
    focusCodeAfterLookup.current = true
    focusConfirmAfterLookup.current = true
    if (cpf === userLookupCpf) void userQuery.refetch()
    else setUserLookupCpf(cpf)
  }

  const closeLoanConfirmation = () => {
    setLoanConfirmationOpen(false)
    setLoanConfirmationError(null)
    window.requestAnimationFrame(() => confirmLoanRef.current?.focus())
  }

  useEffect(() => {
    if (!loanConfirmationOpen) return
    acceptLoanConfirmationRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeLoanConfirmation()
        return
      }
      if (event.key !== 'Tab') return
      const first = cancelLoanConfirmationRef.current
      const last = acceptLoanConfirmationRef.current
      if (!first || !last) return
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [loanConfirmationOpen])

  const createMut = useMutation({
    mutationFn: async () => (await api.post<Loan>('/loans/', pickupReservation
      ? { internal_code: internalCode.trim(), reservation_id: pickupReservation.id }
      : { internal_code: internalCode.trim(), cpf, ...(borrowSchoolId ? { school_id: Number(borrowSchoolId) } : {}) })).data,
    onSuccess: async (loan) => {
      const message = `Empréstimo realizado com sucesso. Livro ${loan.book_title}, exemplar ${loan.internal_code}, emprestado para ${loan.borrower_username}.`
      setLoanConfirmationOpen(false)
      setLoanConfirmationError(null)
      setLoanSuccessMessage(message)
      await announce(message, 'polite')
      setInternalCode(''); setCpf(''); setCopyLookupCode(''); setUserLookupCpf('')
      setCopySchoolId(''); setCopyInputError(undefined); setUserInputError(undefined)
      announcedCopyKey.current = null
      announcedUserKey.current = null
      qc.invalidateQueries({ queryKey: ['loans'] }); qc.invalidateQueries({ queryKey: ['copies'] }); qc.invalidateQueries({ queryKey: ['books'] })
      codeRef.current?.focus()
    },
    onError: async (error: unknown) => {
      const loanError = getLoanCreationError(error)
      if (loanError.field === 'copy') {
        setLoanConfirmationOpen(false)
        setLoanConfirmationError(null)
        setCopyInputError(loanError.detail)
        await announce(loanError.announcement, 'assertive')
        codeRef.current?.focus()
        return
      }
      if (loanError.field === 'user') {
        setLoanConfirmationOpen(false)
        setLoanConfirmationError(null)
        setUserInputError(loanError.detail)
        await announce(loanError.announcement, 'assertive')
        cpfRef.current?.focus()
        return
      }

      setLoanConfirmationError(loanError.detail)
      await announce(loanError.announcement, 'assertive')
      acceptLoanConfirmationRef.current?.focus()
    },
  })

  const returnMut = useMutation({
    mutationFn: async ({ id }: ReturnRequest) => (await api.post<Loan>(`/loans/${id}/return`)).data,
    onSuccess: (loan, request) => {
      announce(`Devolução concluída. Atraso: ${loan.late_days} dia(s).`, 'polite')
      qc.setQueriesData<Paginated<Loan>>({ queryKey: ['loans'] }, (current) => {
        if (!current) return current
        return {
          ...current,
          items: current.items.map((item) => item.id === loan.id ? loan : item),
        }
      })
      qc.invalidateQueries({ queryKey: ['loans'] }); qc.invalidateQueries({ queryKey: ['copies'] }); qc.invalidateQueries({ queryKey: ['books'] })
      if (request.source === 'copy') {
        setReturnLookup(''); setReturnSearch(null); setReturnInputError(undefined)
        window.setTimeout(() => returnLookupRef.current?.focus(), 0)
      } else if (request.source === 'user') {
        focusReturnAfterId.current = loan.id
      }
    },
    onError: async (error: unknown) => {
      const status = (error as { response?: { status?: number } })?.response?.status
      if (status === 409) {
        await qc.invalidateQueries({ queryKey: ['loans'] })
        announce('Este empréstimo já foi devolvido. A lista foi atualizada.', 'polite')
        return
      }
      announce(getErrorMessage(error, 'Erro ao concluir a devolução.'), 'assertive')
    },
  })

  const returningLoanId = returnMut.isPending ? returnMut.variables?.id : undefined

  useEffect(() => {
    if (operation !== 'return' || returnKind !== 'user' || returnUserQuery.isFetching || focusReturnAfterId.current === null || !returnUserQuery.data || returnUserQuery.data.kind !== 'user') return
    const returnedId = focusReturnAfterId.current
    const nextLoan = returnUserQuery.data.loans.find((loan) => loan.id !== returnedId)
    focusReturnAfterId.current = null
    window.setTimeout(() => {
      if (nextLoan) document.querySelector<HTMLButtonElement>(`button[data-return-loan-id="${nextLoan.id}"]`)?.focus()
      else returnLookupRef.current?.focus()
    }, 0)
  }, [operation, returnKind, returnUserQuery.data, returnUserQuery.isFetching])

  const identifyReturn = () => {
    const value = returnLookup.trim()
    const kind = returnLookupKind(value)
    setReturnInputError(undefined)
    if (!kind) { setReturnInputError('Informe o código interno do exemplar ou o CPF do leitor.'); return }
    if (kind === 'user' && !validateCpfDigits(onlyDigits(value))) { setReturnInputError('Informe um CPF válido com 11 dígitos.'); return }
    setReturnSearch({ kind, value: kind === 'user' ? onlyDigits(value) : value })
  }

  useEffect(() => {
    const cpfDigits = onlyDigits(returnLookup)
    if (operation !== 'return' || returnKind !== 'user' || !validateCpfDigits(cpfDigits) || (returnSearch?.kind === 'user' && returnSearch.value === cpfDigits)) return
    const timer = window.setTimeout(() => { setReturnInputError(undefined); setReturnSearch({ kind: 'user', value: cpfDigits }) }, 350)
    return () => window.clearTimeout(timer)
  }, [operation, returnKind, returnLookup, returnSearch])

  useEffect(() => {
    const code = returnLookup.trim()
    if (operation !== 'return' || returnKind !== 'copy' || !code || (returnSearch?.kind === 'copy' && returnSearch.value === code)) return
    const timer = window.setTimeout(() => { setReturnInputError(undefined); setReturnSearch({ kind: 'copy', value: code }) }, 350)
    return () => window.clearTimeout(timer)
  }, [operation, returnKind, returnLookup, returnSearch])

  useEffect(() => {
    if (operation !== 'return' || returnQuery.isFetching) return
    if (returnCopyResult) {
      const { loan } = returnCopyResult
      const lateDays = loanLateDays(loan.due_date)
      const key = `copy:${loan.id}`
      if (announcedReturnKey.current === key) return
      announcedReturnKey.current = key
      const situation = lateDays > 0 ? `Atrasado ${lateDays} dia(s).` : 'No prazo.'
      announce(`Empréstimo identificado: ${loan.book_title}. Exemplar ${loan.internal_code}. Leitor ${loan.borrower_username}. ${situation} A devolução pode ser confirmada.`, 'polite')
      return
    }
    if (!returnUserResult) return
    const key = `user:${returnUserResult.user.id}:${returnUserResult.loans.map((loan) => loan.id).join(',')}`
    if (announcedReturnKey.current === key) return
    announcedReturnKey.current = key
    const count = returnUserResult.loans.length
    const result = count === 0
      ? 'Este leitor não possui empréstimos ativos.'
      : `${count} empréstimo${count === 1 ? '' : 's'} ativo${count === 1 ? '' : 's'}. Use o botão Devolver de cada livro.`
    announce(`Leitor identificado: ${returnUserResult.user.username}. ${result}`, 'polite')
  }, [announce, operation, returnCopyResult, returnQuery.isFetching, returnUserResult])

  const handleReturn = (request: ReturnRequest) => returnMut.mutate(request)

  return <div className="flex flex-col gap-6">
    <header><h1 className="text-2xl sm:text-3xl font-bold">Empréstimos</h1><PageDescription>Empreste e devolva livros com atendimento rápido no balcão.</PageDescription></header>
    {loanSuccessMessage && <div aria-hidden="true" className="fixed right-4 top-4 z-50 max-w-md rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-950 shadow-lg dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-100">{loanSuccessMessage}</div>}
    {isSuperAdmin && <p role="status" className="rounded-md border border-blue-200 bg-blue-50 p-4 text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100">Você está consultando os empréstimos em modo somente leitura. Apenas bibliotecários e administradores escolares podem emprestar ou devolver livros.</p>}

    {!isSuperAdmin && <Card><CardHeader>
      <h2 className="sr-only">Atendimento de empréstimos</h2>
      <div role="group" aria-label="Operação do atendimento" className="inline-flex gap-[calc(var(--text-sm)*0.3)] rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800">
        <Button type="button" size="sm" variant={operation === 'borrow' ? 'primary' : 'secondary'} aria-pressed={operation === 'borrow'} onClick={() => setOperation('borrow')} aria-label="Operação emprestar" className={`gap-1.5 ${operation === 'borrow' ? '' : 'hover:!bg-slate-100 dark:hover:!bg-slate-700'}`}>Emprestar</Button>
        <Button type="button" size="sm" variant={operation === 'return' ? 'primary' : 'secondary'} aria-pressed={operation === 'return'} onClick={() => setOperation('return')} aria-label="Operação devolver" className={`gap-1.5 ${operation === 'return' ? '' : 'hover:!bg-slate-100 dark:hover:!bg-slate-700'}`}>Devolver</Button>
      </div>
    </CardHeader><CardBody>
      {operation === 'borrow' ? <form onSubmit={(event) => { event.preventDefault(); if (!copy) { identifyCopy(false); return }; if (!reader) { identifyUser(); return }; if (canCreate) setLoanConfirmationOpen(true) }} className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start">
          <div className="flex-1 w-full"><Input ref={codeRef} id="loan-internal-code" label="Código interno do exemplar" value={internalCode} onChange={(event) => { setInternalCode(event.target.value); setCopyLookupCode(''); setCopySchoolId(''); setUserLookupCpf(''); setUserInputError(undefined) }} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); identifyCopy(true) } }} error={copyError} hint={pickupReservation ? `Exemplar esperado: ${pickupReservation.internal_code ?? 'código não informado'}. Escaneie ou digite o código e pressione Enter para confirmar.` : 'Escaneie ou digite o código e pressione Enter para avançar ao CPF.'} aria-describedby="copy-identification" required autoComplete="off" /></div>
          <div className="flex-1 w-full">{pickupReservation ? <Input id="loan-reserved-reader" label="Leitor da reserva" value={pickupReservation.reserver_username} readOnly tabIndex={-1} hint={`${roleLabel(pickupReservation.reserver_role)}. Leitor já identificado pela reserva; o CPF não precisa ser informado novamente.`} /> : <Input ref={cpfRef} id="loan-cpf" label="CPF do leitor" type="password" inputMode="numeric" value={formatCpfInput(cpf)} onChange={(event) => { setCpf(onlyDigits(event.target.value)); setUserLookupCpf(''); setUserInputError(undefined) }} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); identifyUser() } }} error={userError} hint="O CPF permanece oculto. Digite e pressione Enter para identificar o leitor." aria-describedby="user-identification" required autoComplete="off" placeholder="000.000.000-00" />}</div>
          <div className="flex w-full flex-col gap-1.5 sm:w-auto">
            <span className="invisible text-sm font-medium leading-5" aria-hidden="true">Ação</span>
            <Button ref={confirmLoanRef} type="submit" variant={canCreate ? 'primary' : 'secondary'} disabled={!canCreate || createMut.isPending} className="loan-confirmation-button w-full sm:w-auto" aria-describedby="loan-confirmation-status">{createMut.isPending ? 'Confirmando…' : 'Confirmar empréstimo'}</Button>
          </div>
        </div>
        {reservationId && reservationQuery.isError && <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-300">A reserva não está disponível para retirada.</p>}
        {preselectedBookId && <section aria-labelledby="selected-loan-book" className="rounded-lg border border-slate-200 bg-slate-100 p-3 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
          <h3 id="selected-loan-book" className="font-semibold">Livro selecionado</h3>
          {selectedBookQuery.isFetching && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Carregando livro…</p>}
          {selectedBookQuery.isError && <p className="mt-1 text-sm text-red-700 dark:text-red-300">Não foi possível carregar o livro selecionado.</p>}
          {selectedBookQuery.data && <>
            <p className="mt-1">{selectedBookQuery.data.title}</p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{pickupReservation ? `Exemplar reservado para retirada: ${pickupReservation.internal_code ?? 'código não informado'}. Confirme-o no campo acima.` : 'Selecione um exemplar disponível ou informe seu código no campo acima.'}</p>
            {selectedBookCopiesQuery.isFetching && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Carregando exemplares…</p>}
            {!selectedBookCopiesQuery.isFetching && selectedBookCopiesQuery.data?.items.length === 0 && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Este livro não possui exemplares cadastrados.</p>}
            {!selectedBookCopiesQuery.isFetching && selectedBookCopiesQuery.data && selectedBookCopiesQuery.data.items.length > 0 && <ul className="mt-3 grid gap-2 sm:grid-cols-2" aria-label={`Exemplares de ${selectedBookQuery.data.title}`}>
              {selectedBookCopiesQuery.data.items.map((item) => {
                const available = item.state === 'available'
                const itemStatus = item.state === 'reserved'
                  ? pickupReservation?.copy_id === item.id ? 'Reservado para esta retirada' : 'Reservado'
                  : bookStateLabel(item.state)
                return <li key={item.id} className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white p-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                  <div><p className="font-mono font-medium">{item.code}</p><p className="text-slate-600 dark:text-slate-300">{itemStatus} · {bookConditionLabel(item.condition)}</p>{isSuperAdmin && <p className="text-xs text-slate-500 dark:text-slate-400">Escola {item.school_id}</p>}</div>
                  {available ? <Button type="button" size="sm" variant="secondary" onClick={() => selectCopyFromList(item)} aria-label={`Emprestar exemplar ${item.code}`}>Emprestar</Button> : <span className="text-xs font-medium">{itemStatus === 'Reservado para esta retirada' || itemStatus === 'Reservado' ? itemStatus : 'Indisponível'}</span>}
                </li>
              })}
            </ul>}
          </>}
        </section>}
        <div className="grid gap-3 sm:grid-cols-2">
          <section id="copy-identification" aria-busy={copyQuery.isFetching} className="rounded-lg border border-slate-200 bg-slate-100 p-3 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"><h3 className="text-sm font-semibold">Exemplar identificado</h3>{copyQuery.isFetching && copyMatchesInput ? <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Buscando exemplar…</p> : copy ? <div className="mt-1 text-sm"><p className="font-medium">{copy.book.title}</p><p className="text-slate-600 dark:text-slate-300">Exemplar: <span className="font-mono">{copy.code}</span></p><Badge tone={bookStateTone(copy.state)} className="mt-2">{bookStateLabel(copy.state)}</Badge>{!copyAvailable && <p className="mt-2 font-medium text-red-700 dark:text-red-300">Este exemplar não está disponível para empréstimo.</p>}</div> : copyAmbiguous && isSuperAdmin ? <div className="mt-2"><p className="text-sm text-amber-800 dark:text-amber-200">Este código existe em mais de uma escola. Escolha uma para continuar.</p><div className="mt-3"><Autocomplete label="Escola do exemplar" id="loan-copy-school" value={copySchoolId} onChange={setCopySchoolId} options={schoolOptions} placeholder="Busque uma escola" renderOption={(option) => <SchoolSuggestion option={option} />} /></div></div> : <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Aguardando código do exemplar.</p>}</section>
          <section id="user-identification" aria-busy={userQuery.isFetching} className="rounded-lg border border-slate-200 bg-slate-100 p-3 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"><h3 className="text-sm font-semibold">Leitor identificado</h3>{userQuery.isFetching && userMatchesInput ? <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Buscando leitor…</p> : reader ? <div className="mt-1 text-sm"><p className="font-medium">{reader.username}</p><p className="text-slate-600 dark:text-slate-300">{roleLabel(reader.role)}{reader.turma_numero && reader.turma_letra ? ` — ${reader.turma_numero}º ${reader.turma_letra}` : ''}{reader.school_name ? ` · ${reader.school_name}` : ''}</p>{!reader.is_active ? <p className="mt-2 font-medium text-red-700 dark:text-red-300">Leitor inativo: não pode realizar empréstimos.</p> : <p className="mt-2 font-medium text-emerald-800 dark:text-emerald-200">Nenhum impedimento identificado para empréstimo.</p>}</div> : userMatchesInput && userError ? <p className="mt-1 text-sm font-medium text-red-700 dark:text-red-300">Leitor não encontrado. Verifique o CPF e tente novamente.</p> : <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Aguardando CPF do leitor.</p>}</section>
        </div>
        <p id="loan-confirmation-status" className={`text-sm ${canCreate ? 'font-medium text-emerald-800 dark:text-emerald-200' : 'text-slate-600 dark:text-slate-300'}`}>{canCreate ? 'Formulário pronto para confirmar o empréstimo.' : 'A confirmação ficará disponível após identificar um exemplar disponível e um leitor elegível.'}</p>
      </form> : <form onSubmit={(event) => { event.preventDefault(); if (returnKind === 'copy' && returnCopyResult) handleReturn({ id: returnCopyResult.loan.id, source: 'copy' }); else identifyReturn() }} className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="flex-1"><Input ref={returnLookupRef} id="return-lookup" label="Código interno do exemplar ou CPF do leitor" type={returnKind === 'user' ? 'password' : 'text'} inputMode={returnKind === 'user' ? 'numeric' : 'text'} value={returnKind === 'user' ? formatCpfInput(onlyDigits(returnLookup)) : returnLookup} onChange={(event) => { const value = event.target.value; setReturnLookup(/^\d/.test(value.trim()) ? onlyDigits(value) : value); setReturnSearch(null); setReturnSchoolId(''); setReturnInputError(undefined) }} onBlur={() => { if (returnKind === 'copy' && returnLookup.trim()) identifyReturn() }} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); identifyReturn() } }} error={returnError} hint="Escaneie um exemplar ou informe um CPF. Pressione Enter para localizar." aria-describedby="return-identification" required autoComplete="off" placeholder="EX-001 ou 000.000.000-00" /></div>
          {returnKind !== 'user' && <div className="flex w-full flex-col gap-1.5 sm:w-auto"><span className="invisible text-sm font-medium leading-5" aria-hidden="true">Ação</span><Button type="submit" disabled={returnMut.isPending || !returnResult} className="loan-confirmation-button w-full sm:w-auto" aria-busy={returnMut.isPending} aria-describedby="return-action-status" aria-label={returnCopyResult ? `${returnMut.isPending ? 'Processando devolução de' : 'Devolver'} ${returnCopyResult.loan.book_title}, exemplar ${returnCopyResult.loan.internal_code}` : 'Devolver empréstimo identificado'}>{returnMut.isPending ? 'Devolvendo…' : 'Devolver'}</Button></div>}
        </div>
        <section id="return-identification" aria-busy={returnQuery.isFetching} className="rounded-lg border border-slate-200 bg-slate-100 p-3 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
          <h3 className="text-sm font-semibold">Empréstimo identificado</h3>
          {returnQuery.isFetching && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Localizando empréstimo…</p>}
          {!returnQuery.isFetching && returnKind === 'copy' && returnCopyResult && <ReturnLoanSummary loan={returnCopyResult.loan} />}
          {!returnQuery.isFetching && returnKind === 'copy' && returnCopyAmbiguous && isSuperAdmin && <div className="mt-2"><p className="text-sm text-amber-800 dark:text-amber-200">Este código existe em mais de uma escola. Escolha uma para continuar.</p><div className="mt-3"><Autocomplete label="Escola do exemplar" id="return-copy-school" value={returnSchoolId} onChange={setReturnSchoolId} options={schoolOptions} placeholder="Busque uma escola" renderOption={(option) => <SchoolSuggestion option={option} />} /></div></div>}
          {!returnQuery.isFetching && returnKind === 'user' && returnUserQuery.data?.kind === 'user' && <div className="mt-1"><p className="font-medium">{returnUserQuery.data.user.username}</p><p className="text-sm text-slate-600 dark:text-slate-300">{roleLabel(returnUserQuery.data.user.role)}{returnUserQuery.data.user.turma_numero && returnUserQuery.data.user.turma_letra ? ` — ${returnUserQuery.data.user.turma_numero}º ${returnUserQuery.data.user.turma_letra}` : ''}</p><p className="mt-2 text-sm font-medium">{returnUserQuery.data.loans.length ? `${returnUserQuery.data.loans.length} empréstimo(s) ativo(s)` : 'Este leitor não possui empréstimos ativos.'}</p>{returnUserQuery.data.loans.length > 0 && <ul className="mt-3 divide-y divide-slate-200 dark:divide-slate-700" role="list">{returnUserQuery.data.loans.map((loan) => { const isReturning = returningLoanId === loan.id; return <li key={loan.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"><div className="text-sm"><p className="font-medium">{loan.book_title}</p><p className="font-mono text-slate-600 dark:text-slate-300">{loan.internal_code}</p><p className={loanLateDays(loan.due_date) > 0 ? 'text-red-700 dark:text-red-300' : 'text-slate-600 dark:text-slate-300'}>{loanLateDays(loan.due_date) > 0 ? `Atrasado ${loanLateDays(loan.due_date)} dia(s)` : `Vence em ${formatDate(loan.due_date)}`}</p></div><Button type="button" size="sm" variant="secondary" onClick={() => handleReturn({ id: loan.id, source: 'user' })} disabled={returnMut.isPending} aria-busy={isReturning} aria-label={`${isReturning ? 'Processando devolução de' : 'Devolver'} ${loan.book_title}, exemplar ${loan.internal_code}`} data-return-loan-id={loan.id}>{isReturning ? 'Processando…' : 'Devolver'}</Button></li>})}</ul>}</div>}
          {!returnQuery.isFetching && !returnError && !returnResult && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Aguardando código do exemplar ou CPF do leitor.</p>}
        </section>
        <p id="return-action-status" className="sr-only">{returnKind === 'copy' && returnCopyResult ? 'Empréstimo localizado. A devolução pode ser confirmada.' : returnKind === 'user' && returnUserResult?.loans.length ? 'Selecione o livro que será devolvido.' : 'A devolução ficará disponível após localizar um empréstimo ativo.'}</p>
      </form>}
    </CardBody></Card>}

    {loanConfirmationOpen && copy && reader && <ModalDialog title="Confirmar empréstimo?" onClose={closeLoanConfirmation} describedBy="loan-final-confirmation-description">
        <p id="loan-final-confirmation-description" className="mt-2 text-sm text-slate-600 dark:text-slate-300">Revise os dados antes de concluir o empréstimo.</p>
        <dl className="mt-4 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-900">
          <div><dt className="font-medium">Livro</dt><dd>{copy.book.title}</dd></div>
          <div><dt className="font-medium">Exemplar</dt><dd className="font-mono">{copy.code}</dd></div>
          <div><dt className="font-medium">Leitor</dt><dd>{reader.username}</dd></div>
        </dl>
        {loanConfirmationError && <p aria-hidden="true" className="mt-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm font-medium text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100">{loanConfirmationError}</p>}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button ref={cancelLoanConfirmationRef} type="button" variant="secondary" className="hover:!bg-slate-200 hover:!text-slate-900 dark:hover:!bg-slate-600 dark:hover:!text-white" onClick={closeLoanConfirmation} aria-label="Cancelar confirmação do empréstimo">Cancelar</Button>
          <Button ref={acceptLoanConfirmationRef} type="button" disabled={createMut.isPending} aria-busy={createMut.isPending} onClick={() => { setLoanConfirmationError(null); createMut.mutate() }} aria-label="Confirmar empréstimo">{createMut.isPending ? 'Confirmando…' : 'Confirmar empréstimo'}</Button>
        </div>
    </ModalDialog>}

    {loans && <LoansList loans={loans} pageSize={pageSize} setPageSize={setPageSize} setPage={setPage} situation={situation} setSituation={(value) => { setSituation(value); setPage(1) }} navigate={navigate} onReturn={handleReturn} returnPending={returnMut.isPending} returningLoanId={returningLoanId} readOnly={isSuperAdmin} />}
  </div>
}

function ReturnLoanSummary({ loan }: { loan: Loan }) {
  const lateDays = loanLateDays(loan.due_date)
  return <div className="mt-1 text-sm"><p className="font-medium">{loan.book_title}</p><p className="font-mono text-slate-600 dark:text-slate-300">Exemplar: {loan.internal_code}</p><p className="mt-2">Leitor: <span className="font-medium">{loan.borrower_username}</span></p><p className="text-slate-600 dark:text-slate-300">Retirada: {formatDate(loan.borrowed_at)} · Vencimento: {formatDate(loan.due_date)}</p><p className={`mt-2 font-medium ${lateDays > 0 ? 'text-red-700 dark:text-red-300' : 'text-emerald-800 dark:text-emerald-200'}`}>{lateDays > 0 ? `Atrasado ${lateDays} dia(s)` : 'No prazo'}</p></div>
}

function LoansList({ loans, pageSize, setPageSize, setPage, situation, setSituation, navigate, onReturn, returnPending, returningLoanId, readOnly = false }: { loans: Paginated<Loan>; pageSize: number; setPageSize: (size: number) => void; setPage: (page: number) => void; situation: LoanSituation; setSituation: (value: LoanSituation) => void; navigate: ReturnType<typeof useNavigate>; onReturn: (request: ReturnRequest) => void; returnPending: boolean; returningLoanId?: number; readOnly?: boolean }) {
  const [filterMenuOpen, setFilterMenuOpen] = useState(false)
  const filterWrapperRef = useRef<HTMLDivElement>(null)
  const hasActiveFilter = situation !== ''
  const situationOptions = [
    { value: '', label: 'Todos' },
    { value: 'borrowed', label: 'Emprestados' },
    { value: 'overdue', label: 'Atrasados' },
    { value: 'due_soon', label: 'Vencem em até 3 dias' },
    { value: 'returned', label: 'Devolvidos' },
  ]

  useEffect(() => {
    if (!filterMenuOpen) return
    const onDown = (event: MouseEvent) => {
      if (filterWrapperRef.current && !filterWrapperRef.current.contains(event.target as Node)) setFilterMenuOpen(false)
    }
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setFilterMenuOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [filterMenuOpen])

  return <section aria-labelledby="loans-list-heading" className={`flex flex-col gap-6 ${readOnly ? 'opacity-60' : ''}`}>
    <h2 id="loans-list-heading" className="sr-only">Lista de empréstimos</h2>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-slate-600 dark:text-slate-400" aria-live="polite">{loans.total} {loans.total === 1 ? 'empréstimo encontrado' : 'empréstimos encontrados'}</p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">Itens por página<select value={String(pageSize)} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1) }} className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm min-h-[36px] focus-visible:outline-2 focus-visible:outline-[var(--color-focus)]"><option value="10">10</option><option value="20">20</option><option value="30">30</option><option value="50">50</option></select></label>
        <div ref={filterWrapperRef} className="relative">
          <Button type="button" variant={hasActiveFilter ? 'primary' : 'secondary'} onClick={() => setFilterMenuOpen((open) => !open)} aria-haspopup="menu" aria-expanded={filterMenuOpen} aria-controls="loan-filter-menu" aria-label="Filtros" className={`w-full gap-2 sm:w-auto ${hasActiveFilter ? '' : 'hover:!bg-slate-100 dark:hover:!bg-slate-700'}`}><Funnel className="h-4 w-4" aria-hidden="true" /> Filtros {hasActiveFilter && <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-xs font-bold text-blue-600" aria-hidden="true">1</span>}</Button>
          {filterMenuOpen && <div id="loan-filter-menu" role="menu" aria-label="Opções de filtro" className="absolute right-0 top-full z-30 mt-2 flex w-80 max-w-[90vw] flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-800">
            <Select label="Situação" id="loan-situation-filter" value={situation} onChange={(value) => { setSituation(value as LoanSituation); setPage(1) }} options={situationOptions} />
            <div className="flex justify-between gap-2 border-t border-slate-200 pt-3 dark:border-slate-700"><Button type="button" variant="secondary" onClick={() => { setSituation(''); setPage(1) }} className="hover:!bg-slate-100 dark:hover:!bg-slate-700">Limpar filtros</Button><Button type="button" onClick={() => setFilterMenuOpen(false)}>Aplicar</Button></div>
          </div>}
        </div>
      </div>
    </div>
    {hasActiveFilter && <div className="flex flex-wrap gap-2"><Badge tone="neutral">Situação: {situationOptions.find((option) => option.value === situation)?.label}</Badge><Button type="button" variant="secondary" size="sm" onClick={() => { setSituation(''); setPage(1) }} className="hover:!bg-slate-100 dark:hover:!bg-slate-700">Limpar filtro</Button></div>}
    <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 md:block"><table className="w-full text-sm"><caption className="sr-only">Empréstimos ativos e histórico</caption><thead className="bg-slate-50 dark:bg-slate-700/50"><tr><th scope="col" className="px-4 py-3 text-left font-semibold">Livro</th><th scope="col" className="px-4 py-3 text-left font-semibold">Código interno</th><th scope="col" className="px-4 py-3 text-left font-semibold">Leitor</th><th scope="col" className="px-4 py-3 text-left font-semibold">Status</th><th scope="col" className="px-4 py-3 text-left font-semibold">Retirada</th><th scope="col" className="px-4 py-3 text-left font-semibold">Vencimento / devolução</th>{!readOnly && <th scope="col" className="px-4 py-3 text-left font-semibold">Ações</th>}</tr></thead><tbody className="divide-y divide-slate-200 dark:divide-slate-700">{loans.items.map((loan) => <LoanRow key={loan.id} loan={loan} navigate={navigate} onReturn={onReturn} returnPending={returnPending} returningLoanId={returningLoanId} readOnly={readOnly} />)}</tbody></table></div>
    <ul className="grid gap-3 md:hidden" role="list">{loans.items.map((loan) => <LoanCard key={loan.id} loan={loan} navigate={navigate} onReturn={onReturn} returnPending={returnPending} returningLoanId={returningLoanId} readOnly={readOnly} />)}</ul>
    <Pagination page={loans.page} pages={loans.pages} total={loans.total} onChange={setPage} />
  </section>
}

function LoanRow({ loan, navigate, onReturn, returnPending, returningLoanId, readOnly = false }: { loan: Loan; navigate: ReturnType<typeof useNavigate>; onReturn: (request: ReturnRequest) => void; returnPending: boolean; returningLoanId?: number; readOnly?: boolean }) {
  const displayStatus = loanDisplayStatus(loan)
  const lateDays = loanDisplayLateDays(loan)
  const isReturning = returningLoanId === loan.id
  return <tr onClick={() => navigate(`/acervo/${loan.book_id}`)} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/30"><td className="px-4 py-3"><Link to={`/acervo/${loan.book_id}`} onClick={(event) => event.stopPropagation()} aria-label={`Abrir detalhes de ${loan.book_title}`} className="flex min-w-[220px] items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-[var(--color-focus)] focus-visible:outline-offset-2"><CoverImage src={loan.book_cover_url} title={loan.book_title} alt="" width={48} height={72} className="h-14 w-10 shrink-0 rounded-md border border-slate-200 dark:border-slate-600" sizes="40px" /><span className="font-medium">{loan.book_title}</span></Link></td><td className="px-4 py-3 font-mono">{loan.internal_code}</td><td className="px-4 py-3"><div>{loan.borrower_username}</div><div className="text-xs text-slate-500">{loan.borrower_cpf_masked ?? 'CPF não informado'}</div></td><td className="px-4 py-3"><Badge tone={statusTone(displayStatus)}>{statusLabel(displayStatus)}</Badge>{lateDays > 0 && <span className="ml-2 text-xs text-red-600">+{lateDays}d</span>}</td><td className="px-4 py-3 text-xs">{formatDate(loan.borrowed_at)}</td><td className="px-4 py-3 text-xs"><div>{formatDate(loan.due_date)}</div>{loan.returned_at && <div className="text-slate-500">Devolvido: {formatDate(loan.returned_at)}</div>}</td>{!readOnly && <td className="px-4 py-3">{loan.status !== 'returned' && <Button size="sm" variant="secondary" onClick={(event) => { event.stopPropagation(); onReturn({ id: loan.id, source: 'table' }) }} disabled={returnPending} aria-busy={isReturning} aria-label={`${isReturning ? 'Processando devolução de' : 'Devolver'} ${loan.book_title}, exemplar ${loan.internal_code}`}>{isReturning ? 'Processando…' : 'Devolver'}</Button>}</td>}</tr>
}

function LoanCard({ loan, navigate, onReturn, returnPending, returningLoanId, readOnly = false }: { loan: Loan; navigate: ReturnType<typeof useNavigate>; onReturn: (request: ReturnRequest) => void; returnPending: boolean; returningLoanId?: number; readOnly?: boolean }) {
  const displayStatus = loanDisplayStatus(loan)
  const lateDays = loanDisplayLateDays(loan)
  const isReturning = returningLoanId === loan.id
  return <li onClick={() => navigate(`/acervo/${loan.book_id}`)} className="cursor-pointer rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"><div className="flex items-start justify-between"><Link to={`/acervo/${loan.book_id}`} onClick={(event) => event.stopPropagation()} aria-label={`Abrir detalhes de ${loan.book_title}`} className="flex min-w-0 items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-[var(--color-focus)] focus-visible:outline-offset-2"><CoverImage src={loan.book_cover_url} title={loan.book_title} alt="" width={48} height={72} className="h-14 w-10 shrink-0 rounded-md border border-slate-200 dark:border-slate-600" sizes="40px" /><h3 className="truncate font-semibold">{loan.book_title}</h3></Link><Badge tone={statusTone(displayStatus)}>{statusLabel(displayStatus)}</Badge></div><p className="mt-1 text-sm text-slate-500">Exemplar <span className="font-mono">{loan.internal_code}</span> → {loan.borrower_username} ({loan.borrower_cpf_masked ?? 'CPF não informado'})</p><p className="text-xs text-slate-500">Retirada: {formatDate(loan.borrowed_at)} · Vencimento: {formatDate(loan.due_date)}{lateDays > 0 && ` · Atrasado ${lateDays} dia(s)`}</p>{!readOnly && loan.status !== 'returned' && <Button size="sm" variant="secondary" className="mt-3 w-full" onClick={(event) => { event.stopPropagation(); onReturn({ id: loan.id, source: 'table' }) }} disabled={returnPending} aria-busy={isReturning} aria-label={`${isReturning ? 'Processando devolução de' : 'Devolver'} ${loan.book_title}, exemplar ${loan.internal_code}`}>{isReturning ? 'Processando…' : 'Devolver'}</Button>}</li>
}
