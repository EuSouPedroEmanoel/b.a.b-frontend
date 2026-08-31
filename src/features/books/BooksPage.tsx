import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, BookOpen, Calendar, Clock, Funnel, Hash, LayoutGrid, Loader2, Plus, Table } from 'lucide-react'
import api from '@/lib/api'
import { bookStateLabel, bookStateTone } from '@/lib/bookStates'
import { useAnnouncer } from '@/components/feedback/LiveRegion'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Pagination } from '@/components/ui/Pagination'
import { Select } from '@/components/ui/Select'
import { OverflowTags } from '@/components/ui/OverflowTags'
import { CoverImage } from '@/components/ui/CoverImage'
import { getBookCoverGradient } from '@/lib/coverColor'
import { GridCard } from './GridCard'

type Book = { id: number; title: string; description: string | null; derived_state: string; isbn: string | null; is_active: boolean; added_by: number; cover_url: string | null; published_date: string | null; created_at: string | null; updated_at: string | null; total_copies?: number; available_copies?: number; genres: { id: number; name: string; slug: string }[]; authors: { id: number; name: string; slug: string }[] }
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
  const [pageSize, setPageSize] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('acervo:pageSize')
      const n = saved ? parseInt(saved, 10) : 10
      if ([10, 20, 30, 50].includes(n)) return n
      if (n >= 5 && n <= 50) return Math.min(50, Math.max(5, n))
    }
    return 10
  })
  const [query, setQuery] = useState('')
  const [queryQ, setQueryQ] = useState('')
  const [genreFilter, setGenreFilter] = useState('')
  const [stateFilter, setStateFilter] = useState('')
  const [sortBy, setSortBy] = useState<'title' | 'created_at' | 'published_date' | 'author'>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const announce = useAnnouncer()
  const navigate = useNavigate()
  const { user } = useAuth()
  const canCreate = !!user && ['librarian', 'school_admin'].includes(user.role)

  const [viewMode, setViewMode] = useState<'table' | 'grid'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('acervo:viewMode') as 'table' | 'grid' | null
      return saved === 'grid' ? 'grid' : 'table'
    }
    return 'table'
  })

  useEffect(() => {
    localStorage.setItem('acervo:viewMode', viewMode)
  }, [viewMode])

  useEffect(() => {
    localStorage.setItem('acervo:pageSize', String(pageSize))
  }, [pageSize])

  const availabilityOptions = useMemo(() => {
    const all = [
      { value: '', label: 'Todas' },
      { value: 'available', label: 'Disponível' },
      { value: 'borrowed', label: 'Emprestado' },
      { value: 'reserved', label: 'Reservado' },
      { value: 'lost', label: 'Perdido' },
      { value: 'archived', label: 'Arquivado' },
    ]
    if (user?.role === 'student') {
      return all
        .filter((o) => o.value === '' || o.value === 'available' || o.value === 'borrowed')
        .map((o) => (o.value === 'borrowed' ? { ...o, label: 'Emprestado (meus)' } : o))
    }
    return all
  }, [user?.role])

  const { data: genreOptions } = useQuery({
    queryKey: ['genres-list'],
    queryFn: async () => {
      const { data } = await api.get<{ items: { id: number; name: string }[] }>('/genres/?size=50')
      return data.items
    },
  })

  // Tabela: paginação clássica (até 50)
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['books', 'table', page, pageSize, queryQ, genreFilter, stateFilter, sortBy, sortOrder],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), size: String(pageSize) })
      if (queryQ) params.set('q', queryQ)
      if (genreFilter) params.set('genre_id', genreFilter)
      if (stateFilter) params.set('state', stateFilter)
      if (sortBy) params.set('sort_by', sortBy)
      if (sortOrder) params.set('sort_order', sortOrder)
      const { data } = await api.get<Paginated<Book>>(`/books/?${params}`)
      return data
    },
    enabled: viewMode === 'table',
  })

  // Grade: paginação infinita (size 18 = múltiplo de 2/3/6 para preencher linhas)
  const GRID_SIZE = 18
  const {
    data: gridData,
    isLoading: isGridLoading,
    isError: isGridError,
    error: gridError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['books', 'grid', queryQ, genreFilter, stateFilter, sortBy, sortOrder],
    queryFn: async ({ pageParam = 1 }) => {
      const params = new URLSearchParams({ page: String(pageParam), size: String(GRID_SIZE) })
      if (queryQ) params.set('q', queryQ)
      if (genreFilter) params.set('genre_id', genreFilter)
      if (stateFilter) params.set('state', stateFilter)
      if (sortBy) params.set('sort_by', sortBy)
      if (sortOrder) params.set('sort_order', sortOrder)
      const { data } = await api.get<Paginated<Book>>(`/books/?${params}`)
      return data
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.page < lastPage.pages ? lastPage.page + 1 : undefined),
    enabled: viewMode === 'grid',
  })

  const gridItems = gridData?.pages.flatMap((p) => p.items) ?? []
  const gridTotal = gridData?.pages[0]?.total ?? 0

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

  // sentinel para scroll infinito no modo grade
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const onIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const first = entries[0]
      if (first?.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage()
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage],
  )
  useEffect(() => {
    if (viewMode !== 'grid') return
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(onIntersect, { rootMargin: '600px 0px', threshold: 0 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [viewMode, onIntersect, gridItems.length])

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
                  {(genreFilter || stateFilter || sortBy !== 'created_at' || sortOrder !== 'desc') && (
                    <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#0f4c75] px-1.5 text-xs font-bold text-white dark:bg-white dark:text-slate-900" aria-hidden="true">
                      {[genreFilter, stateFilter, sortBy !== 'created_at' ? sortBy : null, sortOrder !== 'desc' ? sortOrder : null].filter(Boolean).length}
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
                      label="Disponibilidade"
                      id="state-filter"
                      value={stateFilter}
                      onChange={(v) => {
                        setStateFilter(v)
                        setPage(1)
                      }}
                      options={availabilityOptions}
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
                        { value: 'created_at', label: 'Cadastro' },
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
                          setStateFilter('')
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
                <Button type="submit" className="flex-1 sm:flex-none !bg-blue-600 !text-white hover:!bg-blue-700 !border-blue-600 dark:!bg-blue-600 dark:!text-white dark:hover:!bg-blue-700">
                  Buscar
                </Button>
              </div>
            </div>
            {(queryQ || genreFilter || stateFilter) && (
              <div className="flex flex-wrap gap-2">
                {queryQ && <Badge tone="info">Busca: {queryQ}</Badge>}
                {genreFilter && <Badge tone="neutral">Gênero aplicado</Badge>}
                {stateFilter && <Badge tone="neutral">Disponibilidade: {availabilityOptions.find((o) => o.value === stateFilter)?.label}</Badge>}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setQuery('')
                    setQueryQ('')
                    setGenreFilter('')
                    setStateFilter('')
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

      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-slate-600 dark:text-slate-400" aria-live="polite" aria-atomic="true">
          {viewMode === 'table'
            ? isLoading
              ? 'Carregando…'
              : data
                ? `${data.total} ${data.total === 1 ? 'livro encontrado' : 'livros encontrados'}`
                : ''
            : isGridLoading && gridItems.length === 0
              ? 'Carregando…'
              : `${gridTotal} ${gridTotal === 1 ? 'livro encontrado' : 'livros encontrados'}`}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {viewMode === 'table' && (
            <div className="flex items-center gap-2 text-sm">
              <label htmlFor="page-size-select" className="text-slate-600 dark:text-slate-400 whitespace-nowrap">
                Itens por página
              </label>
              <select
                id="page-size-select"
                value={String(pageSize)}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setPage(1)
                }}
                className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm min-h-[36px] focus-visible:outline-2 focus-visible:outline-[var(--color-focus)]"
                aria-label="Itens por página"
              >
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="30">30</option>
                <option value="50">50</option>
              </select>
            </div>
          )}
          <div role="group" aria-label="Modo de visualização" className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-1 gap-1">
          <Button
            size="sm"
            variant={viewMode === 'table' ? 'primary' : 'secondary'}
            aria-pressed={viewMode === 'table'}
            onClick={() => setViewMode('table')}
            aria-label="Visualização em tabela"
            className={`gap-1.5 ${viewMode === 'table' ? '!bg-blue-600 !text-white hover:!bg-blue-700 !border-blue-600 dark:!bg-blue-600 dark:!text-white dark:hover:!bg-blue-700' : ''}`}
          >
            <Table className="h-4 w-4" aria-hidden="true" /> Tabela
          </Button>
          <Button
            size="sm"
            variant={viewMode === 'grid' ? 'primary' : 'secondary'}
            aria-pressed={viewMode === 'grid'}
            onClick={() => setViewMode('grid')}
            aria-label="Visualização em grade"
            className={`gap-1.5 ${viewMode === 'grid' ? '!bg-blue-600 !text-white hover:!bg-blue-700 !border-blue-600 dark:!bg-blue-600 dark:!text-white dark:hover:!bg-blue-700' : ''}`}
          >
            <LayoutGrid className="h-4 w-4" aria-hidden="true" /> Grade
          </Button>
        </div>
        </div>
      </div>

      <section aria-labelledby="books-list-heading">
        <h2 id="books-list-heading" className="sr-only">
          Lista de livros
        </h2>

        {isLoading && viewMode === 'table' && (
          <div className="grid gap-3" aria-busy="true" aria-live="polite">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl border border-slate-200 dark:border-slate-700 animate-pulse bg-slate-50 dark:bg-slate-800" />
            ))}
          </div>
        )}
        {isGridLoading && viewMode === 'grid' && (
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6" aria-busy="true" aria-live="polite">
            {Array.from({ length: GRID_SIZE }).map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded-xl border border-slate-200 dark:border-slate-700 animate-pulse bg-slate-100 dark:bg-slate-800" />
            ))}
          </div>
        )}

        {isError && viewMode === 'table' && (
          <div role="alert" className="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 p-4 text-sm text-red-800 dark:text-red-200">
            Erro ao carregar acervo: {(error as { message?: string })?.message ?? 'tente novamente'}
          </div>
        )}
        {isGridError && viewMode === 'grid' && (
          <div role="alert" className="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 p-4 text-sm text-red-800 dark:text-red-200">
            Erro ao carregar acervo: {(gridError as { message?: string })?.message ?? 'tente novamente'}
          </div>
        )}

        {data && viewMode === 'table' && (
          <>
            <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              <table className="w-full text-sm table-fixed">
                <caption className="sr-only">Tabela de livros com capa, título e descrição, disponibilidade, exemplares, data de cadastro e lançamento</caption>
                <thead className="bg-slate-50 dark:bg-slate-700/50 text-left">
                  <tr>
                    <th scope="col" className="px-3 py-3 font-semibold w-14 text-center">
                      Capa
                    </th>
                    <th scope="col" className="px-2 py-2 font-semibold w-[28%]">
                      Título
                    </th>
                    <th scope="col" className="px-5 py-3 font-semibold whitespace-nowrap w-[120px] text-center">
                      Disponibilidade
                    </th>
                    <th scope="col" className="px-5 py-3 font-semibold whitespace-nowrap w-[90px] text-center">
                      Exemplares
                    </th>
                    <th scope="col" className="px-3 py-3 font-semibold w-[12%] min-w-[105px] text-center">
                      Autores
                    </th>
                    <th scope="col" className="px-2 py-2 font-semibold text-center w-[96px]">
                      Gêneros
                    </th>
                    <th scope="col" className="px-6 py-3 font-semibold whitespace-nowrap w-[88px] text-center">
                      Lançamento
                    </th>
                    <th scope="col" className="px-6 py-3 font-semibold whitespace-nowrap w-[90px] text-center">
                      Cadastro
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
                      <td className="px-2 py-2">
                        {b.cover_url ? (
                          <CoverImage
                            src={b.cover_url}
                            title={b.title}
                            alt={`Capa de ${b.title}`}
                            width={72}
                            height={108}
                            className="h-12 w-9 mx-auto rounded-md border border-slate-200 dark:border-slate-600"
                            sizes="36px"
                          />
                        ) : (
                          <div
                            className="w-9 h-12 rounded overflow-hidden flex items-center justify-center shadow-sm mx-auto border border-slate-200 dark:border-slate-600"
                            style={{ background: getBookCoverGradient(b.title) }}
                          >
                            <BookOpen className="h-5 w-5 text-white/80 drop-shadow-sm" aria-hidden="true" />
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-2 w-[28%]">
                        <div className="flex flex-col gap-1 min-w-0">
                          <span className="line-clamp-2 break-words font-medium text-slate-900 dark:text-slate-100" title={b.title}>
                            {b.title}
                          </span>
                          {b.description ? (
                            <span className="line-clamp-2 break-words text-xs leading-snug text-slate-500 dark:text-slate-400" title={b.description}>
                              {b.description}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <Badge tone={bookStateTone(b.derived_state)}>{bookStateLabel(b.derived_state)}</Badge>
                      </td>
                      <td className="px-5 py-3 text-center">
                        {typeof b.total_copies === 'number' ? (
                          <Badge tone="neutral" title={`${b.available_copies ?? 0} de ${b.total_copies} disponíveis`}>
                            {b.available_copies ?? 0}/{b.total_copies}
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <OverflowTags items={b.authors} tone="info" maxVisibleFallback={2} className="max-w-[15ch] mx-auto justify-center" />
                      </td>
                      <td className="px-2 py-2">
                        <OverflowTags items={b.genres} tone="neutral" maxVisibleFallback={2} className="max-w-[12ch] mx-auto justify-center" />
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-center bg-slate-50/70 dark:bg-slate-700/20 text-xs font-medium text-slate-600 dark:text-slate-300">{b.published_date ? new Date(b.published_date).toLocaleDateString('pt-BR') : '—'}</td>
                      <td className="px-6 py-3 whitespace-nowrap text-center bg-slate-50/70 dark:bg-slate-700/20 text-xs font-medium text-slate-600 dark:text-slate-300">{b.created_at ? new Date(b.created_at).toLocaleDateString('pt-BR') : '—'}</td>
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
                    <CoverImage
                      src={b.cover_url}
                      title={b.title}
                      alt={`Capa de ${b.title}`}
                      width={160}
                      height={240}
                      className="h-28 w-20 shrink-0 rounded-xl border border-slate-200 dark:border-slate-600"
                      sizes="80px"
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="line-clamp-2 text-[15px] font-bold leading-snug text-slate-900 dark:text-slate-100 group-hover:text-[#0f4c75] dark:group-hover:text-white transition-colors">
                          {b.title}
                        </h3>
                        <Badge tone={bookStateTone(b.derived_state)} className="shrink-0 text-[11px] px-2 py-0.5">
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
                            <div className="flex flex-nowrap gap-1 items-center">
                              {b.authors.slice(0, 1).map((a) => (
                                <Badge key={a.id} tone="info" className="text-[11px] px-2 py-0 shrink-0 whitespace-nowrap">
                                  {a.name}
                                </Badge>
                              ))}
                              {b.authors.length > 1 && (
                                <span className="relative inline-flex group/authors shrink-0">
                                  <span className="cursor-help rounded-full bg-sky-100 dark:bg-sky-900/30 px-2 py-0.5 text-[11px] font-bold text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-700">+{b.authors.length - 1}</span>
                                  <span className="pointer-events-none absolute bottom-full left-1/2 z-20 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white shadow-xl border border-slate-700 group-hover/authors:block mb-1 max-w-[200px] text-center">
                                    {b.authors.slice(1).map((a) => a.name).join(', ')}
                                  </span>
                                </span>
                              )}
                            </div>
                          )}
                          {b.genres?.length > 0 && (
                            <div className="flex flex-nowrap gap-1 items-center">
                              {b.genres.slice(0, 2).map((g) => (
                                <Badge key={g.id} tone="neutral" className="text-[11px] px-2 py-0 shrink-0 whitespace-nowrap">
                                  {g.name}
                                </Badge>
                              ))}
                              {b.genres.length > 2 && (
                                <span className="relative inline-flex group/genres shrink-0">
                                  <span className="cursor-help rounded-full bg-slate-200 dark:bg-slate-700 px-2 py-0.5 text-[11px] font-bold text-slate-700 dark:text-slate-200">+{b.genres.length - 2}</span>
                                  <span className="pointer-events-none absolute bottom-full left-1/2 z-20 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white shadow-xl border border-slate-700 group-hover/genres:block mb-1 max-w-[200px] text-center">
                                    {b.genres.slice(2).map((g) => g.name).join(', ')}
                                  </span>
                                </span>
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
        {viewMode === 'grid' && gridData && (
          <>
            <div role="grid" aria-label="Grade de livros" className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {gridItems.map((b, index) => (
                <GridCard key={b.id} book={b as any} index={index} />
              ))}
            </div>
            {gridItems.length === 0 && !isGridLoading && <p className="text-sm text-slate-500 py-8 text-center">Nenhum livro encontrado.</p>}

            {/* sentinel + estados da paginação infinita */}
            <div ref={sentinelRef} aria-hidden="true" className="h-1" />

            {isFetchingNextPage && (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-500" aria-live="polite" aria-busy="true">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Carregando mais livros…
              </div>
            )}

            {!hasNextPage && gridItems.length > 0 && (
              <p className="text-center text-xs text-slate-400 py-4">
                {gridTotal} {gridTotal === 1 ? 'livro' : 'livros'} carregados — fim do acervo
              </p>
            )}

            {hasNextPage && !isFetchingNextPage && (
              <div className="flex justify-center pt-2">
                <Button variant="secondary" size="sm" onClick={() => fetchNextPage()} aria-label="Carregar mais livros">
                  Carregar mais
                </Button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}
