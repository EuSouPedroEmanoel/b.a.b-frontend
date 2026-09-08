import { Link } from 'react-router-dom'
import { PageDescription } from '@/components/ui/PageDescription'

export function GuestHome() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Biblioteca Ginásio</h1>
        <PageDescription className="max-w-3xl">
          Consulte os livros disponíveis no acervo público.
        </PageDescription>
      </header>

      <section aria-labelledby="public-catalog-heading" className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
        <h2 id="public-catalog-heading" className="text-lg font-semibold">Explore o acervo</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Pesquise títulos, autores e gêneros da biblioteca.
        </p>
        <Link
          to="/acervo"
          className="mt-4 inline-flex min-h-[44px] items-center rounded-md bg-[#0f4c75] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0e3f61] focus-visible:outline-3 focus-visible:outline-[var(--color-focus)] focus-visible:outline-offset-2 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
        >
          Ver acervo
        </Link>
      </section>
    </div>
  )
}
