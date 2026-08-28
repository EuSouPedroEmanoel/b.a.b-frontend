import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { bookStateLabel } from '@/lib/bookStates'
import { Card, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Pagination } from '@/components/ui/Pagination'

type Copy = { id: number; code: string; state: string; condition: string; book_id: number; school_id: number }
type BookLite = { id: number; title: string }
type Paginated<T> = { items: T[]; total: number; page: number; size: number; pages: number }

export function CopiesPage() {
  const [page, setPage] = useState(1)
  const { data, isLoading, isError } = useQuery({
    queryKey: ['copies', page],
    queryFn: async () => {
      const { data } = await api.get<Paginated<Copy>>(`/copies/?page=${page}&size=10`)
      return data
    },
  })

  const { data: booksData } = useQuery({
    queryKey: ['books-map'],
    queryFn: async () => {
      const { data } = await api.get<Paginated<BookLite>>('/books/?size=100')
      return data
    },
  })

  const titleById = new Map<number, string>((booksData?.items ?? []).map((b) => [b.id, b.title]))

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl sm:text-3xl font-bold">Exemplares</h1>
        <p className="text-sm text-slate-500 mt-1">Exemplares físicos por escola — código único por unidade. Estado e conservação.</p>
      </header>

      {isLoading && <p aria-live="polite">Carregando exemplares…</p>}
      {isError && (
        <div role="alert" className="rounded-md bg-red-50 border border-red-200 p-4 text-sm text-red-800">
          Erro ao carregar exemplares. Verifique login e permissão (bibliotecário/escola).
        </div>
      )}

      {data && (
        <>
          <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
            <table className="w-full text-sm">
              <caption className="sr-only">Exemplares por código e estado</caption>
              <thead className="bg-slate-50 dark:bg-slate-700/50">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">
                    Código
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">
                    Livro
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">
                    Estado
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">
                    Condição
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {data.items.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3 font-mono text-sm">{c.code}</td>
                    <td className="px-4 py-3 max-w-[28ch] truncate" title={titleById.get(c.book_id) ?? `Livro #${c.book_id}`}>
                      {titleById.get(c.book_id) ?? `Livro #${c.book_id}`}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={c.state === 'available' ? 'success' : c.state === 'borrowed' ? 'warning' : 'neutral'}>{bookStateLabel(c.state)}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone="info">{c.condition}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="md:hidden grid gap-3" role="list">
            {data.items.map((c) => (
              <li key={c.id}>
                <Card>
                  <CardBody>
                    <h3 className="font-mono font-semibold">{c.code}</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300 font-medium truncate" title={titleById.get(c.book_id)}>
                      {titleById.get(c.book_id) ?? `Livro #${c.book_id}`}
                    </p>
                    <p className="text-xs text-slate-500">Escola #{c.school_id}</p>
                    <div className="mt-2 flex gap-2">
                      <Badge tone={c.state === 'available' ? 'success' : 'warning'}>{bookStateLabel(c.state)}</Badge>
                      <Badge>{c.condition}</Badge>
                    </div>
                  </CardBody>
                </Card>
              </li>
            ))}
          </ul>

          <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />
        </>
      )}
    </div>
  )
}
