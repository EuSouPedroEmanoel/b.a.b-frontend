import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, BookOpen, Plus, Hand, Undo2, ImageOff } from 'lucide-react'
import api from '@/lib/api'
import { bookConditionLabel, bookStateLabel } from '@/lib/bookStates'
import { useAnnouncer } from '@/components/feedback/LiveRegion'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Select } from '@/components/ui/Select'

type Book = {
  id: number
  title: string
  description: string | null
  isbn: string | null
  cover_url: string | null
  published_date: string | null
  created_at: string | null
  updated_at: string | null
  genres: { id: number; name: string; slug: string }[]
  authors: { id: number; name: string; slug: string }[]
  is_active: boolean
  added_by: number
  edited_by: number | null
  derived_state: string
}
type Copy = { id: number; code: string; state: string; condition: string; book_id: number; school_id: number }
type Loan = { id: number; copy_id: number; user_id: number; school_id: number; status: string; borrowed_at: string; due_date: string; returned_at: string | null; late_days: number }
type User = { id: number; username: string; email: string; role: string; school_id: number | null; is_active: boolean }
type Paginated<T> = { items: T[]; total: number; page: number; size: number; pages: number }

const MANAGE_ROLES = ['librarian', 'school_admin', 'super_admin']

export function BookDetailPage() {
  const { bookId } = useParams<{ bookId: string }>()
  const id = Number(bookId)
  const announce = useAnnouncer()
  const qc = useQueryClient()
  const { user } = useAuth()
  const canManage = !!user && MANAGE_ROLES.includes(user.role)

  const [loanOpen, setLoanOpen] = useState(false)
  const [copyId, setCopyId] = useState<number | ''>('')
  const [userId, setUserId] = useState<number | ''>('')
  const [imgError, setImgError] = useState(false)
  const [loansError, setLoansError] = useState<string | null>(null)

  const { data: book, isLoading, isError, error } = useQuery({
    queryKey: ['book', id],
    queryFn: async () => {
      const { data } = await api.get<Book>(`/books/${id}`)
      return data
    },
    enabled: Number.isFinite(id),
  })

  const { data: copiesPage } = useQuery({
    queryKey: ['copies', id],
    queryFn: async () => {
      const { data } = await api.get<Paginated<Copy>>(`/copies/?size=100&book_id=${id}`)
      return data
    },
    enabled: Number.isFinite(id),
  })

  const activeCopyIds = useMemo(
    () => new Set((copiesPage?.items ?? []).map((c) => c.id)),
    [copiesPage],
  )

  const { data: activeLoans, isLoading: loansLoading } = useQuery({
    queryKey: ['book-loans', id],
    queryFn: async () => {
      const { data } = await api.get<Paginated<Loan>>('/loans/?status=active&size=100')
      const filtered = data.items.filter((l) => activeCopyIds.has(l.copy_id))
      return filtered
    },
    enabled: Number.isFinite(id) && copiesPage !== undefined,
  })

  const { data: usersPage } = useQuery({
    queryKey: ['users', 'all'],
    queryFn: async () => {
      const { data } = await api.get<Paginated<User>>('/users/?size=100')
      return data
    },
    enabled: Number.isFinite(id) && canManage,
  })

  const availableCopies = useMemo(
    () => (copiesPage?.items ?? []).filter((c) => c.state === 'available'),
    [copiesPage],
  )
  const copies = copiesPage?.items ?? []
  const available = availableCopies.length
  const borrowed = copies.filter((c) => c.state === 'borrowed').length

  const copyCode = useMemo(() => {
    const map = new Map((copiesPage?.items ?? []).map((c) => [c.id, c.code]))
    return (copyIdNum: number) => map.get(copyIdNum) ?? String(copyIdNum)
  }, [copiesPage])
  const userLabel = useMemo(() => {
    const map = new Map((usersPage?.items ?? []).map((u) => [u.id, u.username]))
    return (userIdNum: number) => map.get(userIdNum) ?? String(userIdNum)
  }, [usersPage])

  const createLoan = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<Loan>('/loans/', { copy_id: Number(copyId), user_id: Number(userId) })
      return data
    },
    onSuccess: () => {
      announce('Empréstimo criado com sucesso', 'polite')
      setLoanOpen(false)
      setCopyId('')
      setUserId('')
      qc.invalidateQueries({ queryKey: ['book', id] })
      qc.invalidateQueries({ queryKey: ['copies', id] })
      qc.invalidateQueries({ queryKey: ['book-loans', id] })
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Erro ao emprestar'
      announce(msg, 'assertive')
    },
  })

  const returnLoan = useMutation({
    mutationFn: async (loanId: number) => {
      const { data } = await api.post<Loan>(`/loans/${loanId}/return`)
      return data
    },
    onSuccess: (l) => {
      announce(`Devolução concluída. Atraso: ${l.late_days} dia(s)`, 'polite')
      qc.invalidateQueries({ queryKey: ['book', id] })
      qc.invalidateQueries({ queryKey: ['copies', id] })
      qc.invalidateQueries({ queryKey: ['book-loans', id] })
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Erro na devolução'
      setLoansError(msg)
      announce(msg, 'assertive')
    },
  })

  const submitLoan = (e: React.FormEvent) => {
    e.preventDefault()
    if (copyId === '' || userId === '') {
      const msg = 'Selecione exemplar e usuário'
      announce(msg, 'assertive')
      return
    }
    createLoan.mutate()
  }

  if (!Number.isFinite(id)) {
    return <div role="alert" className="p-8 text-center">ID de livro inválido</div>
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl flex flex-col gap-6" aria-busy="true" aria-live="polite">
        <div className="h-8 w-48 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
        <div className="h-56 rounded-xl border border-slate-200 dark:border-slate-700 animate-pulse bg-slate-50 dark:bg-slate-800" />
      </div>
    )
  }

  if (isError || !book) {
    return (
      <div className="mx-auto max-w-4xl">
        <div role="alert" className="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 p-4 text-sm text-red-800 dark:text-red-200">
          Erro ao carregar livro: {(error as { message?: string })?.message ?? 'tente novamente'}
        </div>
        <Link to="/acervo" className="inline-flex items-center text-sm text-slate-600 dark:text-slate-300 hover:text-[var(--color-primary)] mt-4">
          <ArrowLeft className="h-4 w-4 mr-1" aria-hidden="true" /> Voltar ao acervo
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl flex flex-col gap-6">
      <header>
        <Link to="/acervo" className="inline-flex items-center text-sm text-slate-600 dark:text-slate-300 hover:text-[var(--color-primary)] mb-2">
          <ArrowLeft className="h-4 w-4 mr-1" aria-hidden="true" /> Voltar ao acervo
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold">{book.title}</h1>
          <Badge tone={book.derived_state === 'available' ? 'success' : book.derived_state === 'borrowed' ? 'warning' : 'neutral'}>
            {bookStateLabel(book.derived_state)}
          </Badge>
        </div>
      </header>

      {canManage && (
        <div
          className="flex flex-wrap gap-3"
          role="toolbar"
          aria-label="Ações do livro"
          aria-orientation="horizontal"
          onKeyDown={(e) => {
            if (!['ArrowRight','ArrowLeft','Home','End'].includes(e.key)) return
            const els = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('a, button'))
            const idx = els.indexOf(document.activeElement as HTMLElement)
            if (idx === -1) return
            e.preventDefault()
            let next = idx
            if (e.key === 'ArrowRight') next = (idx + 1) % els.length
            if (e.key === 'ArrowLeft') next = (idx - 1 + els.length) % els.length
            if (e.key === 'Home') next = 0
            if (e.key === 'End') next = els.length - 1
            els[next]?.focus()
          }}
        >
          <Link
            to={`/acervo/${id}/exemplares/novo`}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-[#0f4c75] text-white hover:bg-[#0e3f61] active:bg-[#0c3d5e] dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 dark:active:bg-slate-200 min-h-[44px] font-medium shadow-sm transition-colors focus-visible:outline-3 focus-visible:outline-[var(--color-focus)] focus-visible:outline-offset-2"
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> Cadastrar exemplar
          </Link>
          <Button
            variant="secondary"
            onClick={() => {
              setLoanOpen(true)
              setLoansError(null)
            }}
          >
            <Hand className="h-4 w-4 mr-2" aria-hidden="true" /> Emprestar
          </Button>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        <div
          className="h-72 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 overflow-hidden flex items-center justify-center"
          aria-label="Capa do livro"
        >
          {book.cover_url && !imgError ? (
            <img
              src={book.cover_url}
              alt={`Capa de ${book.title}`}
              className="h-full w-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 text-slate-400 p-4 text-center">
              <ImageOff className="h-10 w-10" aria-hidden="true" />
              <span className="text-sm">Imagem em breve</span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <h2 className="font-semibold flex items-center gap-2">
                <BookOpen className="h-5 w-5" aria-hidden="true" /> Sobre o livro
              </h2>
            </CardHeader>
            <CardBody>
              <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                {book.description || 'Sem descrição disponível.'}
              </p>
              <dl className="mt-6 grid gap-4 border-t border-slate-200 dark:border-slate-700 pt-4 text-sm">
                <div className="grid grid-cols-3 gap-2">
                  <dt className="text-slate-500">ISBN</dt>
                  <dd className="col-span-2 font-mono text-slate-700 dark:text-slate-200 break-all">{book.isbn ?? '—'}</dd>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <dt className="text-slate-500">Lançamento</dt>
                  <dd className="col-span-2 text-slate-700 dark:text-slate-200">{book.published_date ? new Date(book.published_date).toLocaleDateString('pt-BR') : '—'}</dd>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <dt className="text-slate-500">Cadastrado em</dt>
                  <dd className="col-span-2 text-slate-700 dark:text-slate-200">{book.created_at ? new Date(book.created_at).toLocaleDateString('pt-BR') : '—'}</dd>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <dt className="text-slate-500">Autores</dt>
                  <dd className="col-span-2 flex flex-wrap gap-1.5">
                    {book.authors?.length ? book.authors.map((a) => <Badge key={a.id} tone="info">{a.name}</Badge>) : <span className="text-slate-500">—</span>}
                  </dd>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <dt className="text-slate-500">Gêneros</dt>
                  <dd className="col-span-2 flex flex-wrap gap-1.5">
                    {book.genres?.length ? book.genres.map((g) => <Badge key={g.id} tone="neutral">{g.name}</Badge>) : <span className="text-slate-500">—</span>}
                  </dd>
                </div>
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="font-semibold">Exemplares</h2>
            </CardHeader>
            <CardBody>
              {copies.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhum exemplar cadastrado para este livro nesta escola.</p>
              ) : (
                <>
                  <dl className="grid grid-cols-3 gap-3 text-center mb-4">
                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                      <dt className="text-xs text-slate-500 uppercase">Total</dt>
                      <dd className="mt-1 text-2xl font-bold">{copies.length}</dd>
                    </div>
                    <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 p-3">
                      <dt className="text-xs text-emerald-600 uppercase">Disponíveis</dt>
                      <dd className="mt-1 text-2xl font-bold">{available}</dd>
                    </div>
                    <div className="rounded-lg border border-amber-200 dark:border-amber-800 p-3">
                      <dt className="text-xs text-amber-600 uppercase">Emprestados</dt>
                      <dd className="mt-1 text-2xl font-bold">{borrowed}</dd>
                    </div>
                  </dl>
                  <ul className="divide-y divide-slate-200 dark:divide-slate-700" role="list">
                    {copies.map((c) => (
                      <li key={c.id} className="flex items-center justify-between py-2.5 text-sm">
                        <span className="font-mono">{c.code}</span>
                        <span className="flex items-center gap-2">
                          <Badge tone={c.condition === 'new' ? 'success' : c.condition === 'bad' ? 'danger' : c.condition === 'fair' || c.condition === 'poor' ? 'warning' : 'neutral'}>
                            {bookConditionLabel(c.condition)}
                          </Badge>
                          <Badge tone={c.state === 'available' ? 'success' : c.state === 'borrowed' ? 'warning' : 'neutral'}>
                            {bookStateLabel(c.state)}
                          </Badge>
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {loansError && (
        <div role="alert" className="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 p-3 text-sm text-red-800 dark:text-red-200">
          {loansError}
        </div>
      )}

      <Card>
        <CardHeader>
          <h2 className="font-semibold flex items-center gap-2" aria-live="polite">
            <Undo2 className="h-5 w-5" aria-hidden="true" /> Devoluções — empréstimos ativos deste livro
          </h2>
        </CardHeader>
        <CardBody>
          {loansLoading && <p aria-live="polite">Carregando empréstimos...</p>}
          {!loansLoading && activeLoans && activeLoans.length === 0 && (
            <p className="text-sm text-slate-500 py-4 text-center">Nenhum empréstimo ativo para este livro.</p>
          )}
          {activeLoans && activeLoans.length > 0 && (
            <ul className="divide-y divide-slate-200 dark:divide-slate-700" role="list">
              {activeLoans.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="text-sm">
                    <p>
                      <span className="font-mono">#{l.id}</span> · Exemplar{' '}
                      <span className="font-mono">{copyCode(l.copy_id)}</span> · {userLabel(l.user_id)}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Emprestado em {new Date(l.borrowed_at).toLocaleDateString('pt-BR')} · Devolução em{' '}
                      {new Date(l.due_date).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  {canManage && (
                    <Button size="sm" variant="secondary" onClick={() => returnLoan.mutate(l.id)} disabled={returnLoan.isPending}>
                      Devolver
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {loanOpen && canManage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="loan-dialog-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setLoanOpen(false)
          }}
        >
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-800 shadow-xl">
            <CardHeader>
              <h2 id="loan-dialog-title" className="text-lg font-semibold">Emprestar — {book.title}</h2>
            </CardHeader>
            <CardBody>
              <form onSubmit={submitLoan} className="grid gap-4">
                <Select
                  label="Exemplar disponível"
                  id="loan-copy"
                  value={copyId === '' ? '' : String(copyId)}
                  onChange={(v) => setCopyId(v ? Number(v) : '')}
                  options={[{ value: '', label: 'Selecione...' }, ...availableCopies.map((c) => ({ value: String(c.id), label: c.code }))]}
                />
                {availableCopies.length === 0 && (
                  <p className="text-xs text-amber-600 -mt-2">Nenhum exemplar disponível no momento.</p>
                )}
                <Select
                  label="Usuário da escola"
                  id="loan-user"
                  value={userId === '' ? '' : String(userId)}
                  onChange={(v) => setUserId(v ? Number(v) : '')}
                  options={[{ value: '', label: 'Selecione...' }, ...((usersPage?.items ?? []).map((u) => ({ value: String(u.id), label: u.username })))]}
                />
                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="secondary" onClick={() => setLoanOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createLoan.isPending} aria-busy={createLoan.isPending}>
                    {createLoan.isPending ? 'Emprestando…' : 'Confirmar'}
                  </Button>
                </div>
              </form>
            </CardBody>
          </div>
        </div>
      )}
    </div>
  )
}
