import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { useAnnouncer } from '@/components/feedback/LiveRegionContext'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Pagination } from '@/components/ui/Pagination'

type Reservation = { id: number; book_id: number; user_id: number; school_id: number; status: string; created_at: string }
type Paginated<T> = { items: T[]; total: number; page: number; size: number; pages: number }

export function ReservationsPage() {
  const [page, setPage] = useState(1)
  const [bookId, setBookId] = useState('')
  const announce = useAnnouncer()
  const qc = useQueryClient()

  const { data } = useQuery({
    queryKey: ['reservations', page],
    queryFn: async () => {
      const { data } = await api.get<Paginated<Reservation>>(`/reservations/?page=${page}&size=10`)
      return data
    },
  })

  const mut = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<Reservation>('/reservations/', { book_id: Number(bookId) })
      return data
    },
    onSuccess: () => {
      announce('Reserva criada', 'polite')
      setBookId('')
      qc.invalidateQueries({ queryKey: ['reservations'] })
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Erro ao reservar'
      announce(msg, 'assertive')
    },
  })

  const cancelMut = useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.post<Reservation>(`/reservations/${id}/cancel`)
      return data
    },
    onSuccess: () => {
      announce('Reserva cancelada', 'polite')
      qc.invalidateQueries({ queryKey: ['reservations'] })
    },
  })

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl sm:text-3xl font-bold">Reservas</h1>
        <p className="text-sm text-slate-500 mt-1">Reserve um título — fila por escola, útil quando exemplares estão emprestados.</p>
      </header>

      <Card>
        <CardHeader>
          <h2 className="font-semibold">Nova reserva</h2>
        </CardHeader>
        <CardBody>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!bookId) {
                announce('Informe o ID do livro', 'assertive')
                return
              }
              mut.mutate()
            }}
            className="flex flex-col sm:flex-row gap-3 items-end"
          >
            <div className="flex-1 w-full">
              <Input label="ID do livro" type="number" value={bookId} onChange={(e) => setBookId(e.target.value)} required />
            </div>
            <Button type="submit" disabled={mut.isPending} className="w-full sm:w-auto">
              {mut.isPending ? 'Reservando…' : 'Reservar'}
            </Button>
          </form>
        </CardBody>
      </Card>

      {data && (
        <>
          <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
            <table className="w-full text-sm">
              <caption className="sr-only">Reservas por livro</caption>
              <thead className="bg-slate-50 dark:bg-slate-700/50">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">
                    ID
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">
                    Livro
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">
                    Criada em
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {data.items.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3">#{r.id}</td>
                    <td className="px-4 py-3">#{r.book_id}</td>
                    <td className="px-4 py-3">
                      <Badge tone={r.status === 'active' ? 'info' : r.status === 'fulfilled' ? 'success' : 'neutral'}>{r.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs">{new Date(r.created_at).toLocaleDateString('pt-BR')}</td>
                    <td className="px-4 py-3">
                      {r.status === 'active' && (
                        <Button size="sm" variant="secondary" onClick={() => cancelMut.mutate(r.id)}>
                          Cancelar
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="md:hidden grid gap-3" role="list">
            {data.items.map((r) => (
              <li key={r.id} className="rounded-xl border p-4 bg-white dark:bg-slate-800">
                <div className="flex justify-between">
                  <h3 className="font-semibold">Reserva #{r.id}</h3>
                  <Badge tone={r.status === 'active' ? 'info' : 'neutral'}>{r.status}</Badge>
                </div>
                <p className="text-sm text-slate-500">Livro #{r.book_id} — {new Date(r.created_at).toLocaleDateString('pt-BR')}</p>
                {r.status === 'active' && (
                  <Button size="sm" variant="secondary" className="mt-3 w-full" onClick={() => cancelMut.mutate(r.id)}>
                    Cancelar
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
