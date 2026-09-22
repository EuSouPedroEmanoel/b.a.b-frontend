import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Funnel, ShieldCheck, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { ButtonLink } from '@/components/ui/ButtonLink'
import { Card, CardBody } from '@/components/ui/Card'
import { PageDescription } from '@/components/ui/PageDescription'
import { GridCard } from '@/features/books/GridCard'
import { responsiveBookGridClasses } from '@/features/books/bookGrid'
import { useAuth } from '@/hooks/useAuth'
import api from '@/lib/api'
import { Pagination } from '@/components/ui/Pagination'
import { Select } from '@/components/ui/Select'
import { segmentedControlContainerClasses, segmentedControlItemClasses } from '@/components/ui/SegmentedControl'
import { readingStatusLabel, readingStatusOptions, type ReadingStatus } from '@/features/reading/readingStatus'

type Paginated<T> = { items: T[]; total: number; page: number; size: number; pages: number }
type CatalogBook = { id: number; title: string; description: string | null; derived_state: string; isbn: string | null; cover_url: string | null; published_date: string | null; reading_status?: ReadingStatus | null; genres: { id: number; name: string; slug: string }[]; authors: { id: number; name: string; slug: string }[] }
type ReadingSortBy = 'created_at' | 'published_date' | 'title' | 'author'
type ReadingSortOrder = 'asc' | 'desc'
type Activity = { id: string; occurred_at: string; actor_display_name: string; actor_role: string; school_id: number | null; operation: string; entity_type: string; entity_id: string | null; summary: string; justification: string | null }

const accountRoleLabel = (role: string) => ({ student: 'Aluno', teacher: 'Professor', librarian: 'Bibliotecário', school_admin: 'Administrador escolar', super_admin: 'Superadministrador' }[role] ?? role)
export function AccountPage() {
  const { user } = useAuth()
  const isStudent = user?.role === 'student'
  const isActivityViewer = user?.role === 'super_admin' || user?.role === 'school_admin'
  if (!user) return null
  const displayName = user.name || user.username

  return <main className="flex min-w-0 flex-col gap-6">
    <header className="min-w-0"><h1 className="break-words text-2xl font-bold sm:text-3xl">Meu perfil</h1><p className="break-words text-lg font-medium">{displayName}</p><p className="text-sm text-slate-600 dark:text-slate-300">{accountRoleLabel(user.role)}</p></header>

    <section aria-labelledby="personal-information"><Card><CardBody>
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row"><div><h2 id="personal-information" className="flex items-center gap-2 text-lg font-semibold"><UserRound aria-hidden="true" className="h-5 w-5" /> Informações pessoais</h2><PageDescription>Dados usados para identificar seu acesso à biblioteca.</PageDescription></div><ButtonLink to={`/perfil/${user.id}#perfil`}>Editar perfil</ButtonLink></div>
      <dl className="mt-6 grid gap-4 sm:grid-cols-2"><ProfileField label="Nome" value={displayName} /><ProfileField label="Nome de usuário" value={user.username} /><ProfileField label="Perfil de acesso" value={accountRoleLabel(user.role)} />{user.birthdate && <ProfileField label="Data de nascimento" value={new Intl.DateTimeFormat('pt-BR').format(new Date(`${user.birthdate}T12:00:00`))} />}{user.turma_numero && user.turma_letra && <ProfileField label="Turma" value={`${user.turma_numero}º ${user.turma_letra}`} />}</dl>
    </CardBody></Card></section>

    <section aria-labelledby="security-heading"><Card><CardBody className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center"><div><h2 id="security-heading" className="flex items-center gap-2 text-lg font-semibold"><ShieldCheck aria-hidden="true" className="h-5 w-5" /> Segurança</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Mantenha sua conta protegida com uma senha segura.</p></div><ButtonLink to={`/perfil/${user.id}#senha`} variant="secondary">Alterar senha</ButtonLink></CardBody></Card></section>

    {isStudent && <ReadingSection />}
    {isActivityViewer && <AdministrativeActivitySection isSuperAdmin={user.role === 'super_admin'} />}
  </main>
}

function AdministrativeActivitySection({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [page, setPage] = useState(1)
  const [entityType, setEntityType] = useState('')
  const [operation, setOperation] = useState('')
  const query = useQuery({
    queryKey: ['administrative-activities', page, entityType, operation],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), size: '10' })
      if (entityType) params.set('entity_type', entityType)
      if (operation) params.set('operation', operation)
      return (await api.get<Paginated<Activity>>(`/administrative-activities/?${params.toString()}`)).data
    },
  })
  const resetFilters = () => { setEntityType(''); setOperation(''); setPage(1) }
  return <section aria-labelledby="activity-log-heading">
    <Card><CardBody>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h2 id="activity-log-heading" className="flex items-center gap-2 text-xl font-semibold">Registro de atividades</h2><PageDescription>Alterações administrativas relacionadas ao seu escopo de acesso.</PageDescription></div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <Select label="Categoria" id="activity-entity-filter" value={entityType} onChange={(value) => { setEntityType(value); setPage(1) }} options={[{ value: '', label: 'Todas' }, { value: 'book', label: 'Livros' }, { value: 'copy', label: 'Exemplares' }, { value: 'user', label: 'Usuários' }, { value: 'loan', label: 'Empréstimos' }]} />
          <Select label="Operação" id="activity-operation-filter" value={operation} onChange={(value) => { setOperation(value); setPage(1) }} options={[{ value: '', label: 'Todas' }, { value: 'created', label: 'Cadastro' }, { value: 'updated', label: 'Edição' }, { value: 'returned', label: 'Devolução' }, { value: 'deactivated', label: 'Desativação' }, { value: 'restored', label: 'Restauração' }]} />
          {(entityType || operation) && <Button type="button" variant="secondary" onClick={resetFilters}>Limpar</Button>}
        </div>
      </div>
      {query.isLoading && <p role="status" className="py-8 text-center text-sm text-slate-500">Carregando atividades…</p>}
      {query.isError && <p role="alert" className="mt-6 rounded-md border border-red-200 p-4 text-sm text-red-800">Não foi possível carregar o registro de atividades.</p>}
      {query.data && query.data.items.length === 0 && <p className="mt-6 rounded-md border border-slate-200 p-4 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">Nenhuma atividade encontrada.</p>}
      {query.data && query.data.items.length > 0 && <>
        <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="w-full min-w-[42rem] text-sm"><caption className="sr-only">Atividades administrativas</caption><thead className="bg-slate-50 dark:bg-slate-700/50"><tr><th scope="col" className="px-4 py-3 text-left">Data e hora</th><th scope="col" className="px-4 py-3 text-left">Responsável</th><th scope="col" className="px-4 py-3 text-left">Categoria</th><th scope="col" className="px-4 py-3 text-left">Operação</th><th scope="col" className="px-4 py-3 text-left">Descrição</th></tr></thead><tbody className="divide-y divide-slate-200 dark:divide-slate-700">{query.data.items.map((item) => <tr key={item.id}><td className="px-4 py-3 align-top whitespace-nowrap">{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(item.occurred_at))}</td><td className="px-4 py-3 align-top">{item.actor_display_name}</td><td className="px-4 py-3 align-top">{activityEntityLabel(item.entity_type)}</td><td className="px-4 py-3 align-top">{activityOperationLabel(item.operation)}</td><td className="px-4 py-3 align-top">{item.summary}</td></tr>)}</tbody></table>
        </div>
        <Pagination page={query.data.page} pages={query.data.pages} total={query.data.total} onChange={setPage} />
      </>}
      {!isSuperAdmin && <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">Você visualiza somente atividades da sua escola.</p>}
    </CardBody></Card>
  </section>
}

function activityEntityLabel(value: string): string { return ({ book: 'Livro', copy: 'Exemplar', user: 'Usuário', loan: 'Empréstimo', school: 'Escola' }[value] ?? value) }
function activityOperationLabel(value: string): string { return ({ created: 'Cadastro', updated: 'Edição', archived: 'Arquivamento', restored: 'Restauração', returned: 'Devolução', deactivated: 'Desativação', activated: 'Ativação', customized: 'Personalização', permissions_changed: 'Permissões alteradas', return_undone: 'Devolução desfeita' }[value] ?? value) }

function ReadingSection() {
  const [section, setSection] = useState<'tracking' | 'all'>('tracking')
  const [status, setStatus] = useState<ReadingStatus | null>(null)
  const [genreFilter, setGenreFilter] = useState('')
  const [allFilterOpen, setAllFilterOpen] = useState(false)
  const [activeFilter, setActiveFilter] = useState<'true' | 'false'>('true')
  const [sortBy, setSortBy] = useState<ReadingSortBy>('created_at')
  const [sortOrder, setSortOrder] = useState<ReadingSortOrder>('desc')
  const [page, setPage] = useState(1)
  const statusFilter = section === 'tracking' ? status : null
  const query = useQuery({
    queryKey: ['reading-statuses', section, statusFilter ?? 'all', genreFilter, activeFilter, sortBy, sortOrder, page],
    queryFn: async () => {
      const filter = statusFilter ? `&status=${statusFilter}` : ''
      const genre = genreFilter ? `&genre_id=${genreFilter}` : ''
      const borrowedOnly = section === 'all' ? '&borrowed_only=true' : ''
      const active = `&is_active=${activeFilter}`
      const sorting = `&sort_by=${sortBy}&sort_order=${sortOrder}`
      return (await api.get<Paginated<CatalogBook>>(`/reading-statuses/me?page=${page}&size=15${filter}${genre}${borrowedOnly}${active}${sorting}`)).data
    },
  })
  const { data: genreOptions } = useQuery({
    queryKey: ['genres-list'],
    queryFn: async () => (await api.get<{ items: { id: number; name: string }[] }>('/genres/?size=50')).data.items,
    enabled: allFilterOpen,
  })
  const allFiltersActive = !!genreFilter || activeFilter !== 'true' || sortBy !== 'created_at'
  return (
    <section aria-labelledby="my-reading-heading" aria-busy={query.isLoading}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="my-reading-heading" className="text-xl font-semibold">Minhas leituras</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Acompanhe suas obras e consulte todas as leituras registradas.</p>
        </div>
        {section === 'tracking' && <div className="flex w-full flex-wrap items-end gap-2 sm:w-auto">
          <div className="w-44 max-w-full shrink-0 sm:w-48">
          <Select label="Acompanhamento" id="reading-status-filter" value={status ?? 'all'} onChange={(value) => { setStatus(value === 'all' ? null : value as ReadingStatus); setPage(1) }} options={[{ value: 'all', label: 'Todos' }, ...readingStatusOptions]} />
          </div>
          <ReadingFiltersButton open={allFilterOpen} onToggle={() => setAllFilterOpen((open) => !open)} active={allFiltersActive} genreFilter={genreFilter} genreOptions={genreOptions ?? []} setGenreFilter={(value) => { setGenreFilter(value); setPage(1) }} activeFilter={activeFilter} setActiveFilter={(value) => { setActiveFilter(value); setPage(1) }} sortBy={sortBy} setSortBy={(value) => { setSortBy(value); setPage(1) }} sortOrder={sortOrder} setSortOrder={(value) => { setSortOrder(value); setPage(1) }} />
        </div>}
        {section === 'all' && <ReadingFiltersButton open={allFilterOpen} onToggle={() => setAllFilterOpen((open) => !open)} active={allFiltersActive} genreFilter={genreFilter} genreOptions={genreOptions ?? []} setGenreFilter={(value) => { setGenreFilter(value); setPage(1) }} activeFilter={activeFilter} setActiveFilter={(value) => { setActiveFilter(value); setPage(1) }} sortBy={sortBy} setSortBy={(value) => { setSortBy(value); setPage(1) }} sortOrder={sortOrder} setSortOrder={(value) => { setSortOrder(value); setPage(1) }} />}
      </div>
      <div className={`${segmentedControlContainerClasses} mb-4`} role="tablist" aria-label="Seções de leitura">
        <button type="button" role="tab" aria-selected={section === 'tracking'} aria-controls="reading-tracking-panel" className={segmentedControlItemClasses(section === 'tracking')} onClick={() => { setSection('tracking'); setPage(1) }}>
          Acompanhamento de leitura
        </button>
        <button type="button" role="tab" aria-selected={section === 'all'} aria-controls="reading-all-panel" className={segmentedControlItemClasses(section === 'all')} onClick={() => { setSection('all'); setPage(1) }}>
          Todos os empréstimos
        </button>
      </div>
      <div id={section === 'tracking' ? 'reading-tracking-panel' : 'reading-all-panel'} role="tabpanel">
      {query.isLoading && <p role="status" className="py-8 text-center text-sm text-slate-500">Carregando suas leituras…</p>}
      {query.isError && <Card><CardBody><p role="alert">Não foi possível carregar suas leituras.</p><Button type="button" variant="secondary" className="mt-4" onClick={() => void query.refetch()}>Tentar novamente</Button></CardBody></Card>}
      {query.data && query.data.items.length === 0 && <Card><CardBody><p className="font-medium">{section === 'tracking' ? (status ? `Nenhum livro em “${readingStatusLabel(status)}”.` : 'Você ainda não possui acompanhamentos.') : 'Você ainda não possui livros emprestados.'}</p><Link to="/acervo" className="profile-text-link mt-4">Explorar acervo</Link></CardBody></Card>}
      {query.data && query.data.items.length > 0 && <>
        <ul role="list" aria-label={section === 'tracking' ? (status ? `Livros: ${readingStatusLabel(status)}` : 'Todos os acompanhamentos') : 'Todas as leituras'} className={responsiveBookGridClasses}>
          {query.data.items.map((book, index) => <li key={book.id} className="min-w-0"><GridCard book={book} index={index} portalHover />{section === 'tracking' && <p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-300">{readingStatusLabel(book.reading_status)}</p>}</li>)}
        </ul>
        <Pagination page={query.data.page} pages={query.data.pages} total={query.data.total} onChange={setPage} />
      </>}
      </div>
    </section>
  )
}

function ReadingFiltersButton({ open, onToggle, active, genreFilter, genreOptions, setGenreFilter, activeFilter, setActiveFilter, sortBy, setSortBy, sortOrder, setSortOrder }: {
  open: boolean
  onToggle: () => void
  active: boolean
  genreFilter: string
  genreOptions: { id: number; name: string }[]
  setGenreFilter: (value: string) => void
  activeFilter: 'true' | 'false'
  setActiveFilter: (value: 'true' | 'false') => void
  sortBy: ReadingSortBy
  setSortBy: (value: ReadingSortBy) => void
  sortOrder: ReadingSortOrder
  setSortOrder: (value: ReadingSortOrder) => void
}) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const handleOutsidePointer = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) onToggle()
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onToggle()
      requestAnimationFrame(() => triggerRef.current?.focus())
    }
    document.addEventListener('pointerdown', handleOutsidePointer)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointer)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onToggle, open])

  return <div ref={wrapperRef} className="relative shrink-0">
    <div className="flex items-stretch gap-2">
      <Button ref={triggerRef} type="button" variant={active ? 'primary' : 'secondary'} className="gap-2" aria-haspopup="dialog" aria-expanded={open} aria-controls="reading-filters" onClick={onToggle}>
        <Funnel aria-hidden="true" className="h-4 w-4" /> Filtros
        {active && <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-xs font-bold text-blue-600" aria-hidden="true">1</span>}
      </Button>
      <Button type="button" variant="secondary" onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')} aria-label={sortOrder === 'asc' ? 'Ordem crescente' : 'Ordem decrescente'} title={sortOrder === 'asc' ? 'Ordem crescente' : 'Ordem decrescente'} className="min-w-0 shrink-0 !px-2 hover:!bg-slate-100 dark:hover:!bg-slate-700">
        {sortOrder === 'asc' ? <ArrowUp className="h-5 w-5" aria-hidden="true" /> : <ArrowDown className="h-5 w-5" aria-hidden="true" />}
      </Button>
    </div>
    {open && <div id="reading-filters" role="dialog" aria-label="Filtros" className="absolute right-0 z-30 mt-2 grid w-72 gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-800">
      <Select label="Gênero" id="reading-genre-filter" value={genreFilter} onChange={setGenreFilter} options={[{ value: '', label: 'Todos' }, ...genreOptions.map((genre) => ({ value: String(genre.id), label: genre.name }))]} />
      <Select label="Situação" id="reading-active-filter" value={activeFilter} onChange={(value) => setActiveFilter(value as 'true' | 'false')} options={[{ value: 'true', label: 'Ativo' }, { value: 'false', label: 'Inativo' }]} />
      <Select label="Ordenar por" id="reading-sort" value={sortBy} onChange={(value) => setSortBy(value as ReadingSortBy)} options={[{ value: 'created_at', label: 'Cadastro' }, { value: 'published_date', label: 'Data de lançamento' }, { value: 'title', label: 'Nome' }, { value: 'author', label: 'Autor' }]} />
      <div className="flex justify-between gap-2 border-t border-slate-200 pt-3 dark:border-slate-700">
        <Button type="button" variant="secondary" onClick={() => { setGenreFilter(''); setActiveFilter('true'); setSortBy('created_at') }}>Limpar filtros</Button>
        <Button type="button" onClick={onToggle}>Aplicar</Button>
      </div>
    </div>}
  </div>
}

function ProfileField({ label, value }: { label: string; value: string }) { return <div className="min-w-0"><dt className="text-sm text-slate-500 dark:text-slate-400">{label}</dt><dd className="mt-1 break-words font-medium">{value}</dd></div> }
