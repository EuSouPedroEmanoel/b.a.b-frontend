import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { useAnnouncer } from '@/components/feedback/LiveRegionContext'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Pagination } from '@/components/ui/Pagination'
import { CoverImage } from '@/components/ui/CoverImage'
import { PageDescription } from '@/components/ui/PageDescription'
import { ModalDialog } from '@/components/ui/ModalDialog'
import { UndoSnackbar } from '@/components/feedback/UndoSnackbar'

type Reservation = { id: number; book_id: number; user_id: number; school_id: number; status: string; created_at: string; book_title?: string; book_cover_url?: string | null; reserver_username?: string; queue_position?: number; queue_total?: number; copy_id?: number | null; internal_code?: string | null; ready_at?: string | null }
type Paginated<T> = { items: T[]; total: number; page: number; size: number; pages: number }
const MANAGE_ROLES = ['librarian', 'school_admin']
const reservationStatusLabel = (status: string) => ({
  active: 'Aguardando exemplar',
  ready: 'Pronta para retirada',
  fulfilled: 'Concluída',
  cancelled: 'Cancelada',
  expired: 'Expirada',
}[status] ?? 'Status não disponível')
const reservationStatusTone = (status: string): 'neutral' | 'success' | 'warning' | 'danger' | 'info' => ({
  active: 'info',
  ready: 'success',
  fulfilled: 'neutral',
  cancelled: 'danger',
  expired: 'warning',
} as const)[status as 'active' | 'ready' | 'fulfilled' | 'cancelled' | 'expired'] ?? 'neutral'
const getErrorMessage = (error: unknown, fallback: string) => (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? fallback
const formatDate = (date?: string | null) => date ? new Date(date).toLocaleDateString('pt-BR') : null

export function ReservationsPage() {
  const [page, setPage] = useState(1)
  const [canceling, setCanceling] = useState<Reservation | null>(null)
  const [cancelTrigger, setCancelTrigger] = useState<HTMLButtonElement | null>(null)
  const [cancelUndo, setCancelUndo] = useState<Reservation | null>(null)
  const confirmCancelRef = useRef<HTMLButtonElement>(null)
  const cancelUndoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const announce = useAnnouncer()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { user, loading } = useAuth()
  const canManage = !!user && MANAGE_ROLES.includes(user.role)
  const isSuperAdmin = user?.role === 'super_admin'
  const canViewOperationalQueue = canManage || isSuperAdmin
  const closeCancelDialog = useCallback(() => {
    setCanceling(null)
    requestAnimationFrame(() => cancelTrigger?.focus())
  }, [cancelTrigger])
  const clearCancelUndo = useCallback(() => {
    if (cancelUndoTimer.current) clearTimeout(cancelUndoTimer.current)
    cancelUndoTimer.current = null
    setCancelUndo(null)
  }, [])
  const showCancelUndo = useCallback((reservation: Reservation) => {
    if (cancelUndoTimer.current) clearTimeout(cancelUndoTimer.current)
    setCancelUndo(reservation)
    cancelUndoTimer.current = setTimeout(() => {
      cancelUndoTimer.current = null
      setCancelUndo(null)
    }, 5 * 60 * 1000)
  }, [])
  const myReservationsQuery = useQuery({ queryKey: ['reservations', 'me', page], queryFn: async () => (await api.get<Paginated<Reservation>>(`/reservations/me?page=${page}&size=10`)).data, enabled: !canManage && !!user })
  const readyQuery = useQuery({ queryKey: ['reservations', 'ready'], queryFn: async () => (await api.get<Paginated<Reservation>>('/reservations/?status=ready')).data, enabled: canViewOperationalQueue })
  const activeQuery = useQuery({ queryKey: ['reservations', 'active'], queryFn: async () => (await api.get<Paginated<Reservation>>('/reservations/?status=active')).data, enabled: canViewOperationalQueue })
  const cancelMut = useMutation({ mutationFn: async (id: number) => api.delete(`/reservations/${id}`), onSuccess: () => { const reservation = canceling; setCanceling(null); if (reservation) showCancelUndo(reservation); announce(`Reserva${reservation?.book_title ? ` de ${reservation.book_title}` : ''} cancelada`, 'polite'); void qc.invalidateQueries({ queryKey: ['reservations'] }); requestAnimationFrame(() => cancelTrigger?.focus()) }, onError: (error: unknown) => announce(`Não foi possível cancelar a reserva. ${getErrorMessage(error, 'Tente novamente.')}`, 'assertive') })
  const restoreMut = useMutation({ mutationFn: async (id: number) => api.post(`/reservations/${id}/restore`), onSuccess: () => { clearCancelUndo(); announce('Reserva restaurada.', 'polite'); void qc.invalidateQueries({ queryKey: ['reservations'] }) }, onError: (error: unknown) => announce(`Não foi possível desfazer o cancelamento. ${getErrorMessage(error, 'Tente novamente.')}`, 'assertive') })

  useEffect(() => () => clearCancelUndo(), [clearCancelUndo])

  useEffect(() => {
    if (!canceling) return
    confirmCancelRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape' && !cancelMut.isPending) closeCancelDialog() }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [canceling, cancelMut.isPending, closeCancelDialog])

  if (loading) return <p role="status" className="text-sm text-slate-600 dark:text-slate-300">Carregando reservas…</p>

  if (canViewOperationalQueue) {
    const ready = readyQuery.data?.items ?? []
    const active = activeQuery.data?.items ?? []
    return <div className="flex flex-col gap-6"><header><h1 className="text-2xl font-bold sm:text-3xl">Reservas</h1><PageDescription>Fila operacional de reservas da biblioteca.</PageDescription></header>{isSuperAdmin && <p role="status" className="rounded-md border border-blue-200 bg-blue-50 p-4 text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100">Você está consultando as reservas em modo somente leitura. Apenas bibliotecários e administradores escolares podem iniciar empréstimos ou cancelar reservas.</p>}{(readyQuery.isError || activeQuery.isError) && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">Não foi possível carregar as reservas. Atualize a página para tentar novamente.</div>}{(readyQuery.isLoading || activeQuery.isLoading) && <p role="status" className="text-sm text-slate-500">Carregando reservas…</p>}<ReservationSection title="Prontas para retirada" description="Reservas com um exemplar disponível para atendimento." empty="Não há reservas prontas para retirada." reservations={ready} kind="ready" onStart={canManage ? (reservation) => navigate(`/emprestimos?reservation_id=${reservation.id}`) : undefined} onDetails={(reservation) => navigate(`/acervo/${reservation.book_id}`)} onCancel={canManage ? (reservation, trigger) => { setCancelTrigger(trigger); setCanceling(reservation) } : undefined} readOnly={isSuperAdmin} /><ReservationSection title="Aguardando exemplar" description="Reservas em fila, aguardando a disponibilidade de um exemplar." empty="Não há reservas aguardando exemplar." reservations={active} kind="active" onDetails={(reservation) => navigate(`/acervo/${reservation.book_id}`)} onCancel={canManage ? (reservation, trigger) => { setCancelTrigger(trigger); setCanceling(reservation) } : undefined} readOnly={isSuperAdmin} />{canceling && <CancelDialog reservation={canceling} pending={cancelMut.isPending} confirmRef={confirmCancelRef} onClose={closeCancelDialog} onConfirm={() => cancelMut.mutate(canceling.id)} />}{cancelUndo && <UndoSnackbar message={`Reserva${cancelUndo.book_title ? ` de ${cancelUndo.book_title}` : ''} cancelada.`} onUndo={() => restoreMut.mutate(cancelUndo.id)} onClose={clearCancelUndo} />}</div>
  }
  const data = myReservationsQuery.data
  return <><PersonalReservationsView query={myReservationsQuery} data={data} onPageChange={setPage} onCancel={(reservation, trigger) => { setCancelTrigger(trigger); setCanceling(reservation) }} />{canceling && <CancelDialog personal reservation={canceling} pending={cancelMut.isPending} confirmRef={confirmCancelRef} onClose={closeCancelDialog} onConfirm={() => cancelMut.mutate(canceling.id)} />}{cancelUndo && <UndoSnackbar message={`Reserva${cancelUndo.book_title ? ` de ${cancelUndo.book_title}` : ''} cancelada.`} onUndo={() => restoreMut.mutate(cancelUndo.id)} onClose={clearCancelUndo} />}</>
}

function PersonalReservationsView({ query, data, onPageChange, onCancel }: { query: { isLoading: boolean; isError: boolean }; data?: Paginated<Reservation>; onPageChange: (page: number) => void; onCancel: (reservation: Reservation, trigger: HTMLButtonElement) => void }) {
  return <div className="flex flex-col gap-6"><header><h1 className="text-2xl font-bold sm:text-3xl">Minhas reservas</h1><PageDescription>Acompanhe suas reservas e sua posição na fila de espera.</PageDescription></header>{query.isError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">Não foi possível carregar suas reservas. Atualize a página para tentar novamente.</div>}{query.isLoading && <p role="status" className="text-sm text-slate-500 dark:text-slate-400">Carregando suas reservas…</p>}{data && (data.items.length === 0 ? <Card><CardBody><p className="text-sm text-slate-600 dark:text-slate-300">Você ainda não possui reservas.</p></CardBody></Card> : <><ul className="grid gap-4" role="list" aria-label="Minhas reservas">{data.items.map((reservation) => <PersonalReservationCard key={reservation.id} reservation={reservation} onCancel={onCancel} />)}</ul><Pagination page={data.page} pages={data.pages} total={data.total} onChange={onPageChange} /></>)}</div>
}

function PersonalReservationCard({ reservation, onCancel }: { reservation: Reservation; onCancel: (reservation: Reservation, trigger: HTMLButtonElement) => void }) {
  const title = reservation.book_title ?? 'Livro'
  const isQueueReservation = reservation.status === 'active' || reservation.status === 'ready'
  const canCancel = isQueueReservation
  const hasQueuePosition = isQueueReservation && reservation.queue_position != null && reservation.queue_total != null
  const hasReservedCopy = reservation.status === 'ready' && (reservation.copy_id != null || reservation.internal_code != null)
  return <li id={`reserva-${reservation.id}`}><Card><CardBody className="!p-4 sm:!p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-start"><CoverImage src={reservation.book_cover_url} title={title} alt={`Capa de ${title}`} width={88} height={132} className="h-[132px] w-[88px] shrink-0 rounded-md border border-slate-200 dark:border-slate-600" sizes="88px" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><h2 className="text-lg font-semibold">{title}</h2><Badge tone={reservationStatusTone(reservation.status)}>{reservationStatusLabel(reservation.status)}</Badge></div><dl className="mt-3 grid gap-1.5 text-sm"><div><dt className="inline text-slate-600 dark:text-slate-300">Solicitada em: </dt><dd className="inline">{formatDate(reservation.created_at) ?? 'data não informada'}</dd></div>{hasQueuePosition && <div><dt className="inline text-slate-600 dark:text-slate-300">Posição na fila: </dt><dd className="inline font-medium">{reservation.queue_position}º de {reservation.queue_total} na fila</dd></div>}{hasReservedCopy && <div><dt className="inline text-slate-600 dark:text-slate-300">Exemplar reservado: </dt><dd className="inline font-mono">{reservation.internal_code ?? 'Exemplar vinculado'}</dd></div>}{reservation.ready_at && reservation.status === 'ready' && <div><dt className="inline text-slate-600 dark:text-slate-300">Pronta desde: </dt><dd className="inline">{formatDate(reservation.ready_at)}</dd></div>}</dl><div className="mt-4 flex flex-wrap gap-2"><Link to={`/acervo/${reservation.book_id}`} aria-label={`Ver livro ${title}`} className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-3 focus-visible:outline-[var(--color-focus)] focus-visible:outline-offset-2 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white">Ver livro</Link>{canCancel && <Button size="sm" variant="danger-secondary" onClick={(event) => onCancel(reservation, event.currentTarget)} aria-label={`Cancelar reserva de ${title}`}>Cancelar reserva</Button>}</div></div></div></CardBody></Card></li>
}

function ReservationSection({ title, description, empty, reservations, kind, onStart, onDetails, onCancel, readOnly = false }: { title: string; description: string; empty: string; reservations: Reservation[]; kind: 'ready' | 'active'; onStart?: (reservation: Reservation) => void; onDetails: (reservation: Reservation) => void; onCancel?: (reservation: Reservation, trigger: HTMLButtonElement) => void; readOnly?: boolean }) {
  return <section aria-labelledby={`${kind}-reservations-title`} className={`flex flex-col gap-3 ${readOnly ? 'opacity-60' : ''}`}><div><h2 id={`${kind}-reservations-title`} className="text-xl font-semibold">{title}</h2><p className="text-sm text-slate-600 dark:text-slate-300">{description}</p></div>{reservations.length === 0 ? <Card><CardBody><p className="text-sm text-slate-600 dark:text-slate-300">{empty}</p></CardBody></Card> : <ul className="grid gap-3" role="list">{reservations.map((reservation) => { const book = reservation.book_title ?? `Livro #${reservation.book_id}`; const reader = reservation.reserver_username ?? `Usuário #${reservation.user_id}`; const hasQueuePosition = reservation.queue_position != null && reservation.queue_total != null; const hasReservedCopy = kind === 'ready' && (reservation.copy_id != null || reservation.internal_code != null); return <li key={reservation.id}><Card><CardBody className="!p-3 sm:!p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div className="flex min-w-0 flex-1 gap-3"><CoverImage src={reservation.book_cover_url} title={book} alt="" width={56} height={80} className="h-20 w-14 shrink-0 rounded-md border border-slate-200 dark:border-slate-600" sizes="56px" /><div className="min-w-0 space-y-1.5"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{book}</h3><Badge tone={kind === 'ready' ? 'success' : 'info'}>{kind === 'ready' ? 'Pronta para retirada' : 'Aguardando exemplar'}</Badge></div><p className="text-sm">Leitor: <span className="font-medium">{reader}</span></p>{hasReservedCopy && <p className="text-sm text-slate-600 dark:text-slate-300">Exemplar reservado: <span className="font-mono">{reservation.internal_code ?? 'código não informado'}</span></p>}{hasQueuePosition && <p className="text-sm font-medium">{reservation.queue_position}º de {reservation.queue_total} na fila</p>}<p className="text-sm text-slate-600 dark:text-slate-300">Solicitada em: {formatDate(reservation.created_at) ?? 'data não informada'}{kind === 'ready' && reservation.ready_at && ` · disponível desde ${formatDate(reservation.ready_at)}`}</p></div></div><div className="flex w-full flex-wrap gap-2 lg:w-auto lg:justify-end">{onStart && <Button size="sm" variant="primary" onClick={() => onStart(reservation)} aria-label={`Iniciar empréstimo de ${book} para ${reader}`}>Iniciar empréstimo</Button>}<Button size="sm" variant="secondary" onClick={() => onDetails(reservation)} aria-label={`Detalhes da reserva de ${book} para ${reader}`}>Detalhes</Button>{onCancel && <Button size="sm" variant="danger-secondary" onClick={(event) => onCancel(reservation, event.currentTarget)} aria-label={`Cancelar reserva de ${book} para ${reader}`}>Cancelar</Button>}</div></div></CardBody></Card></li> })}</ul>}</section>
}

function CancelDialog({ reservation, pending, confirmRef, onClose, onConfirm, personal = false }: { reservation: Reservation; pending: boolean; confirmRef: RefObject<HTMLButtonElement | null>; onClose: () => void; onConfirm: () => void; personal?: boolean }) {
  const title = reservation.book_title ?? `livro ${reservation.book_id}`
  const reader = reservation.reserver_username ?? 'este leitor'
  const impact = reservation.status === 'ready'
    ? 'O exemplar reservado será liberado para o próximo leitor da fila.'
    : personal
      ? 'Ao cancelar, você sairá da fila de espera desta obra e perderá seu lugar atual.'
      : 'Ao remover esta reserva, o aluno sairá da fila de espera desta obra e perderá seu lugar atual.'
  return <ModalDialog variant="compact" title="Cancelar reserva?" onClose={() => { if (!pending) onClose() }} describedBy="cancel-reservation-description"><div id="cancel-reservation-description" className="space-y-2 text-sm text-slate-600 dark:text-slate-300"><p>{personal ? `Cancelar sua reserva para ${title}?` : `Cancelar a reserva de ${reader} para ${title}?`}</p><p>{personal ? impact : reservation.status === 'ready' ? `A reserva de ${reader} está pronta para retirada. ${impact}` : impact}</p></div><div className="mt-6 flex flex-wrap gap-3"><Button type="button" variant="blue-secondary" className="min-w-max flex-1" onClick={onClose} disabled={pending}>Manter reserva</Button><Button ref={confirmRef} type="button" variant="danger-secondary" className="min-w-max flex-1" onClick={onConfirm} disabled={pending} aria-busy={pending}>{pending ? 'Cancelando…' : 'Cancelar reserva'}</Button></div></ModalDialog>
}
