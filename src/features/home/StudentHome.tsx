import { PageDescription } from '@/components/ui/PageDescription'

export function StudentHome() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Início</h1>
        <PageDescription className="max-w-3xl">
          Encontre livros do acervo da sua escola.
        </PageDescription>
      </header>

      <section aria-labelledby="discover-books-heading" className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
        <h2 id="discover-books-heading" className="text-lg font-semibold">Descubra livros</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Esta área será preparada para ajudar você a explorar o acervo.
        </p>
      </section>
    </div>
  )
}
