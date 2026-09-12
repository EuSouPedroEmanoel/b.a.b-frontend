import { PageDescription } from '@/components/ui/PageDescription'
import { useAuth } from '@/hooks/useAuth'
import { Link } from 'react-router-dom'
import { ProgressiveCarouselSection } from './ProgressiveCarouselSection'
import { GridCard } from '@/features/books/GridCard'
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import api from '@/lib/api'
import { useAnnouncer } from '@/components/feedback/LiveRegionContext'

type DiscoveryBook = {
  id: number
  title: string
  description: string | null
  derived_state: string
  isbn: string | null
  cover_url: string | null
  published_date: string | null
  genres: { id: number; name: string; slug: string }[]
  authors: { id: number; name: string; slug: string }[]
}


function renderDiscoveryBook(book: DiscoveryBook, index: number, ranking = false) {
  return (
    <div className="relative w-[140px] shrink-0 sm:w-[160px] lg:w-[180px]">
      <GridCard book={book} index={index} portalHover rankingPosition={ranking ? index + 1 : undefined} />
    </div>
  )
}

function measureDiscoveryBook() {
  return <div data-carousel-measure-item aria-hidden="true" className="relative h-0 w-[140px] shrink-0 sm:w-[160px] lg:w-[180px]" />
}

export function StudentHome() {
  const { user } = useAuth()
  const { data, isError, isLoading } = useQuery({
    queryKey: ['student-home'],
    queryFn: async () => (await api.get('/books/home')).data,
  })
  const announce = useAnnouncer()
  useEffect(() => {
    if (isError) announce('Não foi possível carregar suas recomendações.')
  }, [announce, isError])
  const recommendedBooks = isError ? [] : (data?.recommendedBooks ?? [])
  const newBooks = isError ? [] : (data?.newBooks ?? [])
  const genreBooks = isError ? [] : (data?.genreSections?.flatMap((section: { books: DiscoveryBook[] }) => section.books) ?? [])
  const carousels = isError ? [] : (data?.carousels ?? [])
  const homeCarousels = carousels.length ? carousels : [
    ...(recommendedBooks.length ? [{ type: 'recommended', title: 'Recomendados para você', books: recommendedBooks }] : []),
    ...(newBooks.length ? [{ type: 'new', title: 'Novidades', books: newBooks }] : []),
    ...(genreBooks.length ? [{ type: 'genres', title: 'Por gênero', books: genreBooks }] : []),
  ]
  const name = user?.name?.trim() || user?.username?.trim()

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="min-w-0 text-3xl font-bold tracking-tight [overflow-wrap:anywhere]">
          {name ? `Bem-vindo, ${name}` : 'Bem-vindo'}
        </h1>
        <PageDescription className="max-w-3xl">
          Descubra livros do seu interesse no acervo da sua escola.
        </PageDescription>
      </header>

      {isLoading && <div role="status" className="grid gap-4 sm:grid-cols-2"><span className="h-72 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" /><span className="h-72 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" /></div>}
      {isError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">Não foi possível carregar suas recomendações. Você ainda pode explorar o acervo.</p>}

      <div className="flex flex-col gap-6">
        {homeCarousels.map((section: { type: string; title: string; books: DiscoveryBook[]; emptyText?: string; ranking?: boolean }, index: number) => (
          <ProgressiveCarouselSection key={section.type} title={section.title} items={section.books} circular={!section.ranking} renderItem={(book, cardIndex) => renderDiscoveryBook(book, cardIndex, section.ranking)} measureItem={measureDiscoveryBook} emptyText={section.emptyText ?? 'Nenhum livro disponível nesta seção.'} priority={index === 0} />
        ))}

        <aside className="flex w-full flex-col items-center justify-center gap-[1.1rem] rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center dark:border-slate-700 dark:bg-slate-800/60 sm:flex-row">
          <p className="text-sm text-slate-600 dark:text-slate-300">Quer encontrar um livro específico?</p>
          <Link to="/acervo" className="inline-flex min-h-[44px] items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-3 focus-visible:outline-[var(--color-focus)] focus-visible:outline-offset-2">
            Explorar acervo
          </Link>
        </aside>
      </div>
    </div>
  )
}
