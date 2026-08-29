import { useEffect, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useAnnouncer } from '@/components/feedback/LiveRegion'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { getErrorMessage } from '@/lib/errors'

export function LoginPage() {
  const { login } = useAuth()
  const announce = useAnnouncer()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const errorRef = useRef<HTMLDivElement>(null)

  // Leitor em modo foco precisa receber foco no alerta (role=alert sozinho não basta).
  // Re-foca mesmo se erro repetir com mesmo texto (caso "só fala uma vez").
  // Para validações de campo ("Informe ...") o foco fica no input; não rouba para o alerta.
  useEffect(() => {
    if (!error) return
    if (error.startsWith('Informe')) return
    const el = errorRef.current
    if (!el) return
    // Se já está focado, tira e recoloca para forçar evento de foco + releitura
    if (document.activeElement === el) {
      el.blur()
      setTimeout(() => el.focus(), 30)
    } else {
      // micro-delay garante que DOM com role=alert já foi pintado antes do focus
      setTimeout(() => el.focus(), 30)
    }
  }, [error])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    // Validação cliente evita 422 array e melhora a11y — com clear para repetir anúncio
    if (!username.trim()) {
      const msg = 'Informe o usuário, e-mail ou CPF'
      setError(null)
      setTimeout(() => {
        setError(msg)
        announce(msg, 'assertive')
      }, 30)
      document.getElementById('username')?.focus()
      return
    }
    if (!password.trim()) {
      const msg = 'Informe a senha'
      setError(null)
      setTimeout(() => {
        setError(msg)
        announce(msg, 'assertive')
      }, 30)
      document.getElementById('password')?.focus()
      return
    }
    setError(null)
    setLoading(true)
    try {
      await login(username.trim(), password)
      announce('Login realizado com sucesso', 'polite')
      navigate('/')
    } catch (err: unknown) {
      const final = getErrorMessage(err, 'Usuário ou senha incorretos')
      // Força mudança de estado mesmo se mensagem repetir: limpa antes
      setError(null)
      // permite React / AT perceberem a remoção antes da reinserção
      setTimeout(() => {
        setError(final)
        announce(`Erro ao entrar: ${final}`, 'assertive')
      }, 60)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">Entrar na Biblioteca</h1>
      <p className="text-sm text-slate-500 mb-6">
        Entre com seu usuário, e-mail ou CPF. Dica dev: <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">superadmin / superadmin123</code>
      </p>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Acesso restrito</h2>
          <p className="text-sm text-slate-500">Todos os campos são obrigatórios.</p>
        </CardHeader>
        <CardBody>
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4" aria-describedby={error ? 'login-error' : undefined}>
            {error && (
              <div
                ref={errorRef}
                id="login-error"
                role="alert"
                aria-live="assertive"
                aria-atomic="true"
                tabIndex={-1}
                className="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-800 dark:text-red-200 focus-visible:outline-3 focus-visible:outline-[var(--color-focus)] focus-visible:outline-offset-2 outline-none"
              >
                {error}
              </div>
            )}
            <Input
              label="Usuário, e-mail ou CPF"
              id="username"
              name="username"
              autoComplete="username"
              required
              aria-invalid={!!error}
              aria-describedby={error ? 'login-error' : undefined}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  document.getElementById('password')?.focus()
                }
              }}
            />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Senha <span aria-hidden="true" className="text-red-600">*</span>
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  aria-invalid={!!error}
                  aria-describedby={`${error ? 'login-error ' : ''}pwd-hint`.trim()}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full rounded-md border px-3 py-2.5 pr-12 text-base bg-white dark:bg-slate-800 min-h-[44px] placeholder:text-slate-400 focus-visible:outline-3 focus-visible:outline-[var(--color-focus)] ${
                    error ? 'border-red-600' : 'border-slate-300 dark:border-slate-600'
                  }`}
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  aria-pressed={showPassword}
                  aria-controls="password"
                  title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  onClick={() => {
                    const next = !showPassword
                    setShowPassword(next)
                    announce(next ? 'Senha visível' : 'Senha oculta', 'polite')
                  }}
                  className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200 min-h-[44px] min-w-[44px] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-focus)] focus-visible:outline-offset-2"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
                </button>
              </div>
              <p id="pwd-hint" className="sr-only">
                Para tecnologia assistiva a senha é sempre anunciada caractere a caractere — use o botão ao lado para alternar a exibição visual.
              </p>
            </div>
            <Button
              type="submit"
              aria-busy={loading}
              onClick={(ev) => {
                if (loading) ev.preventDefault()
              }}
            >
              {loading ? (
                <>
                  <span aria-hidden="true">Entrando…</span>
                  <span className="sr-only">Entrando, aguarde</span>
                  <span
                    aria-hidden="true"
                    className="ml-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                  />
                </>
              ) : (
                'Entrar'
              )}
            </Button>
            <p className="text-xs text-slate-500 text-center">
              Problemas para acessar? <Link to="/" className="underline underline-offset-2">Voltar ao início</Link>
            </p>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
