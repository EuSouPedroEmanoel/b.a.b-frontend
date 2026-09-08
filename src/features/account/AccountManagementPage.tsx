import { Link } from 'react-router-dom'
import { PageDescription } from '@/components/ui/PageDescription'

export function AccountManagementPage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold sm:text-3xl">Gerenciar conta</h1>
        <PageDescription>
          As opções para alterar seus dados pessoais e sua senha estarão disponíveis aqui em breve.
        </PageDescription>
      </header>
      <Link
        to="/minha-conta"
        className="inline-flex min-h-[44px] w-fit items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-[var(--color-focus)] focus-visible:outline-offset-2 dark:border-slate-600 dark:hover:bg-slate-800"
      >
        Voltar ao perfil
      </Link>
    </div>
  )
}
