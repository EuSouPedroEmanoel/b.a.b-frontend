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
          <button type="button" onClick={() => window.location.reload()} className="mt-4 px-4 py-2 rounded-md bg-[var(--color-primary)] text-white min-h-[44px]">
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
      <a href="/" className="inline-flex mt-4 px-4 py-2 rounded-md bg-[var(--color-primary)] text-white">
        Voltar ao início
      </a>
    </div>
  )
}
