import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, BookOpen, Calendar, Clock, Funnel, Hash, Plus } from 'lucide-react'
import api from '@/lib/api'
import { bookStateLabel } from '@/lib/bookStates'
import { useAnnouncer } from '@/components/feedback/LiveRegion'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Pagination } from '@/components/ui/Pagination'
import { Select } from '@/components/ui/Select'

type Book = { id: number; title: string; description: string | null; derived_state: string; isbn: string | null; is_active: boolean; added_by: number; cover_url: string | null; published_date: string | null; created_at: string | null; updated_at: string | null; genres: { id: number; name: string; slug: string }[]; authors: { id: number; name: string; slug: string }[] }
type Paginated<T> = { items: T[]; total: number; page: number; size: number; pages: number }
type Resolve = { kind: 'isbn' | 'internal_code' | 'title' | 'none'; book_id: number | null }
type BookSuggestion = { id: number; title: string; isbn: string | null }
type AuthorSuggestion = { id: number; name: string; slug: string }
type GenreSuggestion = { id: number; name: string; slug: string }
type SuggestItem =
  | { kind: 'author'; id: number; name: string }
  | { kind: 'genre'; id: number; name: string }
  | { kind: 'book'; id: number; title: string; isbn: string | null }

export function BooksPage() {
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [queryQ, setQueryQ] = useState('')
  const [genreFilter, setGenreFilter] = useState('')
  const [sortBy, setSortBy] = useState<'title' | 'created_at' | 'published_date' | 'author'>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const announce = useAnnouncer()
  const navigate = useNavigate()
  const { user } = useAuth()
  const canCreate = !!user && ['librarian', 'school_admin'].includes(user.role)

  const { data: genreOptions } = useQuery({
    queryKey: ['genres-list'],
    queryFn: async () => {
      const { data } = await api.get<{ items: { id: number; name: string }[] }>('/genres/?size=50')
      return data.items
    },
  })

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['books', page, queryQ, genreFilter, sortBy, sortOrder],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), size: '10' })
      if (queryQ) params.set('q', queryQ)
      if (genreFilter) params.set('genre_id', genreFilter)
      if (sortBy) params.set('sort_by', sortBy)
      if (sortOrder) params.set('sort_order', sortOrder)
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
  const [suggestItems, setSuggestItems] = useState<SuggestItem[]>([])
  const [activeIndex, setActiveIndex] = useState(-1)
  const suggestListId = 'book-suggest-listbox'
  const abortRef = useRef<AbortController | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [filterMenuOpen, setFilterMenuOpen] = useState(false)
  const filterWrapperRef = useRef<HTMLDivElement>(null)
  const filterMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    searchInputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!filterMenuOpen) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (filterWrapperRef.current && !filterWrapperRef.current.contains(t)) {
        setFilterMenuOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFilterMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [filterMenuOpen])

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
        const [booksRes, authorsRes, genresRes] = await Promise.all([
          api.get<{ items: BookSuggestion[] }>('/books/suggest', {
            params: { q: raw, limit: 5 },
            signal: controller.signal,
          }),
          api.get<{ items: AuthorSuggestion[] }>('/authors/', {
            params: { q: raw, size: 5 },
            signal: controller.signal,
          }),
          api.get<{ items: GenreSuggestion[] }>('/genres/', {
            params: { q: raw, size: 5 },
            signal: controller.signal,
          }),
        ])
        if (!controller.signal.aborted) {
          const authors: SuggestItem[] = (authorsRes.data.items || []).map((a) => ({ kind: 'author' as const, id: a.id, name: a.name }))
          const genres: SuggestItem[] = (genresRes.data.items || []).map((g) => ({ kind: 'genre' as const, id: g.id, name: g.name }))
          const books: SuggestItem[] = (booksRes.data.items || []).map((b) => ({ kind: 'book' as const, id: b.id, title: b.title, isbn: b.isbn }))
          // mostra autor/gênero primeiro quando busca por eles, depois livros
          const combined: SuggestItem[] = [...authors, ...genres, ...books].slice(0, 8)
          setSuggestItems(combined)
          setActiveIndex(combined.length ? 0 : -1)
          setSuggestOpen(combined.length > 0)
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

  const openSuggestion = (s: SuggestItem) => {
    closeSuggestions()
    if (s.kind === 'book') {
      setQuery('')
      setQueryQ('')
      navigate(`/acervo/${s.id}`)
    } else {
      // autor ou gênero: filtra a lista por esse nome via busca unificada (q)
      const term = s.name
      setQuery(term)
      setQueryQ(term)
      setPage(1)
      announce(`Filtrando por ${s.kind === 'author' ? 'autor' : 'gênero'} ${term}`, 'polite')
    }
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
          <p className="text-sm text-slate-500">Busca por título, ISBN, código interno, gênero ou autor. ISBN não cadastrado abre o cadastro automaticamente.</p>
        </header>
        {canCreate && (
          <Link
            to="/acervo/novo"
            aria-label="Cadastrar novo livro"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-[#0f4c75] text-white hover:bg-[#0e3f61] active:bg-[#0c3d5e] dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 dark:active:bg-slate-200 min-h-[44px] font-medium shadow-sm transition-colors focus-visible:outline-3 focus-visible:outline-[var(--color-focus)] focus-visible:outline-offset-2"
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
          <form onSubmit={onSearch} className="flex flex-col gap-3" role="search" aria-label="Buscar livros">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-end items-stretch">
              <div className="flex-1 w-full relative">
                <div role="combobox" aria-expanded={suggestOpen} aria-controls={suggestListId} aria-haspopup="listbox">
                  <Input
                    label="Buscar"
                    id="book-search"
                    ref={searchInputRef}
                    placeholder="Título, ISBN, código interno, gênero ou autor"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={onKeyDown}
                    onFocus={() => query.trim().length >= 2 && setSuggestOpen(true)}
                    onBlur={() => setTimeout(closeSuggestions, 120)}
                    aria-autocomplete="list"
                    aria-activedescendant={activeIndex >= 0 ? `${suggestListId}-${activeIndex}` : undefined}
                    hint="Busque por título, gênero ou autor — autocomplete disponível"
                  />
                </div>
                {suggestOpen && suggestItems.length > 0 && (
                  <ul
                    id={suggestListId}
                    role="listbox"
                    aria-label="Sugestões de livros, autores e gêneros"
                    className="absolute z-20 top-full left-0 right-0 mt-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-lg overflow-hidden"
                  >
                    {suggestItems.map((s, i) => (
                      <li
                        key={`${s.kind}-${s.id}`}
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
                        {s.kind === 'book' ? (
                          <>
                            <span className="truncate">{s.title}</span>
                            {s.isbn && (
                              <span className={`font-mono text-xs shrink-0 ${i === activeIndex ? 'text-white/80' : 'text-slate-400'}`}>
                                {s.isbn}
                              </span>
                            )}
                          </>
                        ) : s.kind === 'author' ? (
                          <>
                            <span className="truncate font-medium">{s.name}</span>
                            <span className={`text-xs shrink-0 ${i === activeIndex ? 'text-white/80' : 'text-slate-500'}`}>Autor</span>
                          </>
                        ) : (
                          <>
                            <span className="truncate">{s.name}</span>
                            <span className={`text-xs shrink-0 ${i === activeIndex ? 'text-white/80' : 'text-slate-500'}`}>Gênero</span>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div ref={filterWrapperRef} className="relative flex items-center gap-2 w-full sm:w-auto sm:self-end sm:mb-[21px]">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setFilterMenuOpen((o) => !o)}
                  aria-haspopup="menu"
                  aria-expanded={filterMenuOpen}
                  aria-controls="filter-menu"
                  aria-label="Filtros"
                  className="w-full sm:w-auto gap-2"
                >
                  <Funnel className="h-4 w-4" aria-hidden="true" />
                  Filtros
                  {(genreFilter || sortBy !== 'created_at' || sortOrder !== 'desc') && (
                    <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#0f4c75] px-1.5 text-xs font-bold text-white dark:bg-white dark:text-slate-900" aria-hidden="true">
                      {[genreFilter, sortBy !== 'created_at' ? sortBy : null, sortOrder !== 'desc' ? sortOrder : null].filter(Boolean).length}
                    </span>
                  )}
                </Button>
                {filterMenuOpen && (
                  <div
                    id="filter-menu"
                    ref={filterMenuRef}
                    role="menu"
                    aria-label="Opções de filtro"
                    className="absolute right-0 top-full mt-2 w-80 max-w-[90vw] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl p-4 z-30 flex flex-col gap-4"
                  >
                    <Select
                      label="Gênero"
                      id="genre-filter"
                      value={genreFilter}
                      onChange={(v) => {
                        setGenreFilter(v)
                        setPage(1)
                      }}
                      options={[{ value: '', label: 'Todos' }, ...((genreOptions ?? []).map((g) => ({ value: String(g.id), label: g.name })))]}
                    />
                    <Select
                      label="Ordenar por"
                      id="sort-by"
                      value={sortBy}
                      onChange={(v) => {
                        setSortBy(v as 'title' | 'created_at' | 'published_date' | 'author')
                        setPage(1)
                      }}
                      options={[
                        { value: 'created_at', label: 'Data de cadastro' },
                        { value: 'published_date', label: 'Data de lançamento' },
                        { value: 'title', label: 'Nome' },
                        { value: 'author', label: 'Autor' },
                      ]}
                    />
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Ordem</span>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
                        aria-label={sortOrder === 'asc' ? 'Ordem crescente' : 'Ordem decrescente'}
                        title={sortOrder === 'asc' ? 'Crescente' : 'Decrescente'}
                      >
                        {sortOrder === 'asc' ? <ArrowUp className="h-4 w-4" aria-hidden="true" /> : <ArrowDown className="h-4 w-4" aria-hidden="true" />}
                        <span className="ml-2 text-xs">{sortOrder === 'asc' ? 'Crescente' : 'Decrescente'}</span>
                      </Button>
                    </div>
                    <div className="flex justify-between gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          setGenreFilter('')
                          setSortBy('created_at')
                          setSortOrder('desc')
                          setPage(1)
                        }}
                      >
                        Limpar filtros
                      </Button>
                      <Button type="button" onClick={() => setFilterMenuOpen(false)}>
                        Aplicar
                      </Button>
                    </div>
                  </div>
                )}
                <Button type="submit" className="flex-1 sm:flex-none">
                  Buscar
                </Button>
              </div>
            </div>
            {(queryQ || genreFilter) && (
              <div className="flex flex-wrap gap-2">
                {queryQ && <Badge tone="info">Busca: {queryQ}</Badge>}
                {genreFilter && <Badge tone="neutral">Gênero aplicado</Badge>}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setQuery('')
                    setQueryQ('')
                    setGenreFilter('')
                    setPage(1)
                  }}
                >
                  Limpar busca
                </Button>
              </div>
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
              <table className="w-full text-sm table-fixed">
                <caption className="sr-only">Tabela de livros com título, ISBN, estado, data de cadastro e lançamento</caption>
                <thead className="bg-slate-50 dark:bg-slate-700/50 text-left">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold w-[20%]">
                      Título
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      ISBN
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Autores
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Gêneros
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Estado
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold whitespace-nowrap">
                      Lançamento
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold">
                      Descrição
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold whitespace-nowrap">
                      Data de cadastro
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {data.items.map((b) => (
                    <tr
                      key={b.id}
                      onClick={() => navigate(`/acervo/${b.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          navigate(`/acervo/${b.id}`)
                        }
                      }}
                      tabIndex={0}
                      role="link"
                      aria-label={`Abrir livro ${b.title}`}
                      className="hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--color-focus)] focus-visible:outline-offset-[-2px]"
                    >
                      <td className="px-4 py-3 font-medium w-[20%]">
                        <span className="line-clamp-2 break-words" title={b.title}>
                          {b.title}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{b.isbn ?? '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1 max-w-[20ch]">
                          {b.authors?.length ? b.authors.map((a) => <Badge key={a.id} tone="info">{a.name}</Badge>) : <span className="text-slate-400">—</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1 max-w-[20ch]">
                          {b.genres?.length ? b.genres.map((g) => <Badge key={g.id} tone="neutral">{g.name}</Badge>) : <span className="text-slate-400">—</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={b.derived_state === 'available' ? 'success' : 'neutral'}>{bookStateLabel(b.derived_state)}</Badge>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-500">{b.published_date ? new Date(b.published_date).toLocaleDateString('pt-BR') : '—'}</td>
                      <td className="px-4 py-3 max-w-[32ch] truncate text-slate-500">{b.description ?? '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-500">{b.created_at ? new Date(b.created_at).toLocaleDateString('pt-BR') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="md:hidden grid gap-4" role="list" aria-label="Lista de livros">
              {data.items.map((b) => (
                <li
                  key={b.id}
                  className="group relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm transition-all hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 active:scale-[0.99]"
                >
                  <Link
                    to={`/acervo/${b.id}`}
                    className="flex gap-4 p-4 focus-visible:outline-none"
                    aria-label={`Ver detalhes de ${b.title}`}
                  >
                    <div className="h-28 w-20 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 border border-slate-200 dark:border-slate-600 flex items-center justify-center relative">
                      {b.cover_url ? (
                        <>
                          <img
                            src={b.cover_url}
                            alt={`Capa de ${b.title}`}
                            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                            onError={(e) => {
                              const t = e.currentTarget as HTMLImageElement
                              t.style.display = 'none'
                              const fb = document.getElementById(`fallback-${b.id}`)
                              if (fb) {
                                fb.classList.remove('hidden')
                                fb.classList.add('flex')
                              }
                            }}
                          />
                          <div id={`fallback-${b.id}`} className="hidden absolute inset-0 flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 text-slate-400">
                            <BookOpen className="h-7 w-7 opacity-60" aria-hidden="true" />
                            <span className="text-[9px] font-medium uppercase tracking-widest opacity-60">Sem capa</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-1.5 text-slate-400">
                          <BookOpen className="h-7 w-7 opacity-60" aria-hidden="true" />
                          <span className="text-[9px] font-medium uppercase tracking-widest opacity-60">Sem capa</span>
                        </div>
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="line-clamp-2 text-[15px] font-bold leading-snug text-slate-900 dark:text-slate-100 group-hover:text-[#0f4c75] dark:group-hover:text-white transition-colors">
                          {b.title}
                        </h3>
                        <Badge tone={b.derived_state === 'available' ? 'success' : 'neutral'} className="shrink-0 text-[11px] px-2 py-0.5">
                          {bookStateLabel(b.derived_state)}
                        </Badge>
                      </div>
                      <p className="flex items-center gap-1.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        <Hash className="h-3 w-3 opacity-60" aria-hidden="true" />
                        <span className="truncate">{b.isbn ?? 'Sem ISBN'}</span>
                      </p>
                      {(b.authors?.length > 0 || b.genres?.length > 0) && (
                        <div className="flex flex-col gap-1.5">
                          {b.authors?.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {b.authors.slice(0, 2).map((a) => (
                                <Badge key={a.id} tone="info" className="text-[11px] px-2 py-0">
                                  {a.name}
                                </Badge>
                              ))}
                              {b.authors.length > 2 && (
                                <span className="text-[11px] text-slate-500 self-center">+{b.authors.length - 2}</span>
                              )}
                            </div>
                          )}
                          {b.genres?.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {b.genres.slice(0, 3).map((g) => (
                                <Badge key={g.id} tone="neutral" className="text-[11px] px-2 py-0">
                                  {g.name}
                                </Badge>
                              ))}
                              {b.genres.length > 3 && (
                                <span className="text-[11px] text-slate-500 self-center">+{b.genres.length - 3}</span>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </Link>

                  <div className="mx-4 border-t border-slate-100 dark:border-slate-700" />

                  <div className="px-4 py-3 space-y-3">
                    {b.description && (
                      <p className="line-clamp-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                        {b.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 dark:bg-slate-700/40 px-3 py-2.5">
                      <span className="flex items-center gap-1.5 text-xs">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white dark:bg-slate-600 border border-slate-200 dark:border-slate-500">
                          <Calendar className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300" aria-hidden="true" />
                        </span>
                        <span className="flex flex-col leading-none">
                          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Lançamento</span>
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{b.published_date ? new Date(b.published_date).toLocaleDateString('pt-BR') : '—'}</span>
                        </span>
                      </span>
                      <span className="h-8 w-px bg-slate-200 dark:bg-slate-600" aria-hidden="true" />
                      <span className="flex items-center gap-1.5 text-xs">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white dark:bg-slate-600 border border-slate-200 dark:border-slate-500">
                          <Clock className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300" aria-hidden="true" />
                        </span>
                        <span className="flex flex-col leading-none">
                          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Cadastro</span>
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{b.created_at ? new Date(b.created_at).toLocaleDateString('pt-BR') : '—'}</span>
                        </span>
                      </span>
                    </div>
                  </div>
                  <div className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity md:hidden">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/5 dark:bg-white/10">
                      <ArrowDown className="h-3.5 w-3.5 -rotate-90 text-slate-400" aria-hidden="true" />
                    </span>
                  </div>
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
