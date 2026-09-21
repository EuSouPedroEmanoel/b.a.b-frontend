import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import api from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'
import { bookConditionLabel, bookStateLabel, bookStateTone } from '@/lib/bookStates'
import { useAuth } from '@/hooks/useAuth'
import { useAnnouncer } from '@/components/feedback/LiveRegionContext'
import { UndoSnackbar } from '@/components/feedback/UndoSnackbar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ModalDialog } from '@/components/ui/ModalDialog'
import { Pagination } from '@/components/ui/Pagination'
import { PageDescription } from '@/components/ui/PageDescription'
import { Select } from '@/components/ui/Select'

type Copy = { id: number; code: string; state: string; condition: string; book_id: number; school_id: number }
type BookLite = { id: number; title: string }
type Paginated<T> = { items: T[]; total: number; page: number; size: number; pages: number }
type Change = { copy: Copy; state: 'archived' | 'lost' | 'available'; justification: string }

export function CopiesPage() {
  const [page, setPage] = useState(1)
  const [changing, setChanging] = useState<Copy | null>(null)
  const [target, setTarget] = useState<'archived' | 'lost'>('archived')
  const [justification, setJustification] = useState('')
  const [confirming, setConfirming] = useState<Change | null>(null)
  const [undo, setUndo] = useState<Change | null>(null)
  const [formError, setFormError] = useState('')
  const qc = useQueryClient()
  const announce = useAnnouncer()
  const justificationRef = useRef<HTMLTextAreaElement>(null)
  const { user } = useAuth()
  const canManage = user?.role === 'librarian' || user?.role === 'school_admin'
  const { data, isLoading, isError } = useQuery({ queryKey: ['copies', page], queryFn: async () => (await api.get<Paginated<Copy>>(`/copies/?page=${page}&size=10`)).data })
  const { data: booksData } = useQuery({ queryKey: ['books-map'], queryFn: async () => (await api.get<Paginated<BookLite>>('/books/?size=100')).data })
  const titleById = new Map<number, string>((booksData?.items ?? []).map((b) => [b.id, b.title]))
  const invalidate = () => void qc.invalidateQueries({ queryKey: ['copies'] })
  const changeMutation = useMutation({
    mutationFn: async (change: Change) => (await api.post<Copy>(`/copies/${change.copy.id}/situation`, { state: change.state, justification: change.justification || undefined })).data,
    onSuccess: (_, change) => { setConfirming(null); setChanging(null); setUndo(change); invalidate(); announce(change.state === 'archived' ? 'Exemplar arquivado.' : change.state === 'lost' ? 'Exemplar marcado como perdido.' : 'Exemplar reintroduzido.', 'polite') },
    onError: (error) => { const message = getErrorMessage(error, 'Não foi possível alterar a situação do exemplar.'); setFormError(message); announce(message, 'assertive') },
  })
  const undoMutation = useMutation({
    mutationFn: async (change: Change) => (await api.post<Copy>(`/copies/${change.copy.id}/situation/undo`)).data,
    onSuccess: () => { setUndo(null); invalidate(); announce('Situação anterior do exemplar restaurada.', 'polite') },
    onError: (error) => announce(getErrorMessage(error, 'Não foi possível desfazer a alteração.'), 'assertive'),
  })
  const openChange = (copy: Copy) => { setChanging(copy); setTarget('archived'); setJustification(''); setFormError('') }
  const continueChange = () => {
    if (!changing) return
    if (!justification.trim()) { setFormError('Informe uma justificativa.'); announce('Informe uma justificativa.', 'assertive'); justificationRef.current?.focus(); return }
    setConfirming({ copy: changing, state: target, justification: justification.trim() })
  }
  const reintroduce = (copy: Copy) => setConfirming({ copy, state: 'available', justification: '' })
  const confirmationText = confirming?.state === 'archived'
    ? 'O exemplar deixará de participar dos fluxos operacionais normais. O registro e o histórico serão preservados, e ele poderá ser reintroduzido posteriormente.'
    : confirming?.state === 'lost'
      ? 'O exemplar será registrado como perdido e deixará de estar disponível para novos fluxos operacionais. O histórico será preservado; se for encontrado, poderá ser reintroduzido ao acervo.'
      : 'O mesmo exemplar voltará a participar normalmente do acervo e dos fluxos permitidos. Seu identificador e histórico serão preservados.'
  const confirmationLabel = confirming?.state === 'archived' ? 'Confirmar arquivamento' : confirming?.state === 'lost' ? 'Confirmar como perdido' : 'Confirmar reintrodução'

  return <div className="flex flex-col gap-6">
    <header><h1 className="text-2xl sm:text-3xl font-bold">Exemplares</h1><PageDescription>Exemplares físicos por escola — código único por unidade, com situação e conservação.</PageDescription></header>
    {isLoading && <p aria-live="polite">Carregando exemplares…</p>}
    {isError && <div role="alert" className="rounded-md bg-red-50 border border-red-200 p-4 text-sm text-red-800">Erro ao carregar exemplares. Verifique login e permissão.</div>}
    {data && <>
      <div className="hidden @container max-w-full overflow-x-auto overscroll-x-contain rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 md:block">
        <table className="w-full min-w-0 text-sm">
          <caption className="sr-only">Exemplares por código, estado e ações administrativas</caption>
          <thead className="bg-slate-50 dark:bg-slate-700/50"><tr><th scope="col" className="px-4 py-3 text-left font-semibold">Código</th><th scope="col" className="px-4 py-3 text-left font-semibold">Livro</th><th scope="col" className="px-4 py-3 text-left font-semibold">Situação</th><th scope="col" className="px-4 py-3 text-left font-semibold">Condição</th>{canManage && <th scope="col" className="px-4 py-3 text-right font-semibold">Ações</th>}</tr></thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">{data.items.map((copy) => <tr key={copy.id}><td className="px-4 py-3 align-top font-mono">{copy.code}</td><td className="px-4 py-3 align-top">{titleById.get(copy.book_id) ?? `Livro #${copy.book_id}`}</td><td className="px-4 py-3 align-top"><Badge tone={bookStateTone(copy.state)}>{bookStateLabel(copy.state)}</Badge></td><td className="px-4 py-3 align-top"><Badge tone="info">{bookConditionLabel(copy.condition)}</Badge></td>{canManage && <td className="px-4 py-3 text-right align-top">{copy.state === 'archived' || copy.state === 'lost' ? <Button size="sm" variant="secondary" onClick={() => reintroduce(copy)} aria-label={`Reintroduzir exemplar ${copy.code}`}>Reintroduzir exemplar</Button> : <Button size="sm" variant="secondary" className="!px-3 @max-lg:!px-2.5" onClick={() => openChange(copy)} aria-label={`Alterar situação do exemplar ${copy.code}`}><RefreshCw className="hidden h-4 w-4 @max-lg:block" aria-hidden="true" /><span className="@max-lg:hidden">Alterar situação</span></Button>}</td>}</tr>)}</tbody>
        </table>
      </div>
      <ul className="grid gap-3 md:hidden" aria-label="Exemplares cadastrados">
        {data.items.map((copy) => <li key={copy.id} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          <div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><p className="font-mono text-sm font-semibold break-all">{copy.code}</p><p className="mt-1 break-words text-sm">{titleById.get(copy.book_id) ?? `Livro #${copy.book_id}`}</p></div><Badge tone={bookStateTone(copy.state)}>{bookStateLabel(copy.state)}</Badge></div>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">Condição: <span className="font-medium text-slate-900 dark:text-slate-100">{bookConditionLabel(copy.condition)}</span></p>
          {canManage && <div className="mt-3">{copy.state === 'archived' || copy.state === 'lost' ? <Button size="sm" variant="secondary" className="w-full" onClick={() => reintroduce(copy)} aria-label={`Reintroduzir exemplar ${copy.code}`}>Reintroduzir exemplar</Button> : <Button size="sm" variant="secondary" className="w-full" onClick={() => openChange(copy)} aria-label={`Alterar situação do exemplar ${copy.code}`}><RefreshCw className="h-4 w-4" aria-hidden="true" /> Alterar situação</Button>}</div>}
        </li>)}
      </ul>
      <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />
    </>}
    {changing && <ModalDialog variant="form" title={`Alterar situação — exemplar ${changing.code}`} onClose={() => setChanging(null)} describedBy="copy-situation-description"><div id="copy-situation-description" className="grid gap-4"><p className="text-sm text-slate-600 dark:text-slate-300">Situação atual: {bookStateLabel(changing.state)}.</p><Select label="Nova situação" value={target} onChange={(value) => setTarget(value as 'archived' | 'lost')} options={[{ value: 'archived', label: 'Arquivar' }, { value: 'lost', label: 'Marcar como perdido' }]} /><div><label htmlFor="copy-justification" className="text-sm font-medium text-slate-700 dark:text-slate-200">Justificativa</label><textarea ref={justificationRef} id="copy-justification" required value={justification} onChange={(event) => setJustification(event.target.value)} className="mt-1.5 min-h-28 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-field)] px-3 py-2 text-sm focus-visible:outline-3 focus-visible:outline-[var(--color-focus)]" aria-describedby={formError ? 'copy-situation-error' : undefined} /></div>{formError && <p id="copy-situation-error" role="alert" className="text-sm text-red-700 dark:text-red-300">{formError}</p>}<div className="flex flex-wrap gap-3"><Button type="button" variant="blue-secondary" className="min-w-max flex-1" onClick={() => setChanging(null)}>Cancelar</Button><Button type="button" variant="danger-secondary" className="min-w-max flex-1" onClick={continueChange}>Confirmar</Button></div></div></ModalDialog>}
    {confirming && <ModalDialog title={confirmationLabel + '?'} onClose={() => !changeMutation.isPending && setConfirming(null)} describedBy="copy-confirmation-description"><div id="copy-confirmation-description" className="space-y-3 text-sm text-slate-600 dark:text-slate-300"><p><strong>Exemplar {confirming.copy.code}</strong></p><p>{confirmationText}</p></div><div className="mt-6 flex flex-wrap gap-3"><Button type="button" variant="blue-secondary" className="min-w-max flex-1" onClick={() => setConfirming(null)} disabled={changeMutation.isPending}>Cancelar</Button><Button type="button" variant="danger-secondary" className="min-w-max flex-1" onClick={() => changeMutation.mutate(confirming)} disabled={changeMutation.isPending} aria-busy={changeMutation.isPending}>{changeMutation.isPending ? 'Confirmando…' : confirmationLabel}</Button></div></ModalDialog>}
    {undo && <UndoSnackbar message={undo.state === 'archived' ? 'Exemplar arquivado.' : undo.state === 'lost' ? 'Exemplar marcado como perdido.' : 'Exemplar reintroduzido.'} onUndo={() => undoMutation.mutate(undo)} onClose={() => setUndo(null)} />}
  </div>
}
