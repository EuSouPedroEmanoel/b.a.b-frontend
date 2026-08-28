import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import api from '@/lib/api'
import { bookStateLabel } from '@/lib/bookStates'
import { useAnnouncer } from '@/components/feedback/LiveRegion'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Pagination } from '@/components/ui/Pagination'

type Book = { id: number; title: string; description: string | null; derived_state: string; isbn: string | null; is_active: boolean; added_by: number }
type Paginated<T> = { items: T[]; total: number; page: number; size: number; pages: number }
type Resolve = { kind: 'isbn' | 'internal_code' | 'title' | 'none'; book_id: number | null }
type BookSuggestion = { id: number; title: string; isbn: string | null }

export function BooksPage() {
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [queryQ, setQueryQ] = useState('')
  const announce = useAnnouncer()
  const navigate = useNavigate()
  const { user } = useAuth()
  const canCreate = !!user && ['librarian', 'school_admin'].includes(user.role)

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['books', page, queryQ],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), size: '10' })
      if (queryQ) params.set('q', queryQ)
      const { data } = await api.get<Paginated<Book>>(`/books/?${params}`)
      return data
    },
  })

  const resolveMut = useMutation({
    mutationFn: async (term: string) => {
      const { data } = await api.get<Resolve>(`/books/resolve?term=${encodeURIComponent(term)}`)
      return data
    },
  })

  const [suggestOpen, setSuggestOpen] = useState(false)
  const [suggestItems, setSuggestItems] = useState<BookSuggestion[]>([])
  const [activeIndex, setActiveIndex] = useState(-1)
  const suggestListId = 'book-suggest-listbox'
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const raw = query.trim()
    if (raw.length < 2) {
      setSuggestItems([])
      setSuggestOpen(false)
      setActiveIndex(-1)
      return
    }
    const controller = new AbortController()
    abortRef.current = controller
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get<{ items: BookSuggestion[] }>('/books/suggest', {
          params: { q: raw, limit: 5 },
          signal: controller.signal,
        })
        if (!controller.signal.aborted) {
          setSuggestItems(data.items)
          setActiveIndex(0)
          setSuggestOpen(true)
        }
      } catch {
        /* p. ex. abort/erro de rede — mantém lista atual */
      }
    }, 250)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  const closeSuggestions = () => {
    setSuggestOpen(false)
    setActiveIndex(-1)
  }

  const openSuggestion = (s: BookSuggestion) => {
    closeSuggestions()
    setQuery('')
    setQueryQ('')
    navigate(`/acervo/${s.id}`)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!suggestOpen || suggestItems.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % suggestItems.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => (i <= 0 ? suggestItems.length - 1 : i - 1))
    } else if (e.key === 'Escape') {
      closeSuggestions()
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      openSuggestion(suggestItems[activeIndex])
    }
  }

  const onSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    closeSuggestions()
    const raw = query.trim()
    if (!raw) return
    const clean = raw.replace(/[^0-9X]/gi, '')
    const isIsbn = /^[0-9\- ]{10,17}$/.test(raw) && clean.length >= 10

    let res: Resolve
    try {
      res = await resolveMut.mutateAsync(raw)
    } catch {
      setQueryQ(raw)
      setPage(1)
      return
    }

    if (res.kind === 'isbn' && res.book_id) {
      navigate(`/acervo/${res.book_id}`)
      return
    }
    if (res.kind === 'internal_code' && res.book_id) {
      navigate(`/acervo/${res.book_id}`)
      return
    }
    if (isIsbn && res.kind === 'none') {
      navigate(`/acervo/novo?isbn=${encodeURIComponent(clean)}`)
      announce(`ISBN ${clean} não encontrado, abrindo cadastro`, 'polite')
      return
    }
    setQueryQ(raw)
    setPage(1)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl sm:text-3xl font-bold">Acervo</h1>
          <p className="text-sm text-slate-500">Busca por título, ISBN ou código interno do exemplar. ISBN não cadastrado abre o cadastro automaticamente.</p>
        </header>
        {canCreate && (
          <Link
            to="/acervo/novo"
            aria-label="Cadastrar novo livro"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#0f4c75] text-white hover:bg-[#0e3f61] dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 min-h-[44px] font-medium shadow-sm transition-colors"
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> Cadastrar
          </Link>
        )}
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-semibold">Buscar no acervo</h2>
        </CardHeader>
        <CardBody>
          <form onSubmit={onSearch} className="flex flex-col sm:flex-row gap-3 items-end" role="search" aria-label="Buscar livros">
            <div className="flex-1 w-full relative">
              <div role="combobox" aria-expanded={suggestOpen} aria-controls={suggestListId} aria-haspopup="listbox">
                <Input
                  label="Buscar"
                  id="book-search"
                  placeholder="Título, ISBN ou código interno"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onKeyDown}
                  onFocus={() => query.trim().length >= 2 && setSuggestOpen(true)}
                  onBlur={() => setTimeout(closeSuggestions, 120)}
                  aria-autocomplete="list"
                  aria-activedescendant={activeIndex >= 0 ? `${suggestListId}-${activeIndex}` : undefined}
                  hint="Bipe o código de barras ou digite ao menos 1 caractere"
                />
              </div>
              {suggestOpen && suggestItems.length > 0 && (
                <ul
                  id={suggestListId}
                  role="listbox"
                  aria-label="Sugestões de livros"
                  className="absolute z-20 top-full left-0 right-0 mt-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-lg overflow-hidden"
                >
                  {suggestItems.map((s, i) => (
                    <li
                      key={s.id}
                      id={`${suggestListId}-${i}`}
                      role="option"
                      aria-selected={i === activeIndex}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        openSuggestion(s)
                      }}
                      onMouseEnter={() => setActiveIndex(i)}
                      className={`flex items-baseline justify-between gap-3 px-3 py-2.5 text-sm cursor-pointer min-h-[44px] ${
                        i === activeIndex ? 'bg-[#0f4c75] text-white' : 'text-slate-800 dark:text-slate-100'
                      }`}
                    >
                      <span className="truncate">{s.title}</span>
                      {s.isbn && (
                        <span className={`font-mono text-xs shrink-0 ${i === activeIndex ? 'text-white/80' : 'text-slate-400'}`}>
                          {s.isbn}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Button type="submit" className="w-full sm:w-auto">
              Buscar
            </Button>
            {queryQ && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setQuery('')
                  setQueryQ('')
                  setPage(1)
                }}
              >
                Limpar
              </Button>
            )}
          </form>
        </CardBody>
      </Card>

      <section aria-labelledby="books-list-heading">
        <h2 id="books-list-heading" className="sr-only">
          Lista de livros
        </h2>

        {isLoading && (
          <div className="grid gap-3" aria-busy="true" aria-live="polite">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl border border-slate-200 dark:border-slate-700 animate-pulse bg-slate-50 dark:bg-slate-800" />
            ))}
          </div>
        )}

        {isError && (
          <div role="alert" className="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 p-4 text-sm text-red-800 dark:text-red-200">
            Erro ao carregar acervo: {(error as { message?: string })?.message ?? 'tente novamente'}
          </div>
        )}

        {data && (
          <>
            <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
              <table className="w-full text-sm">
                <caption className="sr-only">Tabela de livros com título, ISBN e estado</caption>
                <thead className="bg-slate-50 dark:bg-slate-700/50 text-left">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Título
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      ISBN
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Estado
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Descrição
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {data.items.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                      <td className="px-4 py-3 font-medium">
                        <Link to={`/acervo/${b.id}`} className="hover:text-[var(--color-primary)] hover:underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-[var(--color-focus)] rounded">
                          {b.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{b.isbn ?? '—'}</td>
                      <td className="px-4 py-3">
                        <Badge tone={b.derived_state === 'available' ? 'success' : 'neutral'}>{bookStateLabel(b.derived_state)}</Badge>
                      </td>
                      <td className="px-4 py-3 max-w-[32ch] truncate text-slate-500">{b.description ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="md:hidden grid gap-3" role="list">
              {data.items.map((b) => (
                <li key={b.id} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 hover:shadow-md transition-shadow">
                  <Link to={`/acervo/${b.id}`} className="block focus-visible:outline-2 focus-visible:outline-[var(--color-focus)] rounded">
                    <h3 className="font-semibold leading-tight hover:text-[var(--color-primary)]">{b.title}</h3>
                  </Link>
                  <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <dt className="text-slate-500">ISBN</dt>
                      <dd>{b.isbn ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Estado</dt>
                      <dd>
                        <Badge tone={b.derived_state === 'available' ? 'success' : 'neutral'}>{bookStateLabel(b.derived_state)}</Badge>
                      </dd>
                    </div>
                    {b.description && (
                      <div className="col-span-2">
                        <dt className="text-slate-500">Descrição</dt>
                        <dd className="line-clamp-2">{b.description}</dd>
                      </div>
                    )}
                  </dl>
                </li>
              ))}
            </ul>

            {data.items.length === 0 && <p className="text-sm text-slate-500 py-8 text-center">Nenhum livro encontrado.</p>}

            <div className="mt-4">
              <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />
            </div>
          </>
        )}
      </section>
    </div>
  )
}
