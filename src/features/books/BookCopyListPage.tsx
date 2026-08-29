import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Plus } from 'lucide-react'
import api from '@/lib/api'
import { bookConditionLabel, bookStateLabel } from '@/lib/bookStates'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

type Book = { id: number; title: string; isbn: string | null }
type Copy = { id: number; code: string; state: string; condition: string; book_id: number; school_id: number }
type Paginated<T> = { items: T[]; total: number; page: number; size: number; pages: number }

export function BookCopyListPage() {
  const { bookId } = useParams<{ bookId: string }>()
  const id = Number(bookId)

  const { data: book } = useQuery({
    queryKey: ['book', id],
    queryFn: async () => {
      const { data } = await api.get<Paginated<Book>>('/books/?size=100')
      const found = data.items.find((b) => b.id === id)
      if (!found) throw new Error('Livro não encontrado')
      return found
    },
    enabled: Number.isFinite(id),
  })

  const { data: copiesPage, isLoading } = useQuery({
    queryKey: ['copies', id],
    queryFn: async () => {
      const { data } = await api.get<Paginated<Copy>>(`/copies/?size=100&book_id=${id}`)
      const filtered = (data.items as Copy[]).filter((c) => c.book_id === id)
      if (filtered.length !== data.items.length && data.items.some((c) => c.book_id !== id)) {
        return { ...data, items: filtered, total: filtered.length, pages: 1 }
      }
      return data
    },
    enabled: Number.isFinite(id),
  })

  const count = copiesPage?.total ?? copiesPage?.items.length ?? 0

  if (!Number.isFinite(id)) {
    return (
      <div role="alert" className="p-8 text-center">
        ID de livro inválido
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl flex flex-col gap-6">
      <header>
        <Link to="/acervo" className="inline-flex items-center text-sm text-slate-600 dark:text-slate-300 hover:text-[var(--color-primary)] mb-2">
          <ArrowLeft className="h-4 w-4 mr-1" aria-hidden="true" /> Voltar ao acervo
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold">Exemplares</h1>
        {book && (
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
            Livro: <span className="font-semibold">{book.title}</span>{' '}
            {book.isbn && <span className="font-mono text-xs bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">{book.isbn}</span>}
          </p>
        )}
      </header>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-semibold" aria-live="polite">
              Exemplares cadastrados — {isLoading ? '...' : `${count} unidade${count !== 1 ? 's' : ''}`}
            </h2>
            <Link
              to={`/acervo/${id}/exemplares/novo`}
              aria-label="Cadastrar exemplar"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-[#0f4c75] text-white hover:bg-[#0e3f61] active:bg-[#0c3d5e] dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 dark:active:bg-slate-200 min-h-[44px] font-medium shadow-sm transition-colors focus-visible:outline-3 focus-visible:outline-[var(--color-focus)] focus-visible:outline-offset-2"
            >
              <Plus className="h-4 w-4" aria-hidden="true" /> Cadastrar exemplar
            </Link>
          </div>
        </CardHeader>
        <CardBody>
          {isLoading && <p aria-live="polite">Carregando exemplares...</p>}
          {!isLoading && copiesPage && copiesPage.items.length === 0 && (
            <p className="text-sm text-slate-500 py-4 text-center">Nenhum exemplar cadastrado para este livro nesta escola.</p>
          )}
          {copiesPage && copiesPage.items.length > 0 && (
            <>
              <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="w-full text-sm">
                  <caption className="sr-only">Exemplares do livro {book?.title ?? id}</caption>
                  <thead className="bg-slate-50 dark:bg-slate-700/50 text-left">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-semibold">
                        Código
                      </th>
                      <th scope="col" className="px-4 py-3 font-semibold">
                        Estado
                      </th>
                      <th scope="col" className="px-4 py-3 font-semibold">
                        Condição
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {copiesPage.items.map((c) => (
                      <tr key={c.id}>
                        <td className="px-4 py-3 font-mono text-sm">{c.code}</td>
                        <td className="px-4 py-3">
                          <Badge tone={c.state === 'available' ? 'success' : 'neutral'}>{bookStateLabel(c.state)}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone="info">{bookConditionLabel(c.condition)}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="md:hidden grid gap-2" role="list">
                {copiesPage.items.map((c) => (
                  <li key={c.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                    <span className="font-mono text-sm">{c.code}</span>
                    <span className="flex gap-1">
                      <Badge tone={c.state === 'available' ? 'success' : 'neutral'}>{bookStateLabel(c.state)}</Badge>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
