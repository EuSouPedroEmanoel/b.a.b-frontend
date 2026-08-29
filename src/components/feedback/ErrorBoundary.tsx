import { Component, type ReactNode, type ErrorInfo } from 'react'

type Props = { children?: ReactNode }
type State = { hasError: boolean; error?: Error }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log para debugging, não expor stack ao usuário
    console.error('ErrorBoundary:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div role="alert" className="mx-auto max-w-2xl p-8">
          <h1 className="text-2xl font-bold">Algo deu errado</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-300">
            Ocorreu um erro inesperado. Tente recarregar a página. Se persistir, verifique o console.
          </p>
          <pre className="mt-4 rounded-md bg-slate-100 dark:bg-slate-800 p-3 text-xs overflow-auto">
            {this.state.error?.message ?? 'Erro desconhecido'}
          </pre>
          <button type="button" onClick={() => window.location.reload()} className="mt-4 inline-flex items-center justify-center px-4 py-2 rounded-md bg-[#0f4c75] text-white hover:bg-[#0e3f61] active:bg-[#0c3d5e] dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 dark:active:bg-slate-200 min-h-[44px] font-medium shadow-sm transition-colors focus-visible:outline-3 focus-visible:outline-[var(--color-focus)] focus-visible:outline-offset-2">
            Recarregar página
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export function RouteErrorFallback() {
  return (
    <div role="alert" className="p-8 text-center">
      <h1 className="text-2xl font-bold">Erro na aplicação</h1>
      <p className="text-slate-500 mt-2">Tente voltar ao início.</p>
      <a href="/" className="inline-flex items-center justify-center mt-4 px-4 py-2 rounded-md bg-[#0f4c75] text-white hover:bg-[#0e3f61] active:bg-[#0c3d5e] dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 dark:active:bg-slate-200 min-h-[44px] font-medium shadow-sm transition-colors focus-visible:outline-3 focus-visible:outline-[var(--color-focus)] focus-visible:outline-offset-2">
        Voltar ao início
      </a>
    </div>
  )
}
