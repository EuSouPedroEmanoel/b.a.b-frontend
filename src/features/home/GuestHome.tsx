import { Link } from 'react-router-dom'
import { PageDescription } from '@/components/ui/PageDescription'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { ProgressiveCarouselSection } from './ProgressiveCarouselSection'
import { GridCard } from '@/features/books/GridCard'

// Mantém o mesmo tamanho mínimo da grade do Acervo em cada breakpoint.
const homeCarouselItemClasses = 'relative w-[min(var(--carousel-viewport-width,100vw),calc(4rem_+_var(--text-sm)_*_3))] shrink-0 md:w-[min(var(--carousel-viewport-width,100vw),calc(9rem_+_var(--text-sm)_*_3.5))]'

function renderBook(book: any, index: number, ranking = false) {
  return <div className={homeCarouselItemClasses}><GridCard book={book} index={index} isGuest portalHover rankingPosition={ranking ? index + 1 : undefined} /></div>
}

function measureBook() {
  return <div data-carousel-measure-item aria-hidden="true" className={`h-0 ${homeCarouselItemClasses}`} />
}

export function GuestHome() {
  const { data } = useQuery({ queryKey: ['guest-home'], queryFn: async () => (await api.get('/books/home')).data })
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Base de Acesso Bibliotecário</h1>
        <PageDescription className="max-w-3xl">
          Consulte os livros disponíveis no acervo público.
        </PageDescription>
      </header>

      <section aria-labelledby="public-catalog-heading" className="flex w-full flex-col items-center justify-center gap-[1.1rem] rounded-xl border border-slate-200 bg-white p-4 text-center dark:border-slate-700 dark:bg-slate-800">
        <h2 id="public-catalog-heading" className="text-lg font-semibold">Explore o acervo</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Pesquise títulos, autores e gêneros da biblioteca.
        </p>
        <Link
          to="/acervo"
          className="inline-flex min-h-[44px] items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus-visible:outline-3 focus-visible:outline-[var(--color-focus)] focus-visible:outline-offset-2"
        >
          Ver acervo
        </Link>
      </section>
      {(data?.carousels ?? []).map((section: { type: string; title: string; books: any[]; ranking?: boolean }, index: number) => (
        <ProgressiveCarouselSection key={section.type} title={section.title} items={section.books} circular={!section.ranking} renderItem={(book, cardIndex) => renderBook(book, cardIndex, section.ranking)} measureItem={measureBook} emptyText="Nenhum livro disponível nesta seção." priority={index === 0} />
      ))}
    </div>
  )
}
