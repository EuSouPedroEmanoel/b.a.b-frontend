import { useEffect, useMemo, useRef } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { BookOpen, RefreshCw, ShieldCheck, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { ButtonLink } from '@/components/ui/ButtonLink'
import { Card, CardBody } from '@/components/ui/Card'
import { PageDescription } from '@/components/ui/PageDescription'
import { GridCard } from '@/features/books/GridCard'
import { responsiveBookGridClasses } from '@/features/books/bookGrid'
import { useAuth } from '@/hooks/useAuth'
import api from '@/lib/api'

export type ProfileLoan = { id: number; status: string; borrowed_at: string; due_date: string; returned_at: string | null; book_id: number; book_title: string; book_cover_url: string | null; book_details: CatalogBook }
type Paginated<T> = { items: T[]; total: number; page: number; size: number; pages: number }
type CatalogBook = { id: number; title: string; description: string | null; derived_state: string; isbn: string | null; cover_url: string | null; published_date: string | null; genres: { id: number; name: string; slug: string }[]; authors: { id: number; name: string; slug: string }[] }

const accountRoleLabel = (role: string) => ({ student: 'Aluno', teacher: 'Professor', librarian: 'Bibliotecário', school_admin: 'Administrador escolar', super_admin: 'Superadministrador' }[role] ?? role)
const formatDate = (value: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date(`${value.slice(0, 10)}T12:00:00`))

export function AccountPage() {
  const { user } = useAuth()
  const isStudent = user?.role === 'student'
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const loans = useInfiniteQuery({
    queryKey: ['loans', 'me', 'profile'],
    queryFn: async ({ pageParam }) => (await api.get<Paginated<ProfileLoan>>(`/loans/me?page=${pageParam}&size=15`)).data,
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.page < lastPage.pages ? lastPage.page + 1 : undefined,
    enabled: isStudent,
  })
  const loanHistory = useMemo(() => loans.data?.pages.flatMap((page) => page.items) ?? [], [loans.data])
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = loans
  useEffect(() => {
    const target = loadMoreRef.current
    if (!target || !hasNextPage || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting) && !isFetchingNextPage) void fetchNextPage()
    }, { rootMargin: '25%' })
    observer.observe(target)
    return () => observer.disconnect()
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])
  if (!user) return null
  const displayName = user.name || user.username

  return <main className="flex min-w-0 flex-col gap-6">
    <header className="min-w-0"><h1 className="break-words text-2xl font-bold sm:text-3xl">Meu perfil</h1><p className="break-words text-lg font-medium">{displayName}</p><p className="text-sm text-slate-600 dark:text-slate-300">{accountRoleLabel(user.role)}</p></header>

    <section aria-labelledby="personal-information"><Card><CardBody>
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row"><div><h2 id="personal-information" className="flex items-center gap-2 text-lg font-semibold"><UserRound aria-hidden="true" className="h-5 w-5" /> Informações pessoais</h2><PageDescription>Dados usados para identificar seu acesso à biblioteca.</PageDescription></div><ButtonLink to={`/perfil/${user.id}#perfil`}>Editar perfil</ButtonLink></div>
      <dl className="mt-6 grid gap-4 sm:grid-cols-2"><ProfileField label="Nome" value={displayName} /><ProfileField label="Nome de usuário" value={user.username} /><ProfileField label="E-mail" value={user.email || 'Não informado'} /><ProfileField label="Perfil de acesso" value={accountRoleLabel(user.role)} />{user.birthdate && <ProfileField label="Data de nascimento" value={new Intl.DateTimeFormat('pt-BR').format(new Date(`${user.birthdate}T12:00:00`))} />}{user.turma_numero && user.turma_letra && <ProfileField label="Turma" value={`${user.turma_numero}º ${user.turma_letra}`} />}</dl>
    </CardBody></Card></section>

    <section aria-labelledby="security-heading"><Card><CardBody className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center"><div><h2 id="security-heading" className="flex items-center gap-2 text-lg font-semibold"><ShieldCheck aria-hidden="true" className="h-5 w-5" /> Segurança</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Mantenha sua conta protegida com uma senha segura.</p></div><ButtonLink to={`/perfil/${user.id}#senha`} variant="secondary">Alterar senha</ButtonLink></CardBody></Card></section>

    {isStudent && <section aria-labelledby="my-books-heading" aria-busy={loans.isLoading || loans.isFetchingNextPage}><div className="mb-4"><h2 id="my-books-heading" className="flex items-center gap-2 text-xl font-semibold"><BookOpen aria-hidden="true" className="h-5 w-5" /> Meus livros</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Seu histórico de empréstimos, dos mais recentes aos mais antigos.</p></div>
      {loans.isLoading && <div role="status" className={responsiveBookGridClasses}><span className="sr-only">Carregando seus livros…</span>{[0, 1, 2].map((item) => <div key={item} aria-hidden="true" className="aspect-[2/3] animate-pulse rounded-2xl bg-slate-200 motion-reduce:animate-none dark:bg-slate-700" />)}</div>}
      {loans.isError && <Card><CardBody><div role="alert"><p className="font-medium">Não foi possível carregar seus livros.</p><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Verifique sua conexão e tente novamente.</p></div><Button type="button" variant="secondary" className="mt-4 gap-2" onClick={() => void loans.refetch()}><RefreshCw aria-hidden="true" className="h-4 w-4" /> Tentar novamente</Button></CardBody></Card>}
      {loans.data && loanHistory.length === 0 && <Card><CardBody><p className="font-medium">Você ainda não possui empréstimos no histórico.</p><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Explore o acervo para encontrar sua próxima leitura.</p><Link to="/acervo" className="profile-text-link mt-4">Explorar acervo</Link></CardBody></Card>}
      {loanHistory.length > 0 && <ul role="list" aria-label="Histórico de livros emprestados" className={responsiveBookGridClasses}>{loanHistory.map((loan, index) => <LoanBookCard key={loan.id} loan={loan} book={loan.book_details} index={index} />)}</ul>}
      <div ref={loadMoreRef} aria-hidden={!loans.hasNextPage} className="h-1" />
      {loans.isFetchingNextPage && <p role="status" className="mt-4 text-center text-sm text-slate-600 dark:text-slate-300">Carregando mais livros…</p>}
      {loans.hasNextPage && !loans.isFetchingNextPage && typeof IntersectionObserver === 'undefined' && <Button type="button" variant="secondary" className="mt-4" onClick={() => void loans.fetchNextPage()}>Carregar mais</Button>}
    </section>}
  </main>
}

function ProfileField({ label, value }: { label: string; value: string }) { return <div className="min-w-0"><dt className="text-sm text-slate-500 dark:text-slate-400">{label}</dt><dd className="mt-1 break-words font-medium">{value}</dd></div> }

function LoanBookCard({ loan, book, index }: { loan: ProfileLoan; book: CatalogBook; index: number }) {
  const overdue = loan.status === 'overdue' || new Date(`${loan.due_date.slice(0, 10)}T23:59:59`) < new Date()
  const returned = loan.status === 'returned' && loan.returned_at
  return <li className="min-w-0"><GridCard book={book} index={index} portalHover /><p className={`mt-2 text-sm font-medium ${overdue && !returned ? 'text-red-700 dark:text-red-300' : 'text-slate-600 dark:text-slate-300'}`}>{returned ? <>Devolvido em <time dateTime={loan.returned_at ?? undefined}>{formatDate(loan.returned_at!)}</time></> : <><span className="sr-only">{overdue ? 'Empréstimo atrasado. ' : 'Empréstimo ativo. '}</span>Devolução: <time dateTime={loan.due_date}>{formatDate(loan.due_date)}</time></>}</p></li>
}
