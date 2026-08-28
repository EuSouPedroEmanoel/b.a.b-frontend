import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useAnnouncer } from '@/components/feedback/LiveRegion'
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

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // Validação cliente evita 422 array e melhora a11y
    if (!username.trim()) {
      const msg = 'Informe o usuário, e-mail ou CPF'
      setError(msg)
      announce(msg, 'assertive')
      document.getElementById('username')?.focus()
      return
    }
    if (!password.trim()) {
      const msg = 'Informe a senha'
      setError(msg)
      announce(msg, 'assertive')
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
      const final = getErrorMessage(err, 'Usuário ou senha inválidos')
      setError(final)
      announce(`Erro ao entrar: ${final}`, 'assertive')
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
              <div id="login-error" role="alert" className="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-800 dark:text-red-200">
                {error}
              </div>
            )}
            <Input
              label="Usuário, e-mail ou CPF"
              id="username"
              name="username"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  document.getElementById('password')?.focus()
                }
              }}
            />
            <Input
              label="Senha"
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button type="submit" disabled={loading} aria-busy={loading}>
              {loading ? 'Entrando…' : 'Entrar'}
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
