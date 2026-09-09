type Props = {
  page: number
  pages: number
  total: number
  onChange: (p: number) => void
}

export function Pagination({ page, pages, total, onChange }: Props) {
  if (pages <= 1) return null
  return (
    <nav aria-label="Paginação" className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
      <p className="text-sm text-slate-500">
        Total <span className="font-medium text-slate-700 dark:text-slate-200">{total}</span> itens — página {page} de {pages}
      </p>
      <div className="flex items-center gap-1" role="group" aria-label="Navegar páginas">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className="min-h-[44px] min-w-[44px] cursor-pointer px-3 rounded-md border border-slate-300 dark:border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800"
          aria-label="Página anterior"
        >
          ‹ Anterior
        </button>
        {Array.from({ length: Math.min(pages, 5) }, (_, i) => {
          // janela simples centrada
          let p = i + 1
          if (pages > 5) {
            const start = Math.max(1, Math.min(page - 2, pages - 4))
            p = start + i
          }
          return (
            <button
              key={p}
              type="button"
              aria-current={page === p ? 'page' : undefined}
              aria-label={`Ir para página ${p}`}
              onClick={() => onChange(p)}
              className={`min-h-[44px] min-w-[44px] cursor-pointer px-3 rounded-md border text-sm font-medium ${
                page === p
                  ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                  : 'border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {p}
            </button>
          )
        })}
        <button
          type="button"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
          className="min-h-[44px] min-w-[44px] cursor-pointer px-3 rounded-md border border-slate-300 dark:border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800"
          aria-label="Próxima página"
        >
          Próxima ›
        </button>
      </div>
    </nav>
  )
}
