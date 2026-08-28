import { Link } from 'react-router-dom'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { useAuth } from '@/hooks/useAuth'

export function DashboardPage() {
  const { user } = useAuth()
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Bem-vindo{user ? `, ${user.username}` : ''}</h1>
        <p className="text-slate-500 mt-1 max-w-3xl">
          Sistema de gestão da Biblioteca Ginásio — catálogo, exemplares, empréstimos e reservas. Interface responsiva e acessível (WCAG 2.2 AA, HTML semântico, navegação por teclado).
        </p>
      </header>

      <section aria-labelledby="atalhos-heading" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <h2 id="atalhos-heading" className="sr-only">Atalhos</h2>
        {[
          { to: '/acervo', title: 'Acervo', desc: 'Clique no livro para ver e cadastrar exemplares (código único por escola)', tone: 'bg-sky-50 dark:bg-sky-900/20' },
          { to: '/emprestimos', title: 'Empréstimos', desc: 'Emprestar e devolver, cálculo de atraso', tone: 'bg-amber-50 dark:bg-amber-900/20' },
          { to: '/reservas', title: 'Reservas', desc: 'Reservar títulos e acompanhar fila', tone: 'bg-violet-50 dark:bg-violet-900/20' },
          { to: '/exemplares', title: 'Exemplares', desc: 'Acesso via Acervo — clique no livro', tone: 'bg-emerald-50 dark:bg-emerald-900/20' },
        ].map((c) => (
          <Link
            key={c.to}
            to={c.to}
            className={`rounded-xl border border-slate-200 dark:border-slate-700 p-5 hover:shadow-md transition-shadow focus-visible:outline-3 focus-visible:outline-[var(--color-focus)] ${c.tone}`}
          >
            <h3 className="font-semibold">{c.title}</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{c.desc}</p>
            <span className="inline-flex mt-3 text-sm font-medium text-[var(--color-primary)]">Acessar →</span>
          </Link>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <h2 className="font-semibold">Como usar</h2>
          </CardHeader>
          <CardBody>
            <ol className="list-decimal pl-5 space-y-2 text-sm text-slate-600 dark:text-slate-300">
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
            <h2 className="font-semibold">Acessibilidade</h2>
          </CardHeader>
          <CardBody>
            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <li>✓ Skip link, landmarks e hierarquia de headings</li>
              <li>✓ Contraste AA, foco visível e tamanho mínimo 44×44px</li>
              <li>✓ Formulários com label, aria-invalid e live region</li>
              <li>✓ Tabelas responsivas → cards em mobile</li>
              <li>✓ Respeita prefers-reduced-motion e color-scheme</li>
            </ul>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
