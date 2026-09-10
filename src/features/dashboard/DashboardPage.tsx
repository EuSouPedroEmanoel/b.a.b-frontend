import { Link } from 'react-router-dom'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { useAuth } from '@/hooks/useAuth'
import { PageDescription } from '@/components/ui/PageDescription'

export function DashboardPage() {
  const { user } = useAuth()
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Bem-vindo{user ? `, ${user.name || user.username}` : ''}</h1>
        <PageDescription className="max-w-3xl">
          Sistema de gestão da Base de Acesso Bibliotecário — catálogo, exemplares, empréstimos e reservas. Interface responsiva e acessível (WCAG 2.2 AA, HTML semântico, navegação por teclado).
        </PageDescription>
      </header>

      {/* Atalhos — ul/li para navegação por lista (tecla L no NVDA/JAWS, rotor no VO) não pular para footer */}
      <section aria-labelledby="atalhos-heading">
        <h2 id="atalhos-heading" className="sr-only">Atalhos</h2>
        <ul aria-labelledby="atalhos-heading" className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,calc(var(--text-sm)*18)),1fr))] gap-4 list-none m-0 p-0">
          {[
            { to: '/acervo', title: 'Acervo', desc: 'Clique no livro para ver e cadastrar exemplares (código único por escola)', tone: 'bg-sky-50 dark:bg-sky-900/20' },
            { to: '/emprestimos', title: 'Empréstimos', desc: 'Emprestar e devolver, cálculo de atraso', tone: 'bg-amber-50 dark:bg-amber-900/20' },
            { to: '/reservas', title: 'Reservas', desc: 'Reservar títulos e acompanhar fila', tone: 'bg-violet-50 dark:bg-violet-900/20' },
            { to: '/exemplares', title: 'Exemplares', desc: 'Acesso via Acervo — clique no livro', tone: 'bg-emerald-50 dark:bg-emerald-900/20' },
          ].map((c) => (
            <li key={c.to} className="flex">
              <Link
                to={c.to}
                aria-label={`${c.title} — ${c.desc}`}
                className={`flex h-full flex-1 flex-col rounded-xl border border-slate-200 dark:border-slate-700 p-5 hover:shadow-md active:shadow-sm active:bg-slate-50 dark:active:bg-slate-800 transition-all focus-visible:outline-3 focus-visible:outline-[var(--color-focus)] focus-visible:outline-offset-2 min-h-[44px] ${c.tone}`}
              >
                <h3 className="font-semibold" aria-hidden="true">{c.title}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-1" aria-hidden="true">{c.desc}</p>
                <span className="mt-auto inline-flex pt-3 text-sm font-medium text-[var(--color-primary)]" aria-hidden="true">Acessar →</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <h2 id="como-usar-heading" className="font-semibold">Como usar</h2>
          </CardHeader>
          <CardBody>
            <ol aria-labelledby="como-usar-heading" className="list-decimal pl-5 space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <li>Faça login com seu usuário da escola.</li>
              <li>Consulte o acervo em <em>Acervo</em> — busca por título (mín. 3 caracteres).</li>
              <li>Bibliotecários cadastram livros por ISBN (auto-preenche via Google Books).</li>
              <li>Exemplares são vinculados à sua escola — código único por unidade.</li>
              <li>Empréstimos calculam prazo com penalidade por atrasos anteriores.</li>
            </ol>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 id="acessibilidade-heading" className="font-semibold">Acessibilidade</h2>
          </CardHeader>
          <CardBody>
            <ul aria-labelledby="acessibilidade-heading" className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <li><span aria-hidden="true">✓ </span>Skip link, landmarks e hierarquia de headings</li>
              <li><span aria-hidden="true">✓ </span>Contraste AA, foco visível e tamanho mínimo 44×44px</li>
              <li><span aria-hidden="true">✓ </span>Formulários com label, aria-invalid e live region</li>
              <li><span aria-hidden="true">✓ </span>Tabelas responsivas <span aria-hidden="true">→</span> cards em mobile</li>
              <li><span aria-hidden="true">✓ </span>Respeita prefers-reduced-motion e color-scheme</li>
            </ul>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
