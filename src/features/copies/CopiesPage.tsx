import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { bookConditionLabel, bookStateLabel, bookStateTone } from '@/lib/bookStates'
import { Badge } from '@/components/ui/Badge'
import { Pagination } from '@/components/ui/Pagination'
import { PageDescription } from '@/components/ui/PageDescription'

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
        <PageDescription>Exemplares físicos por escola — código único por unidade. Estado e conservação.</PageDescription>
      </header>

      {isLoading && <p aria-live="polite">Carregando exemplares…</p>}
      {isError && (
        <div role="alert" className="rounded-md bg-red-50 border border-red-200 p-4 text-sm text-red-800">
          Erro ao carregar exemplares. Verifique login e permissão (bibliotecário/escola).
        </div>
      )}

      {data && (
        <>
          <div className="@container max-w-full overflow-x-auto overscroll-x-contain rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
            <table className="w-full min-w-0 text-sm @max-md:table-fixed">
              <caption className="sr-only">Exemplares por código e estado</caption>
              <thead className="bg-slate-50 dark:bg-slate-700/50">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left font-semibold @max-md:w-[34%] @max-md:px-3">
                    Código
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold @max-md:w-[66%] @max-md:px-3">
                    Livro
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold @max-md:hidden">
                    Estado
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold @max-md:hidden">
                    Condição
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {data.items.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3 align-top font-mono text-sm break-words [overflow-wrap:anywhere] @max-md:px-3">
                      {c.code}
                    </td>
                    <td className="px-4 py-3 align-top @max-md:px-3">
                      <p className="break-words [overflow-wrap:anywhere]" title={titleById.get(c.book_id) ?? `Livro #${c.book_id}`}>
                        {titleById.get(c.book_id) ?? `Livro #${c.book_id}`}
                      </p>
                      <div className="mt-2 hidden flex-wrap gap-2 @max-md:flex" aria-label="Estado e condição">
                        <Badge tone={bookStateTone(c.state)}>{bookStateLabel(c.state)}</Badge>
                        <Badge tone="info">{bookConditionLabel(c.condition)}</Badge>
                      </div>
                    </td>
                    <td className="px-4 py-3 @max-md:hidden">
                      <Badge tone={bookStateTone(c.state)}>{bookStateLabel(c.state)}</Badge>
                    </td>
                    <td className="px-4 py-3 @max-md:hidden">
                      <Badge tone="info">{bookConditionLabel(c.condition)}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />
        </>
      )}
    </div>
  )
}
