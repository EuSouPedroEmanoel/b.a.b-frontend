import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, BookOpen, Plus, Hand, Undo2, X } from 'lucide-react'
import api from '@/lib/api'
import { bookConditionLabel, bookStateLabel, bookStateTone } from '@/lib/bookStates'
import { CoverImage } from '@/components/ui/CoverImage'
import { getCoverProxyUrl } from '@/lib/imageProxy'
import { generateFallbackCoverDataUrl } from '@/lib/coverFallback'
import { stringToHsl } from '@/lib/coverColor'
import { useAverageColor } from '@/hooks/useAverageColor'
import { useAnnouncer } from '@/components/feedback/LiveRegionContext'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Carousel } from '@/components/ui/Carousel'
import { GridCard } from '@/features/books/GridCard'
import { ReservationConfirmDialog } from '@/features/books/ReservationConfirmDialog'

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
type Reservation = { id: number; book_id: number; status: string }
type Paginated<T> = { items: T[]; total: number; page: number; size: number; pages: number }

const MANAGE_ROLES = ['librarian', 'school_admin', 'super_admin']
const RESERVATION_ROLES = ['student', 'teacher']

export function BookDetailPage() {
  const { bookId } = useParams<{ bookId: string }>()
  const id = Number(bookId)
  const announce = useAnnouncer()
  const qc = useQueryClient()
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const canManage = !!user && MANAGE_ROLES.includes(user.role)
  const canReserve = !!user && RESERVATION_ROLES.includes(user.role)

  const handleBack = useCallback(() => {
    const fromState = (location.state as { from?: string } | null)?.from
    if (fromState && typeof fromState === 'string' && fromState.startsWith('/acervo')) {
      navigate(fromState)
      return
    }
    try {
      const savedSearch = sessionStorage.getItem('acervo:search')
      if (savedSearch) {
        navigate(`/acervo${savedSearch}`)
        return
      }
    } catch { /* ignore */ }
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate('/acervo')
    }
  }, [location.state, navigate])

  const [loanConfirmOpen, setLoanConfirmOpen] = useState(false)
  const loanTriggerRef = useRef<HTMLButtonElement>(null)
  const loanCancelRef = useRef<HTMLButtonElement>(null)
  const [loansError, setLoansError] = useState<string | null>(null)
  const [reservationDialogOpen, setReservationDialogOpen] = useState(false)
  const [reservationErrorMessage, setReservationErrorMessage] = useState<string | null>(null)
  const [reservationFeedback, setReservationFeedback] = useState<{ type: 'success' | 'info'; message: string } | null>(null)
  const reservationButtonRef = useRef<HTMLButtonElement>(null)
  const reservationCancelRef = useRef<HTMLButtonElement>(null)
  const reservationConfirmRef = useRef<HTMLButtonElement>(null)
  const reservationLinkRef = useRef<HTMLAnchorElement>(null)
  const availabilityNoticeRef = useRef<HTMLParagraphElement>(null)
  const shouldFocusReservationLinkRef = useRef(false)
  const shouldFocusAvailabilityRef = useRef(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(0) // 0:1.0, 1:1.5, 2:2.5
  const [origin, setOrigin] = useState({ x: '50%', y: '50%' })
  const imgRef = useRef<HTMLImageElement>(null)
  const isTouchDevice = typeof window !== 'undefined'
    && window.matchMedia('(pointer: coarse)').matches
    && window.matchMedia('(hover: none)').matches
    && ('ontouchstart' in window || navigator.maxTouchPoints > 0)
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

  const resetLightbox = useCallback(() => {
    setZoomLevel(0)
    setOrigin({ x: '50%', y: '50%' })
    setPan({ x: 0, y: 0 })
    panRef.current = { x: 0, y: 0 }
    setPinchScale(null)
  }, [])

  const openLightbox = useCallback(() => {
    setLightboxImgError(false)
    setLightboxTriedDirect(false)
    resetLightbox()
    setLightboxOpen(true)
  }, [resetLightbox])

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false)
    resetLightbox()
  }, [resetLightbox])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [id])

  useEffect(() => {
    if (!lightboxOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
      const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeLightbox()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [closeLightbox, lightboxOpen])

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

  const reservationQueryKey = ['reservations', 'me', 'book', id] as const
  const {
    data: reservationsPage,
    isLoading: reservationsLoading,
  } = useQuery({
    queryKey: reservationQueryKey,
    queryFn: async () => {
      const { data } = await api.get<Paginated<Reservation>>(`/reservations/me?book_id=${id}&size=100`)
      return data
    },
    enabled: Number.isFinite(id) && canReserve,
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

  const { data: similarBooks, isLoading: similarLoading } = useQuery({
    queryKey: ['books', 'recommendations', book?.id],
    queryFn: async () => {
      const { data } = await api.get(`/books/${id}/recommendations?limit=16`)
      if (Array.isArray(data)) return data as Book[]
      if (data && Array.isArray((data as { items?: unknown }).items)) return (data as Paginated<Book>).items as Book[]
      return (data as Book[]) ?? []
    },
    staleTime: 1000 * 60 * 5,
    enabled: Number.isFinite(id) && !!book?.id,
  })

  const availableCopies = useMemo(
    () => (copiesPage?.items ?? []).filter((c) => c.state === 'available'),
    [copiesPage],
  )
  const copies = copiesPage?.items ?? []
  const available = availableCopies.length
  const borrowed = copies.filter((c) => c.state === 'borrowed').length
  const currentReservation = useMemo(
    () => reservationsPage?.items.find((reservation) => (
      reservation.status === 'active' || reservation.status === 'ready'
    )),
    [reservationsPage],
  )

  const closeReservationConfirmation = useCallback(() => {
    setReservationDialogOpen(false)
    setReservationErrorMessage(null)
    window.requestAnimationFrame(() => reservationButtonRef.current?.focus())
  }, [])

  useEffect(() => {
    if (!shouldFocusReservationLinkRef.current || !currentReservation) return
    window.requestAnimationFrame(() => reservationLinkRef.current?.focus())
    shouldFocusReservationLinkRef.current = false
  }, [currentReservation])

  useEffect(() => {
    if (!shouldFocusAvailabilityRef.current || available === 0) return
    window.requestAnimationFrame(() => availabilityNoticeRef.current?.focus())
    shouldFocusAvailabilityRef.current = false
  }, [available])

  const createReservation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/reservations/', { book_id: id })
      return data
    },
    onSuccess: async () => {
      const message = 'Reserva criada. Você entrou na fila de espera deste livro.'
      setReservationDialogOpen(false)
      setReservationErrorMessage(null)
      setReservationFeedback({ type: 'success', message })
      shouldFocusReservationLinkRef.current = true
      await announce(message, 'polite')
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['reservations'] }),
        qc.invalidateQueries({ queryKey: ['copies', id] }),
        qc.invalidateQueries({ queryKey: ['book', id] }),
        qc.refetchQueries({ queryKey: reservationQueryKey }),
      ])
    },
    onError: async (e: unknown) => {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      if (detail === 'There are available copies; reservation not needed') {
        const message = 'O livro agora está disponível para empréstimo.'
        setReservationDialogOpen(false)
        setReservationErrorMessage(null)
        setReservationFeedback({ type: 'info', message })
        shouldFocusAvailabilityRef.current = true
        await announce(message, 'assertive')
        await Promise.all([
          qc.invalidateQueries({ queryKey: ['copies', id] }),
          qc.invalidateQueries({ queryKey: ['book', id] }),
          qc.refetchQueries({ queryKey: ['copies', id] }),
          qc.refetchQueries({ queryKey: reservationQueryKey }),
        ])
        return
      }

      const message = detail === 'Active reservation already exists'
        ? 'Você já possui uma reserva ativa para este livro.'
        : 'Não foi possível criar a reserva. Tente novamente.'
      setReservationErrorMessage(message)
      await announce(message, 'assertive')

      if (detail === 'Active reservation already exists') {
        setReservationDialogOpen(false)
        shouldFocusReservationLinkRef.current = true
        await Promise.all([
          qc.invalidateQueries({ queryKey: ['reservations'] }),
          qc.refetchQueries({ queryKey: reservationQueryKey }),
        ])
      }
    },
  })

  const copyCode = useMemo(() => {
    const map = new Map((copiesPage?.items ?? []).map((c) => [c.id, c.code]))
    return (copyIdNum: number) => map.get(copyIdNum) ?? String(copyIdNum)
  }, [copiesPage])
  const userLabel = useMemo(() => {
    const map = new Map((usersPage?.items ?? []).map((u) => [u.id, u.username]))
    return (userIdNum: number) => map.get(userIdNum) ?? String(userIdNum)
  }, [usersPage])

  const { resolved } = useTheme()
  // otimizado: proxy 40px + cache FastAverageColor + hash memoizado; sem placeholder neutro (transição suave)
  const proxiedForAvg = useMemo(() => getCoverProxyUrl(book?.cover_url ?? null, 40), [book?.cover_url])
  const { color: avgHex } = useAverageColor(proxiedForAvg ?? null, !!book?.cover_url)
  const baseHue = useMemo(() => {
    if (avgHex) {
      const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(avgHex)
      if (m) {
        const r = parseInt(m[1], 16) / 255, g = parseInt(m[2], 16) / 255, b = parseInt(m[3], 16) / 255
        const max = Math.max(r, g, b), min = Math.min(r, g, b)
        if (max !== min) {
          const d = max - min
          let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
          h *= 60
          if (h < 0) h += 360
          return Math.round(h)
        }
        return 0
      }
    }
    const key = book?.title ?? 'fallback'
    let hash = 0
    const s = (key ?? '').trim() || 'fallback'
    for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash)
    return Math.abs(hash) % 360
  }, [avgHex, book?.title])
  const cardBg = useMemo(() => (resolved === 'dark' ? `hsl(${baseHue}, 65%, 20%)` : `hsl(${baseHue}, 35%, 96%)`), [baseHue, resolved])
  const pageBg = useMemo(() => (resolved === 'dark' ? `hsl(${baseHue}, 65%, 14%)` : `hsl(${baseHue}, 35%, 90%)`), [baseHue, resolved])

  const isDark = resolved === 'dark'

  // fundo estático da página (main + footer) baseado na capa, sem afetar nav - com transição sincronizada
  useEffect(() => {
    const main = document.getElementById('main-content') as HTMLElement | null
    const footer = document.querySelector('footer') as HTMLElement | null
    const prevMainBg = main?.style.background ?? ''
    const prevMainBgColor = main?.style.backgroundColor ?? ''
    const prevFooterBg = footer?.style.background ?? ''
    const prevFooterBorder = footer?.style.borderTopColor ?? ''
    const prevMainTransition = main?.style.transition ?? ''
    const prevFooterTransition = footer?.style.transition ?? ''
    const prevBodyTransition = document.body.style.transition
    const transition = 'background-color 0.3s ease, background 0.3s ease, border-color 0.3s ease'
    if (main) {
      main.style.transition = transition
      main.style.background = pageBg
    }
    if (footer) {
      footer.style.transition = transition
      footer.style.background = pageBg
      footer.style.borderTopColor = 'transparent'
    }
    const prevBodyBg = document.body.style.background
    document.body.style.transition = transition
    document.body.style.background = pageBg
    return () => {
      if (main) {
        main.style.background = prevMainBg
        main.style.backgroundColor = prevMainBgColor
        main.style.transition = prevMainTransition
      }
      if (footer) {
        footer.style.background = prevFooterBg
        footer.style.borderTopColor = prevFooterBorder
        footer.style.transition = prevFooterTransition
      }
      document.body.style.background = prevBodyBg
      document.body.style.transition = prevBodyTransition
    }
  }, [pageBg])

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

  const closeLoanConfirmation = useCallback(() => {
    setLoanConfirmOpen(false)
    window.requestAnimationFrame(() => loanTriggerRef.current?.focus())
  }, [])

  useEffect(() => {
    if (!loanConfirmOpen) return
    loanCancelRef.current?.focus()
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeLoanConfirmation()
        return
      }
      if (e.key !== 'Tab') return
      const dialog = document.getElementById('loan-confirmation-dialog')
      if (!dialog) return
      const focusable = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button:not([disabled])'))
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [closeLoanConfirmation, loanConfirmOpen])

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

  if (book?.cover_url && !avgHex) {
    return (
      <div className="mx-auto max-w-4xl flex flex-col gap-6" aria-busy="true" aria-live="polite">
        <div className="h-12 w-40 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
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
        <button type="button" onClick={handleBack} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm sm:text-[15px] font-medium shadow-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-[var(--color-primary)] dark:hover:text-white transition-colors focus-visible:outline-3 focus-visible:outline-[var(--color-focus)] focus-visible:outline-offset-2 mt-4">
          <ArrowLeft className="h-5 w-5 shrink-0" aria-hidden="true" /> Voltar ao acervo
        </button>
      </div>
    )
  }

  return (
    <div style={{ background: pageBg, transition: 'background-color 0.3s ease, background 0.3s ease' }} className="w-full">
      <div className="mx-auto max-w-full !max-w-4xl w-full overflow-visible flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={handleBack} aria-label="Voltar ao acervo" className="inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[48px] rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm sm:text-base font-semibold shadow-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-[var(--color-primary)] dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-500 transition-colors focus-visible:outline-3 focus-visible:outline-[var(--color-focus)] focus-visible:outline-offset-2">
            <ArrowLeft className="h-5 w-5 shrink-0" aria-hidden="true" /> Voltar ao acervo
          </button>

      {canManage && (
        <div
          className="flex flex-wrap items-center justify-end gap-3 ml-auto"
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
            variant="primary"
            type="button"
            ref={loanTriggerRef}
            aria-label={`Emprestar livro ${book.title}`}
            onClick={() => {
              setLoanConfirmOpen(true)
            }}
          >
            <Hand className="h-4 w-4 mr-2" aria-hidden="true" /> Emprestar
          </Button>
        </div>
      )}
      {canReserve && !reservationsLoading && reservationsPage !== undefined && (
        currentReservation ? (
          <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
            <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>
              {currentReservation.status === 'ready'
                ? 'Sua reserva está pronta para retirada.'
                : 'Sua reserva está na fila de espera.'}
            </p>
            <Link
              ref={reservationLinkRef}
              to="/reservas"
              className="inline-flex items-center justify-center font-medium rounded-md transition-colors min-h-[44px] px-4 py-2 text-sm !bg-blue-600 !text-white hover:!bg-blue-700 !border-blue-600 dark:!bg-blue-600 dark:!text-white dark:hover:!bg-blue-700 focus-visible:outline-3 focus-visible:outline-[var(--color-focus)] focus-visible:outline-offset-2"
            >
              Ver minha reserva
            </Link>
          </div>
        ) : copiesPage !== undefined && available === 0 ? (
          <Button
            variant="primary"
            ref={reservationButtonRef}
            type="button"
            aria-label={`Reservar livro ${book.title}`}
            className="ml-auto"
            onClick={() => {
              setReservationFeedback(null)
              setReservationErrorMessage(null)
              setReservationDialogOpen(true)
            }}
          >
            <Hand className="h-4 w-4 mr-2" aria-hidden="true" /> Reservar
          </Button>
        ) : null
      )}
        </div>

      {reservationFeedback && (
        <p className={`rounded-md border px-3 py-2 text-sm ${reservationFeedback.type === 'success'
          ? (isDark ? 'border-emerald-300/40 bg-emerald-400/10 text-emerald-100' : 'border-emerald-200 bg-emerald-50 text-emerald-800')
          : (isDark ? 'border-sky-300/40 bg-sky-400/10 text-sky-100' : 'border-sky-200 bg-sky-50 text-sky-800')}`}>
          {reservationFeedback.message}
        </p>
      )}

      <div className="grid gap-6 md:grid-cols-[220px_1fr] max-w-full overflow-visible py-6 px-2 -mx-2">
        {book.cover_url ? (
          <div
            role="button"
            tabIndex={0}
            aria-label="Ampliar capa do livro"
            className="group relative w-fit h-fit mx-auto sm:mx-0 aspect-[2/3] w-full max-w-[280px] sm:w-[220px] sm:max-w-none border border-transparent bg-transparent cursor-pointer cursor-zoom-in focus-visible:outline-3 focus-visible:outline-[var(--color-focus)] focus-visible:outline-offset-2 transition-all duration-300 ease-out hover:scale-[1.03] hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(59,130,246,0.15)] hover:z-10 will-change-transform overflow-visible"
            onClick={openLightbox}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                openLightbox()
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
            onClick={openLightbox}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                openLightbox()
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
          <Card className={`relative overflow-hidden ${isDark ? 'border-white/20 text-white' : 'border-slate-200 text-slate-800'}`} style={{ background: cardBg }}>
            <div className={`absolute inset-0 pointer-events-none ${isDark ? 'bg-black/10' : 'bg-white/20'}`} aria-hidden="true" />
            <CardHeader className={`relative ${isDark ? 'border-white/15' : 'border-slate-200'} space-y-2`}>
              <h2 className={`font-semibold flex items-center gap-2 ${isDark ? 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]' : 'text-slate-800'}`}>
                <BookOpen className={`h-5 w-5 ${isDark ? 'text-white/90' : 'text-slate-600'}`} aria-hidden="true" /> Sobre o livro
              </h2>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <h1 className={`text-xl sm:text-2xl font-bold leading-tight ${isDark ? 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]' : 'text-slate-900'}`}>{book.title}</h1>
                <Badge tone={bookStateTone(book.derived_state)} className="cursor-pointer" role="button" tabIndex={0} onClick={() => navigate(`/acervo?state=${book.derived_state}`)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/acervo?state=${book.derived_state}`) } }} title={`Buscar por ${bookStateLabel(book.derived_state)}`}>
                  {bookStateLabel(book.derived_state)}
                </Badge>
              </div>
              <p className={`text-sm leading-relaxed mt-3 ${isDark ? 'text-white/90 drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]' : 'text-slate-600'}`}>
                {book.description || 'Sem descrição disponível.'}
              </p>
            </CardHeader>
            <CardBody className="relative">
              <dl className={`grid gap-4 text-sm ${isDark ? 'border-white/15' : 'border-slate-200'}`}>
                <div className="grid grid-cols-3 gap-2">
                  <dt className={isDark ? 'text-white/60' : 'text-slate-500'}>ISBN</dt>
                  <dd className={`col-span-2 font-mono break-all ${isDark ? 'text-white drop-shadow-sm' : 'text-slate-800'}`}>{book.isbn ?? '—'}</dd>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <dt className={isDark ? 'text-white/60' : 'text-slate-500'}>Lançamento</dt>
                  <dd className={isDark ? 'col-span-2 text-white drop-shadow-sm' : 'col-span-2 text-slate-800'}>{book.published_date ? new Date(book.published_date).toLocaleDateString('pt-BR') : '—'}</dd>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <dt className={isDark ? 'text-white/60' : 'text-slate-500'}>Cadastrado em</dt>
                  <dd className={isDark ? 'col-span-2 text-white drop-shadow-sm' : 'col-span-2 text-slate-800'}>{book.created_at ? new Date(book.created_at).toLocaleDateString('pt-BR') : '—'}</dd>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <dt className={isDark ? 'text-white/60' : 'text-slate-500'}>Autores</dt>
                  <dd className="col-span-2 flex flex-wrap items-center gap-1.5">
                    {book.authors?.length ? book.authors.map((a) => {
                      const bg = isDark ? stringToHsl(a.name, 65, 28) : stringToHsl(a.name, 65, 82)
                      const color = isDark ? '#fff' : stringToHsl(a.name, 65, 22)
                      const border = isDark ? 'rgba(255,255,255,0.15)' : stringToHsl(a.name, 65, 70)
                      return <span key={a.id} title={a.name} style={{ background: bg, color, borderColor: border }} className="inline-flex items-center justify-center h-6 px-3 rounded-full text-xs font-medium leading-none whitespace-nowrap border shrink-0 transition-colors duration-200 hover:brightness-110 hover:shadow-sm cursor-pointer" role="button" tabIndex={0} onClick={() => navigate(`/acervo?author_id=${a.id}`)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/acervo?author_id=${a.id}`) } }}>{a.name}</span>
                    }) : <span className={isDark ? 'text-white/50' : 'text-slate-400'}>—</span>}
                  </dd>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <dt className={isDark ? 'text-white/60' : 'text-slate-500'}>Gêneros</dt>
                  <dd className="col-span-2 flex flex-wrap items-center gap-1.5">
                    {book.genres?.length ? book.genres.map((g) => {
                      const bg = isDark ? stringToHsl(g.name, 75, 32) : stringToHsl(g.name, 75, 45)
                      return <span key={g.id} title={g.name} style={{ background: bg, color: '#fff', borderColor: isDark ? 'rgba(255,255,255,0.15)' : stringToHsl(g.name, 75, 30) }} className="inline-flex items-center justify-center h-6 px-3 rounded-full text-xs font-medium leading-none whitespace-nowrap border shrink-0 transition-colors duration-200 hover:brightness-110 hover:shadow-sm cursor-pointer" role="button" tabIndex={0} onClick={() => navigate(`/acervo?genre_id=${g.id}`)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/acervo?genre_id=${g.id}`) } }}>{g.name}</span>
                    }) : <span className={isDark ? 'text-white/50' : 'text-slate-400'}>—</span>}
                  </dd>
                </div>
              </dl>
            </CardBody>
          </Card>

          <Card className={`relative overflow-hidden ${isDark ? 'border-white/20 text-white' : 'border-slate-200 text-slate-800'}`} style={{ background: cardBg }}>
            <div className={`absolute inset-0 pointer-events-none ${isDark ? 'bg-black/10' : 'bg-white/20'}`} aria-hidden="true" />
            <CardHeader className={`relative ${isDark ? 'border-white/15' : 'border-slate-200'}`}>
              <h2 className={`font-semibold ${isDark ? 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]' : 'text-slate-800'}`}>Exemplares</h2>
            </CardHeader>
            <CardBody className="relative">
              {available > 0 && (
                <p ref={availabilityNoticeRef} tabIndex={-1} className={`mb-4 rounded-md border px-3 py-2 text-sm font-medium outline-none focus-visible:outline-3 focus-visible:outline-[var(--color-focus)] focus-visible:outline-offset-2 ${isDark ? 'border-emerald-300/40 bg-emerald-400/10 text-emerald-100' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
                  Este livro está disponível para empréstimo.
                </p>
              )}
              {copies.length === 0 ? (
                <p className={`text-sm ${isDark ? 'text-white/70' : 'text-slate-500'}`}>Nenhum exemplar cadastrado para este livro nesta escola.</p>
              ) : (
                <>
                  <dl className="grid grid-cols-3 gap-3 text-center mb-4">
                    <div className={`rounded-lg border backdrop-blur-sm p-3 ${isDark ? 'border-white/15 bg-white/10' : 'border-slate-200 bg-slate-50'}`}>
                      <dt className={`text-xs uppercase ${isDark ? 'text-white/60' : 'text-slate-500'}`}>Total</dt>
                      <dd className={`mt-1 text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{copies.length}</dd>
                    </div>
                    <div className={`rounded-lg border backdrop-blur-sm p-3 ${isDark ? 'border-white/15 bg-white/10' : 'border-slate-200 bg-slate-50'}`}>
                      <dt className={`text-xs uppercase ${isDark ? 'text-white/70' : 'text-slate-500'}`}>Disponíveis</dt>
                      <dd className={`mt-1 text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{available}</dd>
                    </div>
                    <div className={`rounded-lg border backdrop-blur-sm p-3 ${isDark ? 'border-white/15 bg-white/10' : 'border-slate-200 bg-slate-50'}`}>
                      <dt className={`text-xs uppercase ${isDark ? 'text-white/70' : 'text-slate-500'}`}>Emprestados</dt>
                      <dd className={`mt-1 text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{borrowed}</dd>
                    </div>
                  </dl>
                  <ul className={`divide-y ${isDark ? 'divide-white/15' : 'divide-slate-200'}`} role="list">
                    {copies.map((c) => (
                      <li key={c.id} className="flex items-center justify-between py-2.5 text-sm">
                        <span className={`font-mono ${isDark ? 'text-white/90' : 'text-slate-700'}`}>{c.code}</span>
                        <span className="flex items-center gap-2">
                          <Badge tone={c.condition === 'new' ? 'success' : c.condition === 'bad' ? 'danger' : c.condition === 'fair' || c.condition === 'poor' ? 'warning' : 'neutral'} className="cursor-pointer" role="button" tabIndex={0} onClick={() => navigate(`/acervo?q=${encodeURIComponent(bookConditionLabel(c.condition))}`)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/acervo?q=${encodeURIComponent(bookConditionLabel(c.condition))}`) } }} title={`Buscar por ${bookConditionLabel(c.condition)}`}>
                            {bookConditionLabel(c.condition)}
                          </Badge>
                          <Badge tone={bookStateTone(c.state)} className="cursor-pointer" role="button" tabIndex={0} onClick={() => navigate(`/acervo?state=${c.state}`)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/acervo?state=${c.state}`) } }} title={`Buscar por ${bookStateLabel(c.state)}`}>
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

      <Card className={`relative overflow-hidden ${isDark ? 'border-white/20 text-white' : 'border-slate-200 text-slate-800'}`} style={{ background: cardBg }}>
        <div className={`absolute inset-0 pointer-events-none ${isDark ? 'bg-black/10' : 'bg-white/20'}`} aria-hidden="true" />
        <CardHeader className={`relative ${isDark ? 'border-white/15' : 'border-slate-200'}`}>
          <h2 className={`font-semibold flex items-center gap-2 ${isDark ? 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]' : 'text-slate-800'}`} aria-live="polite">
            <Undo2 className={`h-5 w-5 ${isDark ? 'text-white/90' : 'text-slate-600'}`} aria-hidden="true" /> Devoluções — empréstimos ativos deste livro
          </h2>
        </CardHeader>
        <CardBody className="relative">
          {loansLoading && <p aria-live="polite" className={isDark ? 'text-white/80' : 'text-slate-500'}>Carregando empréstimos...</p>}
          {!loansLoading && activeLoans && activeLoans.length === 0 && (
            <p className={`text-sm py-4 text-center ${isDark ? 'text-white/70' : 'text-slate-500'}`}>Nenhum empréstimo ativo para este livro.</p>
          )}
          {activeLoans && activeLoans.length > 0 && (
            <ul className={`divide-y ${isDark ? 'divide-white/15' : 'divide-slate-200'}`} role="list">
              {activeLoans.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="text-sm">
                    <p className={isDark ? 'text-white/90' : 'text-slate-800'}>
                      <span className="font-mono">#{l.id}</span> · Exemplar{' '}
                      <span className="font-mono">{copyCode(l.copy_id)}</span> · {userLabel(l.user_id)}
                    </p>
                    <p className={`text-xs mt-0.5 ${isDark ? 'text-white/60' : 'text-slate-500'}`}>
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

      {similarLoading ? (
        <Card className={`relative overflow-visible ${isDark ? 'border-white/20 text-white' : 'border-slate-200 text-slate-800'}`} style={{ background: cardBg }}>
          <div className={`absolute inset-0 pointer-events-none rounded-xl overflow-hidden ${isDark ? 'bg-black/10' : 'bg-white/20'}`} aria-hidden="true" />
          <CardBody className="relative overflow-visible">
            <div className="flex gap-4 overflow-hidden" aria-busy="true" aria-live="polite">
              {Array.from({ length: 16 }).map((_, i) => (
                <div key={i} className="w-[160px] sm:w-[180px] lg:w-[200px] shrink-0 flex flex-col gap-2">
                  <div className="aspect-[2/3] rounded-xl bg-white/20 dark:bg-white/10 animate-pulse" />
                  <div className="h-3 rounded bg-white/20 dark:bg-white/10 animate-pulse" />
                  <div className="h-3 w-2/3 rounded bg-white/20 dark:bg-white/10 animate-pulse" />
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      ) : similarBooks && similarBooks.length > 0 ? (
        <Card className={`relative overflow-visible ${isDark ? 'border-white/20 text-white' : 'border-slate-200 text-slate-800'}`} style={{ background: cardBg }}>
          <div className={`absolute inset-0 pointer-events-none rounded-xl overflow-hidden ${isDark ? 'bg-black/10' : 'bg-white/20'}`} aria-hidden="true" />
          <CardBody className="relative overflow-visible">
            <Carousel
              title="Você também pode gostar"
              items={similarBooks}
              circular
              renderItem={(b, idx) => (
                <div className="w-[160px] sm:w-[180px] lg:w-[200px] shrink-0">
                  <GridCard book={b as any} index={idx} portalHover />
                </div>
              )}
            />
          </CardBody>
        </Card>
      ) : null}

      {loanConfirmOpen && canManage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="loan-confirmation-title"
          aria-describedby="loan-confirmation-description"
          id="loan-confirmation-dialog"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeLoanConfirmation()
          }}
        >
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-800 shadow-xl">
            <CardHeader>
              <h2 id="loan-confirmation-title" className="text-lg font-semibold">Emprestar livro {book.title}?</h2>
            </CardHeader>
            <CardBody>
              <p id="loan-confirmation-description" className="text-sm text-slate-600 dark:text-slate-300">
                Você será redirecionado para preencher os dados restantes do empréstimo.
              </p>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  ref={loanCancelRef}
                  type="button"
                  className="inline-flex items-center justify-center font-medium rounded-md transition-colors min-h-[44px] min-w-[44px] px-4 py-2 text-sm bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 focus-visible:outline-3 focus-visible:outline-[var(--color-focus)] focus-visible:outline-offset-2"
                  onClick={closeLoanConfirmation}
                >
                  Cancelar
                </button>
                <Button
                  type="button"
                  aria-label={`Continuar empréstimo do livro ${book.title}`}
                  onClick={() => navigate(`/emprestimos?book_id=${book.id}`)}
                >
                  Continuar
                </Button>
              </div>
            </CardBody>
          </div>
        </div>
      )}

      <ReservationConfirmDialog
        open={reservationDialogOpen}
        bookTitle={book.title}
        pending={createReservation.isPending}
        errorMessage={reservationErrorMessage}
        onClose={closeReservationConfirmation}
        onConfirm={() => {
          if (createReservation.isPending) return
          setReservationErrorMessage(null)
          createReservation.mutate()
        }}
        cancelRef={reservationCancelRef}
        confirmRef={reservationConfirmRef}
      />

      <AnimatePresence>
        {lightboxOpen && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Capa ampliada"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeLightbox()
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <motion.button
              type="button"
              aria-label="Fechar"
              onClick={closeLightbox}
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
    </div>
  )
}
