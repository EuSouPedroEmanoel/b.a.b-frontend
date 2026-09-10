import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, BookOpen, Calendar, Clock, Funnel, Hash, LayoutGrid, Loader2, Plus, Table } from 'lucide-react'
import api from '@/lib/api'
import { bookStateLabel, bookStateTone, publicBookStateLabel, publicBookStateTone } from '@/lib/bookStates'
import { useAnnouncer } from '@/components/feedback/LiveRegionContext'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Pagination } from '@/components/ui/Pagination'
import { PageDescription } from '@/components/ui/PageDescription'
import { Select } from '@/components/ui/Select'
import { Tooltip } from '@/components/ui/Tooltip'
import { OverflowTags } from '@/components/ui/OverflowTags'
import { CoverImage } from '@/components/ui/CoverImage'
import { getBookCoverGradient } from '@/lib/coverColor'
import { clearCatalogSnapshot, createCatalogOrigin, detailRouteState, readCatalogSnapshot, saveCatalogSnapshot } from '@/lib/catalogNavigation'
import { GridCard } from './GridCard'
import { hasPersonalReaderCapability } from '@/lib/permissions'

type Book = { id: number; title: string; description: string | null; derived_state: string; isbn: string | null; is_active: boolean; added_by: number; cover_url: string | null; published_date: string | null; created_at: string | null; updated_at: string | null; total_copies?: number; available_copies?: number; genres: { id: number; name: string; slug: string }[]; authors: { id: number; name: string; slug: string }[] }

function availabilityText(book: Book): string {
  const total = book.total_copies ?? 0
  const available = book.available_copies ?? 0
  if (total === 0) return '0 exemplares'
  return `${available} de ${total} ${available === 1 ? 'disponível' : 'disponíveis'}`
}

function defaultViewForRole(role?: string): 'table' | 'grid' {
  return role === 'student' || role === 'teacher' || role === 'guest' ? 'grid' : 'table'
}

function viewPreferenceKey(user: { id?: number; role?: string } | null): string {
  return user?.id ? `acervo:viewMode:user:${user.id}` : 'acervo:viewMode:guest'
}

function readViewPreference(user: { id?: number; role?: string } | null): 'table' | 'grid' | null {
  try {
    const value = window.localStorage.getItem(viewPreferenceKey(user))
    return value === 'table' || value === 'grid' ? value : null
  } catch { return null }
}
type Paginated<T> = { items: T[]; total: number; page: number; size: number; pages: number }
type Resolve = { kind: 'isbn' | 'internal_code' | 'title' | 'none'; book_id: number | null }
type BookSuggestion = { id: number; title: string; isbn: string | null }
type AuthorSuggestion = { id: number; name: string; slug: string }
type GenreSuggestion = { id: number; name: string; slug: string }
type SuggestItem =
  | { kind: 'author'; id: number; name: string }
  | { kind: 'genre'; id: number; name: string }
  | { kind: 'book'; id: number; title: string; isbn: string | null }
  | { kind: 'availability'; state: string; label: string }

const DESKTOP_MEDIA_QUERY = '(min-width: 768px)'

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined') return false
    if (typeof window.matchMedia === 'function') return window.matchMedia(DESKTOP_MEDIA_QUERY).matches
    return window.innerWidth >= 768
  })

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined
    const media = window.matchMedia(DESKTOP_MEDIA_QUERY)
    const update = () => setIsDesktop(media.matches)
    update()
    media.addEventListener?.('change', update)
    return () => media.removeEventListener?.('change', update)
  }, [])

  return isDesktop
}

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
  const [authorFilter, setAuthorFilter] = useState('')
  const [stateFilter, setStateFilter] = useState('')
  const [sortBy, setSortBy] = useState<'title' | 'created_at' | 'published_date' | 'author'>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [tableTime, setTableTime] = useState<number | null>(null)
  const [gridTime, setGridTime] = useState<number | null>(null)
  const announce = useAnnouncer()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, loading: authLoading } = useAuth()
  const canCreate = !!user && ['librarian', 'school_admin'].includes(user.role)
  const isPersonalCatalog = hasPersonalReaderCapability(user?.role)
  const isGuest = user?.role === 'guest'
  const isDesktop = useIsDesktop()
  const deniedNoticeRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    if (!(location.state as { accessDenied?: boolean } | null)?.accessDenied) return
    window.requestAnimationFrame(() => deniedNoticeRef.current?.focus())
  }, [location.state])

  const [viewMode, setViewMode] = useState<'table' | 'grid'>(() => defaultViewForRole(user?.role))
  const hydratedPreference = useRef(false)

  useEffect(() => {
    if (authLoading) return
    if (hydratedPreference.current) return
    const saved = typeof window !== 'undefined' ? readViewPreference(user) : null
    if (saved) setViewMode(saved)
    hydratedPreference.current = true
  }, [authLoading, user])

  const chooseViewMode = (mode: 'table' | 'grid') => {
    setViewMode(mode)
    try { window.localStorage.setItem(viewPreferenceKey(user), mode) } catch { /* armazenamento indisponível */ }
  }

  useEffect(() => {
    localStorage.setItem('acervo:pageSize', String(pageSize))
  }, [pageSize])

  const openBook = useCallback((bookId: number) => {
    const origin = createCatalogOrigin(`${location.pathname}${location.search}`, viewMode)
    if (origin) saveCatalogSnapshot(origin, window.scrollY)
    navigate(`/acervo/${bookId}`, { state: detailRouteState(origin) })
  }, [location.pathname, location.search, navigate, viewMode])

  const availabilityOptions = useMemo(
    () => [
      { value: '', label: 'Todas' },
      { value: 'available', label: 'Disponível' },
      { value: 'borrowed', label: 'Emprestado' },
      { value: 'reserved', label: 'Reservado' },
      { value: 'lost', label: 'Perdido' },
      { value: 'archived', label: 'Arquivado' },
    ].filter((option) => {
      if (isGuest) return ['','available'].includes(option.value)
      return !isPersonalCatalog || !['lost', 'archived'].includes(option.value)
    }),
    [isGuest, isPersonalCatalog],
  )

  const hasActiveFilters = !!genreFilter || !!authorFilter || !!stateFilter || sortBy !== 'created_at'

  // Inicializa a partir da URL para link de query page compartilhável
  useEffect(() => {
    const q = searchParams.get('q') ?? ''
    const genre = searchParams.get('genre_id') ?? ''
    const author = searchParams.get('author_id') ?? ''
    const state = searchParams.get('state') ?? ''
    const p = parseInt(searchParams.get('page') ?? '1', 10)
    const size = parseInt(searchParams.get('size') ?? '', 10)
    const sort = searchParams.get('sort_by') as any
    const order = searchParams.get('sort_order') as any
    if (q) {
      setQuery(q)
      setQueryQ(q)
    }
    if (genre) setGenreFilter(genre)
    if (author) setAuthorFilter(author)
    if (state && (!isPersonalCatalog || !['lost', 'archived'].includes(state))) setStateFilter(state)
    if (!Number.isNaN(p) && p !== 1) setPage(p)
    if (!Number.isNaN(size) && [10, 20, 30, 50].includes(size)) setPageSize(size)
    if (sort && sort !== sortBy) setSortBy(sort)
    if (order && (order === 'asc' || order === 'desc') && order !== sortOrder) setSortOrder(order)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPersonalCatalog])

  // Sincroniza estado com URL para link compartilhável
  useEffect(() => {
    const params = new URLSearchParams()
    if (queryQ) params.set('q', queryQ)
    if (genreFilter) params.set('genre_id', genreFilter)
    if (authorFilter) params.set('author_id', authorFilter)
    if (stateFilter) params.set('state', stateFilter)
    if (page !== 1) params.set('page', String(page))
    if (pageSize !== 10) params.set('size', String(pageSize))
    if (sortBy !== 'created_at') params.set('sort_by', sortBy)
    if (sortOrder !== 'asc') params.set('sort_order', sortOrder)
    const cur = searchParams.toString()
    const next = params.toString()
    if (cur !== next) setSearchParams(params, { replace: true })
  }, [queryQ, genreFilter, authorFilter, stateFilter, page, pageSize, sortBy, sortOrder, searchParams, setSearchParams])

  const { data: genreOptions } = useQuery({
    queryKey: ['genres-list'],
    queryFn: async () => {
      const { data } = await api.get<{ items: { id: number; name: string }[] }>('/genres/?size=50')
      return data.items
    },
  })

  // Tabela: paginação clássica (até 50)
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['books', 'table', page, pageSize, queryQ, genreFilter, authorFilter, stateFilter, sortBy, sortOrder],
    queryFn: async () => {
      const t0 = performance.now()
      const params = new URLSearchParams({ page: String(page), size: String(pageSize) })
      if (queryQ) params.set('q', queryQ)
      if (genreFilter) params.set('genre_id', genreFilter)
      if (authorFilter) params.set('author_id', authorFilter)
      if (stateFilter) params.set('state', stateFilter)
      if (sortBy) params.set('sort_by', sortBy)
      if (sortOrder) params.set('sort_order', sortOrder)
      const { data } = await api.get<Paginated<Book>>(`/books/?${params}`)
      setTableTime(performance.now() - t0)
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
    queryKey: ['books', 'grid', queryQ, genreFilter, authorFilter, stateFilter, sortBy, sortOrder],
    queryFn: async ({ pageParam = 1 }) => {
      const t0 = performance.now()
      const params = new URLSearchParams({ page: String(pageParam), size: String(GRID_SIZE) })
      if (queryQ) params.set('q', queryQ)
      if (genreFilter) params.set('genre_id', genreFilter)
      if (authorFilter) params.set('author_id', authorFilter)
      if (stateFilter) params.set('state', stateFilter)
      if (sortBy) params.set('sort_by', sortBy)
      if (sortOrder) params.set('sort_order', sortOrder)
      const { data } = await api.get<Paginated<Book>>(`/books/?${params}`)
      if (pageParam === 1) setGridTime(performance.now() - t0)
      return data
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.page < lastPage.pages ? lastPage.page + 1 : undefined),
    enabled: viewMode === 'grid',
  })

  const gridItems = gridData?.pages.flatMap((p) => p.items) ?? []
  const gridTotal = gridData?.pages[0]?.total ?? 0
  const [searchPlaceholder, setSearchPlaceholder] = useState('Ex.: título de um livro do acervo')
  const placeholderTitles = useMemo(
    () => (viewMode === 'table' ? data?.items ?? [] : gridData?.pages.flatMap((pageData) => pageData.items) ?? [])
      .map((book) => book.title.trim())
      .filter(Boolean),
    [data?.items, gridData, viewMode],
  )

  useEffect(() => {
    if (!placeholderTitles.length) return
    const randomTitle = placeholderTitles[Math.floor(Math.random() * placeholderTitles.length)]
    setSearchPlaceholder(`Ex.: ${randomTitle}`)
  }, [placeholderTitles])

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
  const filterTriggerRef = useRef<HTMLButtonElement>(null)
  const sortOrderButtonRef = useRef<HTMLButtonElement>(null)

  const closeFilterMenu = useCallback(() => {
    setFilterMenuOpen(false)
    window.setTimeout(() => filterTriggerRef.current?.focus(), 0)
  }, [])

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

  // A restauração só acontece para a intenção explícita de retorno do detalhe.
  useEffect(() => {
    const intent = (location.state as { catalogNavigationIntent?: string } | null)?.catalogNavigationIntent
    const url = `${location.pathname}${location.search}`
    if (intent === 'new-catalog-navigation') {
      clearCatalogSnapshot()
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
      return undefined
    }
    if (intent !== 'return-to-catalog') return undefined

    const snapshot = readCatalogSnapshot(url)
    if (!snapshot) return undefined
    if (snapshot.viewMode && snapshot.viewMode !== viewMode) setViewMode(snapshot.viewMode)

    let cancelled = false
    const restore = () => {
      if (cancelled) return
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (!cancelled) window.scrollTo({ top: snapshot.scrollY, behavior: 'instant' as ScrollBehavior })
        }, 50)
      })
    }
    restore()
    const retry = window.setTimeout(restore, 300)
    const clear = window.setTimeout(clearCatalogSnapshot, 2000)
    return () => {
      cancelled = true
      window.clearTimeout(retry)
      window.clearTimeout(clear)
    }
  }, [isGridLoading, isLoading, location.pathname, location.search, location.state, viewMode])

  const hasSearchQuery = searchParams.has('q')

  useEffect(() => {
    if (hasSearchQuery) return
    searchInputRef.current?.focus()
  }, [hasSearchQuery])

  useEffect(() => {
    if (!filterMenuOpen) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (filterWrapperRef.current && !filterWrapperRef.current.contains(t)) {
        closeFilterMenu()
      }
    }
    const onClickCapture = (e: MouseEvent) => {
      const t = e.target as Node
      if (filterWrapperRef.current && !filterWrapperRef.current.contains(t)) {
        e.preventDefault()
        e.stopPropagation()
        // mousedown já fechou, garante fechado
        closeFilterMenu()
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeFilterMenu()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('click', onClickCapture, true)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('click', onClickCapture, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [closeFilterMenu, filterMenuOpen])

  useLayoutEffect(() => {
    const filterButton = filterTriggerRef.current
    const sortButton = sortOrderButtonRef.current
    if (!filterButton || !sortButton) return

    const syncSquareSize = () => {
      sortButton.style.width = `${filterButton.getBoundingClientRect().height}px`
    }

    syncSquareSize()
    const observer = new ResizeObserver(syncSquareSize)
    observer.observe(filterButton)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!filterMenuOpen) return
    window.requestAnimationFrame(() => {
      filterMenuRef.current?.querySelector<HTMLElement>('button[role="combobox"]')?.focus()
    })
  }, [filterMenuOpen])

  const trapFilterFocus = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return
    const focusable = Array.from(filterMenuRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled)') ?? [])
    if (!focusable.length) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

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
          // disponibilidade: mostra quando digita "disp", "emp", "res", etc.
          const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          const rawNorm = normalize(raw)
          const availOptions: SuggestItem[] = availabilityOptions
            .filter((o) => o.value !== '' && rawNorm.length >= 2 && normalize(o.label).includes(rawNorm))
            .slice(0, 2)
            .map((o) => ({ kind: 'availability' as const, state: o.value, label: o.label }))
          // mostra disponibilidade primeiro, depois autor/gênero, depois livros
          const combined: SuggestItem[] = [...availOptions, ...authors, ...genres, ...books].slice(0, 8)
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
  }, [query, availabilityOptions])

  const closeSuggestions = () => {
    setSuggestOpen(false)
    setActiveIndex(-1)
  }

  const openSuggestion = (s: SuggestItem) => {
    closeSuggestions()
    searchInputRef.current?.blur()
    if (s.kind === 'book') {
      setQuery('')
      setQueryQ('')
      openBook(s.id)
    } else if (s.kind === 'availability') {
      setQuery('')
      setQueryQ('')
      setStateFilter(s.state)
      setPage(1)
      announce(`Filtrando por ${s.label}`, 'polite')
      return
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
    searchInputRef.current?.blur()
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
      openBook(res.book_id)
      return
    }
    if (res.kind === 'internal_code' && res.book_id) {
      openBook(res.book_id)
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
          {(location.state as { accessDenied?: boolean } | null)?.accessDenied && (
            <p ref={deniedNoticeRef} role="alert" tabIndex={-1} className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 outline-none dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-100">
              Entre com sua conta para continuar.
            </p>
          )}
          <PageDescription>{isGuest ? 'Busca por título, ISBN, gênero, autor ou disponibilidade.' : 'Busca por título, ISBN, código interno, gênero, autor ou disponibilidade. ISBN não cadastrado abre o cadastro automaticamente.'}</PageDescription>
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
          <form onSubmit={onSearch} className="flex flex-wrap items-start gap-3" role="search" aria-label="Buscar livros">
            <div className="order-[1] flex min-w-0 flex-[1_1_72%] flex-wrap items-start gap-3">
              <div className="relative min-w-0 basis-full sm:flex-1">
                <div>
                  <Input
                    label="Buscar"
                    id="book-search"
                    ref={searchInputRef}
                    placeholder={searchPlaceholder}
                    className="!pr-3"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={onKeyDown}
                    onFocus={() => query.trim().length >= 2 && setSuggestOpen(true)}
                    onBlur={() => setTimeout(closeSuggestions, 120)}
                    aria-autocomplete="list"
                    role="combobox"
                    aria-expanded={suggestOpen && suggestItems.length > 0}
                    aria-controls={suggestListId}
                    aria-haspopup="listbox"
                    aria-activedescendant={activeIndex >= 0 ? `${suggestListId}-${activeIndex}` : undefined}
                    hint="Busque por título, gênero, autor ou disponibilidade — autocomplete disponível"
                  />
                </div>
                {suggestOpen && suggestItems.length > 0 && (
                  <ul
                    id={suggestListId}
                    role="listbox"
                    aria-label="Sugestões de livros, autores, gêneros e disponibilidade"
                    className="absolute left-0 right-0 top-full z-30 mt-1 max-h-[min(18rem,calc(100dvh-8rem))] overflow-y-auto overscroll-contain rounded-md border border-slate-300 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-800"
                  >
                    {suggestItems.map((s, i) => (
                      <li
                        key={`${s.kind}-${(s as any).id ?? (s as any).state}`}
                        id={`${suggestListId}-${i}`}
                        role="option"
                        aria-selected={i === activeIndex}
                        onPointerDown={(e) => {
                          e.preventDefault()
                          openSuggestion(s)
                        }}
                        onMouseEnter={() => setActiveIndex(i)}
                        className={`flex items-center justify-between gap-3 px-3 py-2.5 text-sm cursor-pointer min-h-[44px] border-b last:border-0 border-slate-100 dark:border-slate-700 ${i === activeIndex ? 'bg-[#0f4c75] text-white' : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                      >
                        {s.kind === 'book' ? (
                          <>
                            <span className="truncate min-w-0 flex-1 font-medium text-left">{s.title}</span>
                            {s.isbn && (
                              <span className={`font-mono text-xs shrink-0 ${i === activeIndex ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}>
                                {s.isbn}
                              </span>
                            )}
                          </>
                        ) : s.kind === 'availability' ? (
                          <>
                            <span className="truncate min-w-0 flex-1 font-medium text-left">{(s as any).label}</span>
                            <span className={`text-xs font-medium shrink-0 px-2 py-0.5 rounded-full ${i === activeIndex ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'}`}>Disponibilidade</span>
                          </>
                        ) : s.kind === 'author' ? (
                          <>
                            <span className="truncate min-w-0 flex-1 font-semibold text-left">{s.name}</span>
                            <span className={`text-xs font-medium shrink-0 px-2 py-0.5 rounded-full ${i === activeIndex ? 'bg-white/20 text-white' : 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300'}`}>Autor</span>
                          </>
                        ) : (
                          <>
                            <span className="truncate min-w-0 flex-1 font-medium text-left">{s.name}</span>
                            <span className={`text-xs font-medium shrink-0 px-2 py-0.5 rounded-full ${i === activeIndex ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'}`}>Gênero</span>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
                <Button
                  type="submit"
                  className="mt-[calc(var(--text-sm)*var(--text-sm--line-height)+0.375rem)] h-[calc(var(--text-base)*var(--text-base--line-height)+1.25rem)] shrink-0"
                >
                  Buscar
                </Button>
              </div>
            <div className="order-[2] mt-[calc(var(--text-sm)*var(--text-sm--line-height)+0.375rem)] ml-auto flex shrink-0 flex-wrap items-stretch gap-2 pl-5">
              <div ref={filterWrapperRef} className="relative shrink-0 self-stretch">
                <Button
                  ref={filterTriggerRef}
                  type="button"
                  variant={hasActiveFilters ? 'primary' : 'secondary'}
                  onClick={() => {
                    if (filterMenuOpen) closeFilterMenu()
                    else setFilterMenuOpen(true)
                  }}
                  aria-haspopup="dialog"
                  aria-expanded={filterMenuOpen}
                  aria-controls="filter-menu"
                  aria-label="Filtros"
                  className={`relative z-30 h-full gap-2 transition-colors ${hasActiveFilters ? '' : 'hover:!bg-slate-100 dark:hover:!bg-slate-700'}`}
                >
                  <Funnel className="h-4 w-4" aria-hidden="true" />
                  Filtros
                  {hasActiveFilters && (
                    <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-xs font-bold text-blue-600 dark:bg-white dark:text-slate-900" aria-hidden="true">
                      {[genreFilter, authorFilter, stateFilter, sortBy !== 'created_at' ? sortBy : null].filter(Boolean).length}
                    </span>
                  )}
                </Button>
                {filterMenuOpen && (
                  <>
                    <div
                      aria-hidden="true"
                      onClick={closeFilterMenu}
                      className="fixed inset-0 z-20 cursor-default bg-transparent"
                    />
                    <div
                      id="filter-menu"
                      ref={filterMenuRef}
                      role="dialog"
                      aria-modal="true"
                      aria-labelledby="filter-menu-title"
                      onKeyDown={trapFilterFocus}
                      className="fixed inset-x-0 bottom-0 z-30 flex max-h-[min(85dvh,40rem)] w-full flex-col gap-4 overflow-hidden rounded-t-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-800 sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-full sm:mt-2 sm:max-h-none sm:w-80 sm:-translate-x-1/2 sm:rounded-xl"
                    >
                      <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-700">
                        <h3 id="filter-menu-title" className="text-base font-semibold">Filtros</h3>
                        <Button type="button" variant="ghost" size="sm" onClick={closeFilterMenu} aria-label="Fechar filtros">
                          Fechar
                        </Button>
                      </div>
                      <div className="flex min-h-0 flex-col gap-4 overflow-y-auto overscroll-contain">
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
                      </div>
                      <div className="flex justify-between gap-2 border-t border-slate-200 pt-3 dark:border-slate-700">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          setGenreFilter('')
                          setAuthorFilter('')
                          setStateFilter('')
                          setSortBy('created_at')
                          setSortOrder('asc')
                          setPage(1)
                        }}
                        className="hover:!bg-slate-100 dark:hover:!bg-slate-700 transition-colors"
                      >
                        Limpar filtros
                      </Button>
                      <Button type="button" onClick={closeFilterMenu}>
                        Aplicar
                      </Button>
                    </div>
                  </div>
                  </>
                )}
              </div>
              <Button
                ref={sortOrderButtonRef}
                type="button"
                variant="secondary"
                onClick={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
                aria-label={sortOrder === 'asc' ? 'Ordem crescente' : 'Ordem decrescente'}
                aria-describedby="sort-order-tooltip"
                className="group relative min-w-0 shrink-0 self-stretch !px-0 hover:!bg-slate-100 dark:hover:!bg-slate-700 transition-colors"
              >
                {sortOrder === 'asc' ? <ArrowUp className="size-[calc(var(--text-sm)*1.15)]" /> : <ArrowDown className="size-[calc(var(--text-sm)*1.15)]" />}
                <Tooltip id="sort-order-tooltip">
                  {sortOrder === 'asc' ? 'Ordem crescente' : 'Ordem decrescente'}
                </Tooltip>
              </Button>
            </div>
            {(queryQ || hasActiveFilters) && (
              <div className="order-[4] flex basis-full flex-wrap gap-2">
                {queryQ && <Badge tone="info">Busca: {queryQ}</Badge>}
                {genreFilter && <Badge tone="neutral">Gênero aplicado</Badge>}
                {authorFilter && <Badge tone="info">Autor aplicado</Badge>}
                {stateFilter && <Badge tone="neutral">Disponibilidade: {availabilityOptions.find((o) => o.value === stateFilter)?.label}</Badge>}
                {hasActiveFilters && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setGenreFilter('')
                      setAuthorFilter('')
                      setStateFilter('')
                      setSortBy('created_at')
                      setSortOrder('asc')
                      setPage(1)
                    }}
                    className="whitespace-nowrap hover:!bg-slate-100 dark:hover:!bg-slate-700 transition-colors"
                  >
                    Limpar filtros
                  </Button>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setQuery('')
                    setQueryQ('')
                    setGenreFilter('')
                    setAuthorFilter('')
                    setStateFilter('')
                    setPage(1)
                  }}
                  className="sm:hidden hover:!bg-slate-100 dark:hover:!bg-slate-700 transition-colors"
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
                ? `${data.total} ${data.total === 1 ? 'livro encontrado' : 'livros encontrados'}${tableTime !== null ? ` em ${tableTime < 1000 ? `${Math.round(tableTime)}ms` : `${(tableTime / 1000).toFixed(2)}s`}` : ''}`
                : ''
            : isGridLoading && gridItems.length === 0
              ? 'Carregando…'
              : `${gridTotal} ${gridTotal === 1 ? 'livro encontrado' : 'livros encontrados'}${gridTime !== null ? ` em ${gridTime < 1000 ? `${Math.round(gridTime)}ms` : `${(gridTime / 1000).toFixed(2)}s`}` : ''}`}
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
            onClick={() => chooseViewMode('table')}
            aria-label="Visualização em tabela"
            className={`gap-1.5 ${viewMode === 'table' ? '' : 'hover:!bg-slate-100 dark:hover:!bg-slate-700'}`}
          >
            <Table className="h-4 w-4" aria-hidden="true" /> Tabela
          </Button>
          <Button
            size="sm"
            variant={viewMode === 'grid' ? 'primary' : 'secondary'}
            aria-pressed={viewMode === 'grid'}
            onClick={() => chooseViewMode('grid')}
            aria-label="Visualização em grade"
            className={`gap-1.5 ${viewMode === 'grid' ? '' : 'hover:!bg-slate-100 dark:hover:!bg-slate-700'}`}
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
            {isDesktop ? <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              <table className="w-full text-sm table-auto">
                <caption className="sr-only">Tabela de livros com capa, título e descrição, exemplares, autores, gêneros, ano e data de cadastro</caption>
                <thead className="bg-slate-50 dark:bg-slate-700/50 text-left">
                  <tr>
                    <th scope="col" className="px-3 py-3 font-semibold w-14 text-center">
                      Capa
                    </th>
                    <th scope="col" className="px-2 py-2 font-semibold w-[28%]">
                      Título
                    </th>
                    <th scope="col" className="px-5 py-3 font-semibold whitespace-nowrap w-[90px] text-center">
                      Disponibilidade
                    </th>
                    <th scope="col" className="w-[1%] max-w-[190px] px-3 py-3 font-semibold text-center">
                      Autores
                    </th>
                    <th scope="col" className="w-[1%] max-w-[150px] px-2 py-2 font-semibold text-center">
                      Gêneros
                    </th>
                    <th scope="col" className="px-2 py-3 font-semibold whitespace-nowrap w-[64px] text-center">
                      Ano
                    </th>
                    <th scope="col" className="px-2 py-3 font-semibold whitespace-nowrap w-[110px] text-center">
                      Cadastro
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {data.items.map((b) => (
                    <tr
                      key={b.id}
                      onClick={() => openBook(b.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          openBook(b.id)
                        }
                      }}
                      tabIndex={0}
                      role="link"
                      aria-label={`Abrir livro ${b.title}`}
                      className="hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--color-focus)] focus-visible:outline-offset-[-2px]"
                    >
                      <td className="w-[1%] max-w-[150px] px-2 py-2">
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
                      <td className="px-2 py-3 text-center">
                        {typeof b.total_copies === 'number' ? (
                          <div className="flex flex-col items-center justify-center gap-1"><span className="whitespace-nowrap text-sm font-medium text-slate-700 dark:text-slate-200">{availabilityText(b)}</span><Badge tone={isGuest ? publicBookStateTone(b.derived_state) : bookStateTone(b.derived_state)} onClick={(e: any) => { e.stopPropagation(); if (!isGuest) { setStateFilter(b.derived_state); setPage(1); announce(`Filtrando por ${bookStateLabel(b.derived_state)}`, 'polite') } }} onKeyDown={(e: any) => { if (!isGuest && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.stopPropagation(); setStateFilter(b.derived_state); setPage(1) } }} role={!isGuest ? 'button' : undefined} tabIndex={!isGuest ? 0 : undefined} title={isGuest ? publicBookStateLabel(b.derived_state) : `Filtrar por ${bookStateLabel(b.derived_state)}`}>{isGuest ? publicBookStateLabel(b.derived_state) : bookStateLabel(b.derived_state)}</Badge></div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="w-[1%] max-w-[190px] px-3 py-3">
                        <OverflowTags items={b.authors} tone="info" maxVisibleFallback={2} itemMaxWidthClass="max-w-[170px]" className="w-full max-w-none min-w-0 justify-start" onItemClick={(item) => { setQuery(item.name); setQueryQ(item.name); setAuthorFilter(String(item.id)); setPage(1); announce(`Filtrando por autor ${item.name}`, 'polite') }} />
                      </td>
                      <td className="px-2 py-2">
                        <OverflowTags items={b.genres} tone="neutral" maxVisibleFallback={2} maxVisible={1} itemMaxWidthClass="max-w-[140px]" className="w-full max-w-none min-w-0 justify-start" onItemClick={(item) => { setQuery(item.name); setQueryQ(item.name); setGenreFilter(String(item.id)); setPage(1); announce(`Filtrando por gênero ${item.name}`, 'polite') }} />
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-center dark:bg-slate-700/20 text-xs font-medium text-slate-600 dark:text-slate-300">{b.published_date ? new Date(b.published_date).getFullYear() : '—'}</td>
                      <td className="px-3 py-3 whitespace-nowrap text-center dark:bg-slate-700/20 text-xs font-medium text-slate-600 dark:text-slate-300">{b.created_at ? new Date(b.created_at).toLocaleDateString('pt-BR') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div> : <ul className="grid gap-4" role="list" aria-label="Lista de livros">
              {data.items.map((b) => (
                <li
                  key={b.id}
                  className="group relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm transition-all hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 active:scale-[0.99]"
                >
                  <Link
                    to={`/acervo/${b.id}`}
                    state={detailRouteState(createCatalogOrigin(`${location.pathname}${location.search}`, viewMode))}
                    onClick={() => {
                      const origin = createCatalogOrigin(`${location.pathname}${location.search}`, viewMode)
                      if (origin) saveCatalogSnapshot(origin, window.scrollY)
                    }}
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
                        <Badge tone={isGuest ? publicBookStateTone(b.derived_state) : bookStateTone(b.derived_state)} className="shrink-0 text-[11px] px-2 py-0.5" title={isGuest ? publicBookStateLabel(b.derived_state) : `Estado: ${bookStateLabel(b.derived_state)}`}>
                          {isGuest ? publicBookStateLabel(b.derived_state) : bookStateLabel(b.derived_state)}
                        </Badge>
                      </div>
                      <p className="flex items-center gap-1.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        <Hash className="h-3 w-3 opacity-60" aria-hidden="true" />
                        <span className="truncate">{b.isbn ?? 'Sem ISBN'}</span>
                      </p>
                    </div>
                  </Link>

                  <div className="mx-4 border-t border-slate-100 dark:border-slate-700" />

                  <div className="px-4 py-3 space-y-3">
                    {(b.authors.length > 0 || b.genres.length > 0) && <div className="flex min-w-0 flex-col gap-1.5">
                      {b.authors.length > 0 && <OverflowTags items={b.authors} tone="info" maxVisibleFallback={1} hiddenLabel="autores adicionais" itemMaxWidthClass="max-w-[18ch]" className="w-full" />}
                      {b.genres.length > 0 && <OverflowTags items={b.genres} tone="neutral" maxVisibleFallback={2} maxVisible={2} hiddenLabel="gêneros adicionais" itemMaxWidthClass="max-w-[18ch]" className="w-full" />}
                    </div>}
                    {b.description && (
                      <p className="line-clamp-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                        {b.description}
                      </p>
                    )}
                    {typeof b.total_copies === 'number' && <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs dark:bg-slate-700/40">
                      <span className="font-medium text-slate-500 dark:text-slate-400">Disponibilidade</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-200">{availabilityText(b)}</span>
                    </div>}
                    <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 dark:bg-slate-700/40 px-3 py-2.5">
                      <span className="flex items-center gap-1.5 text-xs">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white dark:bg-slate-600 border border-slate-200 dark:border-slate-500">
                          <Calendar className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300" aria-hidden="true" />
                        </span>
                        <span className="flex flex-col leading-none">
                          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Ano</span>
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{b.published_date ? new Date(b.published_date).getFullYear() : '—'}</span>
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
                  <div className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/5 dark:bg-white/10">
                      <ArrowDown className="h-3.5 w-3.5 -rotate-90 text-slate-400" aria-hidden="true" />
                    </span>
                  </div>
                </li>
              ))}
            </ul>}

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
                <GridCard key={b.id} book={b as any} index={index} isGuest={isGuest} />
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
