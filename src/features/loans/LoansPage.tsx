import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { useAnnouncer } from '@/components/feedback/LiveRegion'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Pagination } from '@/components/ui/Pagination'

type Loan = { id: number; copy_id: number; user_id: number; school_id: number; status: string; borrowed_at: string; due_date: string; returned_at: string | null; late_days: number }
type Paginated<T> = { items: T[]; total: number; page: number; size: number; pages: number }

export function LoansPage() {
  const [page, setPage] = useState(1)
  const [copyId, setCopyId] = useState('')
  const [userId, setUserId] = useState('')
  const announce = useAnnouncer()
  const qc = useQueryClient()

  const { data } = useQuery({
    queryKey: ['loans', page],
    queryFn: async () => {
      const { data } = await api.get<Paginated<Loan>>(`/loans/?page=${page}&size=10`)
      return data
    },
  })

  const createMut = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<Loan>('/loans/', { copy_id: Number(copyId), user_id: Number(userId) })
      return data
    },
    onSuccess: () => {
      announce('Empréstimo criado', 'polite')
      setCopyId('')
      setUserId('')
      qc.invalidateQueries({ queryKey: ['loans'] })
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Erro ao emprestar'
      announce(msg, 'assertive')
    },
  })

  const returnMut = useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.post<Loan>(`/loans/${id}/return`)
      return data
    },
    onSuccess: (l) => {
      announce(`Devolução concluída. Atraso: ${l.late_days} dia(s)`, 'polite')
      qc.invalidateQueries({ queryKey: ['loans'] })
    },
  })

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl sm:text-3xl font-bold">Empréstimos</h1>
        <p className="text-sm text-slate-500 mt-1">Criação por bibliotecário. Prazo calculado com penalidade por atrasos prévios.</p>
      </header>

      <Card>
        <CardHeader>
          <h2 className="font-semibold">Novo empréstimo</h2>
        </CardHeader>
        <CardBody>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!copyId || !userId) {
                announce('Informe exemplar e usuário', 'assertive')
                return
              }
              createMut.mutate()
            }}
            className="flex flex-col sm:flex-row gap-3 items-end"
          >
            <div className="flex-1 w-full">
              <Input label="ID do exemplar" type="number" inputMode="numeric" value={copyId} onChange={(e) => setCopyId(e.target.value)} required />
            </div>
            <div className="flex-1 w-full">
              <Input label="ID do usuário" type="number" inputMode="numeric" value={userId} onChange={(e) => setUserId(e.target.value)} required />
            </div>
            <Button type="submit" disabled={createMut.isPending} className="w-full sm:w-auto">
              {createMut.isPending ? 'Emprestando…' : 'Emprestar'}
            </Button>
          </form>
        </CardBody>
      </Card>

      {data && (
        <>
          <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
            <table className="w-full text-sm">
              <caption className="sr-only">Empréstimos ativos e histórico</caption>
              <thead className="bg-slate-50 dark:bg-slate-700/50">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">
                    ID
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">
                    Exemplar
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">
                    Usuário
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">
                    Vencimento
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {data.items.map((l) => (
                  <tr key={l.id}>
                    <td className="px-4 py-3">#{l.id}</td>
                    <td className="px-4 py-3">#{l.copy_id}</td>
                    <td className="px-4 py-3">#{l.user_id}</td>
                    <td className="px-4 py-3">
                      <Badge tone={l.status === 'active' ? 'warning' : l.status === 'overdue' ? 'danger' : 'success'}>{l.status}</Badge>
                      {l.late_days > 0 && <span className="ml-2 text-xs text-red-600">+{l.late_days}d</span>}
                    </td>
                    <td className="px-4 py-3 text-xs">{new Date(l.due_date).toLocaleDateString('pt-BR')}</td>
                    <td className="px-4 py-3">
                      {l.status === 'active' && (
                        <Button size="sm" variant="secondary" onClick={() => returnMut.mutate(l.id)} disabled={returnMut.isPending}>
                          Devolver
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="md:hidden grid gap-3" role="list">
            {data.items.map((l) => (
              <li key={l.id} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
                <div className="flex justify-between items-start">
                  <h3 className="font-semibold">Empréstimo #{l.id}</h3>
                  <Badge tone={l.status === 'active' ? 'warning' : 'success'}>{l.status}</Badge>
                </div>
                <p className="text-sm text-slate-500 mt-1">
                  Exemplar #{l.copy_id} → Usuário #{l.user_id}
                </p>
                <p className="text-xs text-slate-500">Vencimento: {new Date(l.due_date).toLocaleDateString('pt-BR')}</p>
                {l.status === 'active' && (
                  <Button size="sm" variant="secondary" className="mt-3 w-full" onClick={() => returnMut.mutate(l.id)}>
                    Devolver
                  </Button>
                )}
              </li>
            ))}
          </ul>

          <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />
        </>
      )}
    </div>
  )
}
