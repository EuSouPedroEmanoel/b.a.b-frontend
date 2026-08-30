import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, BookOpen, Plus, Hand, Undo2, X } from 'lucide-react'
import api from '@/lib/api'
import { bookConditionLabel, bookStateLabel } from '@/lib/bookStates'
import { CoverImage } from '@/components/ui/CoverImage'
import { getCoverProxyUrl } from '@/lib/imageProxy'
import { generateFallbackCoverDataUrl } from '@/lib/coverFallback'
import { useAverageColor } from '@/hooks/useAverageColor'
import { generateCoverColor } from '@/lib/coverColor'
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
  const [loansError, setLoansError] = useState<string | null>(null)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(0) // 0:1.0, 1:1.5, 2:2.5
  const [origin, setOrigin] = useState({ x: '50%', y: '50%' })
  const imgRef = useRef<HTMLImageElement>(null)
  const [isTouchDevice, setIsTouchDevice] = useState(false)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [pinchScale, setPinchScale] = useState<number | null>(null)
  const [lightboxImgError, setLightboxImgError] = useState(false)
  const [lightboxTriedDirect, setLightboxTriedDirect] = useState(false)
  const lastTapRef = useRef(0)
  const pinchStartDistRef = useRef(0)
  const pinchStartScaleRef = useRef(1)
  const panStartRef = useRef({ x: 0, y: 0 })
  const panRef = useRef({ x: 0, y: 0 })
  const isMouseDraggingRef = useRef(false)

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [id])

  useEffect(() => {
    if (!lightboxOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxOpen(false)
        setZoomLevel(0)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [lightboxOpen])

  useEffect(() => {
    if (!lightboxOpen) {
      setZoomLevel(0)
      setOrigin({ x: '50%', y: '50%' })
      setPan({ x: 0, y: 0 })
      panRef.current = { x: 0, y: 0 }
      setPinchScale(null)
    }
  }, [lightboxOpen])

  useEffect(() => {
    if (!lightboxOpen) return
    const coarse = window.matchMedia('(pointer: coarse)').matches
    const hoverNone = window.matchMedia('(hover: none)').matches
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    setIsTouchDevice(coarse && hoverNone && hasTouch)
  }, [lightboxOpen])

  // Rastreamento global do mouse/mousepad quando em zoom (1.5x ou 2.5x) – mesma lógica mouse e mousepad
  useEffect(() => {
    if (!lightboxOpen || zoomLevel === 0) return
    const handleGlobalMouseMove = (e: MouseEvent) => {
      // mousepad segue mouse: atualiza origin quando não está arrastando (hover segue cursor)
      if (isMouseDraggingRef.current) return
      const el = imgRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      let x = ((e.clientX - rect.left) / rect.width) * 100
      let y = ((e.clientY - rect.top) / rect.height) * 100
      x = Math.max(0, Math.min(100, x))
      y = Math.max(0, Math.min(100, y))
      setOrigin({ x: `${x}%`, y: `${y}%` })
    }
    window.addEventListener('mousemove', handleGlobalMouseMove)
    return () => window.removeEventListener('mousemove', handleGlobalMouseMove)
  }, [lightboxOpen, zoomLevel])

  // Mousepad/mouse drag para pan – mesma lógica do mouse, não do touch
  useEffect(() => {
    if (!lightboxOpen) return
    const handleWindowMouseMove = (e: MouseEvent) => {
      if (!isMouseDraggingRef.current || (zoomLevel === 0 && pinchScale === null)) return
      const x = e.clientX - panStartRef.current.x
      const y = e.clientY - panStartRef.current.y
      panRef.current = { x, y }
      setPan({ x, y })
    }
    const handleWindowMouseUp = () => {
      isMouseDraggingRef.current = false
    }
    window.addEventListener('mousemove', handleWindowMouseMove)
    window.addEventListener('mouseup', handleWindowMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove)
      window.removeEventListener('mouseup', handleWindowMouseUp)
    }
  }, [lightboxOpen, zoomLevel, pinchScale])

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

  const proxiedUrlForGradient = useMemo(() => getCoverProxyUrl(book?.cover_url ?? null, 400), [book?.cover_url])
  const { darkColor } = useAverageColor(proxiedUrlForGradient ?? null, !!proxiedUrlForGradient)
  const fallbackColors = useMemo(() => (book ? generateCoverColor(book.title) : { bg: 'hsl(210, 65%, 30%)', darkBg: 'hsl(210, 65%, 20%)' }), [book])
  const sobreSolid = useMemo(() => {
    if (!book) return fallbackColors.darkBg
    return darkColor ?? fallbackColors.darkBg
  }, [book, darkColor, fallbackColors])

  useEffect(() => {
    setLightboxImgError(false)
    setLightboxTriedDirect(false)
  }, [book?.cover_url, lightboxOpen])

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
    <div className="mx-auto max-w-full !max-w-4xl w-full overflow-visible flex flex-col gap-6">
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

      <div className="grid gap-6 md:grid-cols-[220px_1fr] max-w-full overflow-visible py-6 px-2 -mx-2">
        {book.cover_url ? (
          <div
            role="button"
            tabIndex={0}
            aria-label="Ampliar capa do livro"
            className="group relative w-fit h-fit mx-auto sm:mx-0 aspect-[2/3] w-full max-w-[280px] sm:w-[220px] sm:max-w-none border border-transparent bg-transparent cursor-pointer cursor-zoom-in focus-visible:outline-3 focus-visible:outline-[var(--color-focus)] focus-visible:outline-offset-2 transition-all duration-300 ease-out hover:scale-[1.03] hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(59,130,246,0.15)] hover:z-10 will-change-transform overflow-visible"
            onClick={() => setLightboxOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setLightboxOpen(true)
              }
            }}
          >
            <CoverImage
              src={book.cover_url}
              title={book.title}
              alt={`Capa de ${book.title}`}
              width={400}
              height={600}
              priority
              className="h-full w-full overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 [&_img]:!object-cover w-full h-full object-cover [&_img]:rounded-xl"
              sizes="(max-width: 640px) 280px, 220px"
            />
          </div>
        ) : (
          <div
            role="button"
            tabIndex={0}
            aria-label="Ampliar capa do livro"
            className="group relative w-fit h-fit mx-auto sm:mx-0 aspect-[2/3] w-full max-w-[280px] sm:w-[220px] sm:max-w-none border border-transparent bg-transparent cursor-pointer cursor-zoom-in focus-visible:outline-3 focus-visible:outline-[var(--color-focus)] focus-visible:outline-offset-2 transition-all duration-300 ease-out hover:scale-[1.03] hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(59,130,246,0.15)] hover:z-10 will-change-transform overflow-visible"
            onClick={() => setLightboxOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setLightboxOpen(true)
              }
            }}
          >
            <CoverImage
              src={book.cover_url}
              title={book.title}
              alt={`Capa de ${book.title}`}
              width={400}
              height={600}
              priority
              className="h-full w-full overflow-hidden rounded-xl aspect-[2/3] border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 [&_img]:rounded-xl"
              sizes="(max-width: 640px) 280px, 220px"
            />
          </div>
        )}

        <div className="flex flex-col gap-4">
          <Card className="relative overflow-hidden border-white/20 text-white" style={{ background: sobreSolid }}>
            <div className="absolute inset-0 bg-black/10 pointer-events-none" aria-hidden="true" />
            <CardHeader className="relative border-white/15">
              <h2 className="font-semibold flex items-center gap-2 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]">
                <BookOpen className="h-5 w-5 text-white/90" aria-hidden="true" /> Sobre o livro
              </h2>
            </CardHeader>
            <CardBody className="relative">
              <p className="text-sm leading-relaxed text-white/90 drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]">
                {book.description || 'Sem descrição disponível.'}
              </p>
              <dl className="mt-6 grid gap-4 border-t border-white/15 pt-4 text-sm">
                <div className="grid grid-cols-3 gap-2">
                  <dt className="text-white/60">ISBN</dt>
                  <dd className="col-span-2 font-mono text-white break-all drop-shadow-sm">{book.isbn ?? '—'}</dd>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <dt className="text-white/60">Lançamento</dt>
                  <dd className="col-span-2 text-white drop-shadow-sm">{book.published_date ? new Date(book.published_date).toLocaleDateString('pt-BR') : '—'}</dd>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <dt className="text-white/60">Cadastrado em</dt>
                  <dd className="col-span-2 text-white drop-shadow-sm">{book.created_at ? new Date(book.created_at).toLocaleDateString('pt-BR') : '—'}</dd>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <dt className="text-white/60">Autores</dt>
                  <dd className="col-span-2 flex flex-wrap gap-1.5">
                    {book.authors?.length ? book.authors.map((a) => <Badge key={a.id} tone="info">{a.name}</Badge>) : <span className="text-white/50">—</span>}
                  </dd>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <dt className="text-white/60">Gêneros</dt>
                  <dd className="col-span-2 flex flex-wrap gap-1.5">
                    {book.genres?.length ? book.genres.map((g) => <Badge key={g.id} tone="neutral">{g.name}</Badge>) : <span className="text-white/50">—</span>}
                  </dd>
                </div>
              </dl>
            </CardBody>
          </Card>

          <Card className="relative overflow-hidden border-white/20 text-white" style={{ background: sobreSolid }}>
            <div className="absolute inset-0 bg-black/10 pointer-events-none" aria-hidden="true" />
            <CardHeader className="relative border-white/15">
              <h2 className="font-semibold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]">Exemplares</h2>
            </CardHeader>
            <CardBody className="relative">
              {copies.length === 0 ? (
                <p className="text-sm text-white/70">Nenhum exemplar cadastrado para este livro nesta escola.</p>
              ) : (
                <>
                  <dl className="grid grid-cols-3 gap-3 text-center mb-4">
                    <div className="rounded-lg border border-white/15 bg-white/10 backdrop-blur-sm p-3">
                      <dt className="text-xs text-white/60 uppercase">Total</dt>
                      <dd className="mt-1 text-2xl font-bold text-white">{copies.length}</dd>
                    </div>
                    <div className="rounded-lg border border-white/15 bg-white/10 backdrop-blur-sm p-3">
                      <dt className="text-xs text-white/70 uppercase">Disponíveis</dt>
                      <dd className="mt-1 text-2xl font-bold text-white">{available}</dd>
                    </div>
                    <div className="rounded-lg border border-white/15 bg-white/10 backdrop-blur-sm p-3">
                      <dt className="text-xs text-white/70 uppercase">Emprestados</dt>
                      <dd className="mt-1 text-2xl font-bold text-white">{borrowed}</dd>
                    </div>
                  </dl>
                  <ul className="divide-y divide-white/15" role="list">
                    {copies.map((c) => (
                      <li key={c.id} className="flex items-center justify-between py-2.5 text-sm">
                        <span className="font-mono text-white/90">{c.code}</span>
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

      <Card className="relative overflow-hidden border-white/20 text-white" style={{ background: sobreSolid }}>
        <div className="absolute inset-0 bg-black/10 pointer-events-none" aria-hidden="true" />
        <CardHeader className="relative border-white/15">
          <h2 className="font-semibold flex items-center gap-2 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]" aria-live="polite">
            <Undo2 className="h-5 w-5 text-white/90" aria-hidden="true" /> Devoluções — empréstimos ativos deste livro
          </h2>
        </CardHeader>
        <CardBody className="relative">
          {loansLoading && <p aria-live="polite" className="text-white/80">Carregando empréstimos...</p>}
          {!loansLoading && activeLoans && activeLoans.length === 0 && (
            <p className="text-sm text-white/70 py-4 text-center">Nenhum empréstimo ativo para este livro.</p>
          )}
          {activeLoans && activeLoans.length > 0 && (
            <ul className="divide-y divide-white/15" role="list">
              {activeLoans.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="text-sm">
                    <p className="text-white/90">
                      <span className="font-mono">#{l.id}</span> · Exemplar{' '}
                      <span className="font-mono">{copyCode(l.copy_id)}</span> · {userLabel(l.user_id)}
                    </p>
                    <p className="text-xs text-white/60 mt-0.5">
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

      <AnimatePresence>
        {lightboxOpen && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Capa ampliada"
            onClick={(e) => {
              if (e.target === e.currentTarget) setLightboxOpen(false)
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <motion.button
              type="button"
              aria-label="Fechar"
              onClick={() => setLightboxOpen(false)}
              className="absolute top-4 right-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm border border-white/20 focus-visible:outline-3 focus-visible:outline-[var(--color-focus)] focus-visible:outline-offset-2"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: 'spring', stiffness: 300, damping: 18, mass: 0.8 }}
            >
              <X className="h-6 w-6" aria-hidden="true" />
            </motion.button>
            <motion.img
              ref={imgRef}
              src={(() => {
                const proxied = getCoverProxyUrl(book.cover_url, 400)
                const fallback = generateFallbackCoverDataUrl(book.title, 400, 600)
                if (!book.cover_url || lightboxImgError) return fallback
                if (lightboxTriedDirect) return book.cover_url
                return proxied ?? fallback
              })()}
              alt={`Capa de ${book.title}`}
              crossOrigin={lightboxImgError || !book.cover_url || lightboxTriedDirect ? undefined : 'anonymous'}
              className={`${isTouchDevice ? 'max-h-[85vh]' : 'max-h-[90vh]'} w-auto max-w-[90vw] ${!book.cover_url || lightboxImgError ? 'aspect-[2/3] w-[400px] h-auto object-cover' : 'object-contain'} rounded-lg shadow-2xl ${zoomLevel === 2 || (pinchScale !== null && pinchScale >= 2) ? 'cursor-zoom-out' : 'cursor-zoom-in'}`}
              style={{
                transformOrigin: `${origin.x} ${origin.y}`,
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${pinchScale ?? [1, 1.5, 2.5][zoomLevel]})`,
                transition: 'transform 0.15s ease-out, transform-origin 0.05s ease-out',
                touchAction: isTouchDevice && (zoomLevel !== 0 || pinchScale !== null) ? 'none' : 'auto',
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{
                type: 'spring',
                stiffness: 300,
                damping: 18,
                mass: 0.8,
                opacity: { duration: 0.2 },
              }}
              decoding="async"
              loading="eager"
              fetchPriority="high"
              onError={() => {
                if (book.cover_url && !lightboxImgError) {
                  if (!lightboxTriedDirect && getCoverProxyUrl(book.cover_url, 400) !== book.cover_url) {
                    setLightboxTriedDirect(true)
                  } else {
                    setLightboxImgError(true)
                  }
                }
              }}
              onClick={(e) => {
                e.stopPropagation()
                setZoomLevel((prev) => (prev + 1) % 3)
              }}
              onMouseDown={(e) => {
                if (zoomLevel === 0 && pinchScale === null) return
                isMouseDraggingRef.current = true
                panStartRef.current = { x: e.clientX - panRef.current.x, y: e.clientY - panRef.current.y }
                e.preventDefault()
              }}
              onTouchStart={(e) => {
                if (e.touches.length === 1) {
                  panStartRef.current = { x: e.touches[0].clientX - panRef.current.x, y: e.touches[0].clientY - panRef.current.y }
                } else if (e.touches.length === 2) {
                  const dx = e.touches[0].clientX - e.touches[1].clientX
                  const dy = e.touches[0].clientY - e.touches[1].clientY
                  pinchStartDistRef.current = Math.hypot(dx, dy)
                  pinchStartScaleRef.current = pinchScale ?? [1, 1.5, 2.5][zoomLevel]
                }
              }}
              onTouchMove={(e) => {
                if (e.touches.length === 1 && (zoomLevel !== 0 || pinchScale !== null)) {
                  const x = e.touches[0].clientX - panStartRef.current.x
                  const y = e.touches[0].clientY - panStartRef.current.y
                  panRef.current = { x, y }
                  setPan({ x, y })
                } else if (e.touches.length === 2) {
                  e.preventDefault()
                  const dx = e.touches[0].clientX - e.touches[1].clientX
                  const dy = e.touches[0].clientY - e.touches[1].clientY
                  const dist = Math.hypot(dx, dy)
                  const scale = Math.max(1, Math.min(2.5, pinchStartScaleRef.current * (dist / (pinchStartDistRef.current || dist))))
                  setPinchScale(scale)
                  const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2
                  const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2
                  const el = imgRef.current
                  if (el) {
                    const rect = el.getBoundingClientRect()
                    let px = ((cx - rect.left) / rect.width) * 100
                    let py = ((cy - rect.top) / rect.height) * 100
                    px = Math.max(0, Math.min(100, px))
                    py = Math.max(0, Math.min(100, py))
                    setOrigin({ x: `${px}%`, y: `${py}%` })
                  }
                }
              }}
              onTouchEnd={(e) => {
                if (e.touches.length === 0) {
                  const now = Date.now()
                  const isDoubleTap = now - lastTapRef.current < 300
                  lastTapRef.current = now
                  if (isDoubleTap) {
                    e.preventDefault()
                    if (zoomLevel === 0 && pinchScale === null) {
                      setZoomLevel(2)
                      setOrigin({ x: '50%', y: '50%' })
                      setPan({ x: 0, y: 0 })
                      panRef.current = { x: 0, y: 0 }
                    } else {
                      setZoomLevel(0)
                      setPinchScale(null)
                      setPan({ x: 0, y: 0 })
                      panRef.current = { x: 0, y: 0 }
                      setOrigin({ x: '50%', y: '50%' })
                    }
                  }
                  if (pinchScale !== null) {
                    const s = pinchScale
                    if (s < 1.25) setZoomLevel(0)
                    else if (s < 2) setZoomLevel(1)
                    else setZoomLevel(2)
                    setTimeout(() => setPinchScale(null), 150)
                  }
                }
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
