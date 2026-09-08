import { PageDescription } from '@/components/ui/PageDescription'
import { useAuth } from '@/hooks/useAuth'
import { Link } from 'react-router-dom'

export function AccountPage() {
  const { user } = useAuth()

  if (!user) return null

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold sm:text-3xl">Ver perfil</h1>
        <PageDescription>
          Consulte as informações básicas do seu perfil.
        </PageDescription>
      </header>
      <section aria-labelledby="profile-information" className="max-w-2xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="profile-information" className="text-lg font-semibold">Informações básicas</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Dados usados para identificar seu acesso à biblioteca.</p>
          </div>
          <Link
            to="/minha-conta/gerenciar"
            className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-[#0f4c75] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0e3f61] focus-visible:outline-2 focus-visible:outline-[var(--color-focus)] focus-visible:outline-offset-2 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          >
            Gerenciar conta
          </Link>
        </div>
        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-slate-500 dark:text-slate-400">Nome</dt>
            <dd className="mt-1 font-medium">{user.name || user.username}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500 dark:text-slate-400">Usuário</dt>
            <dd className="mt-1 font-medium">{user.username}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500 dark:text-slate-400">Perfil de acesso</dt>
            <dd className="mt-1 font-medium">{user.role}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500 dark:text-slate-400">E-mail</dt>
            <dd className="mt-1 font-medium">{user.email || 'Não informado'}</dd>
          </div>
        </dl>
      </section>
    </div>
  )
}
