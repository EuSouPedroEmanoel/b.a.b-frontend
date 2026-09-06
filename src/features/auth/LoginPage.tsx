import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, Link, useParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useAnnouncer } from '@/components/feedback/LiveRegionContext'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { getErrorMessage } from '@/lib/errors'
import api from '@/lib/api'

export function LoginPage() {
  const { login, loginGuest } = useAuth()
  const announce = useAnnouncer()
  const navigate = useNavigate()
  const { schoolCode } = useParams<{ schoolCode: string }>()
  const [mode, setMode] = useState<'account' | 'guest'>(schoolCode ? 'guest' : 'account')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [guestSchoolCode, setGuestSchoolCode] = useState('')
  const [guestSchoolName, setGuestSchoolName] = useState('')
  const [guestSchoolQuery, setGuestSchoolQuery] = useState('')
  const [guestListOpen, setGuestListOpen] = useState(false)
  const [guestActiveIndex, setGuestActiveIndex] = useState(-1)
  const [guestLoading, setGuestLoading] = useState(false)
  const [guestSchoolsLoading, setGuestSchoolsLoading] = useState(true)
  const [guestError, setGuestError] = useState<string | null>(null)
  const [guestSchools, setGuestSchools] = useState<{ code: string; name: string }[]>([])
  const guestButtonRef = useRef<HTMLButtonElement>(null)
  const guestInputRef = useRef<HTMLInputElement>(null)
  const usernameRef = useRef<HTMLInputElement>(null)
  const guestComboboxRef = useRef<HTMLDivElement>(null)
  const errorRef = useRef<HTMLDivElement>(null)

  const switchMode = (nextMode: 'account' | 'guest') => {
    setMode(nextMode)
    window.requestAnimationFrame(() => {
      if (nextMode === 'guest') guestInputRef.current?.focus()
      else usernameRef.current?.focus()
    })
  }

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

  useEffect(() => {
    let active = true
    setGuestSchoolsLoading(true)
    void api.get<{ code: string; name: string }[]>('/auth/guest/schools')
      .then(({ data }) => {
        if (!active) return
        setGuestSchools(data)
        const linkedSchool = schoolCode ? data.find((school) => school.code === schoolCode) : undefined
        if (linkedSchool) {
          setGuestSchoolCode(linkedSchool.code)
          setGuestSchoolName(linkedSchool.name)
          setGuestSchoolQuery(linkedSchool.name)
        }
      })
      .catch(() => {
        if (active) setGuestError('Não foi possível carregar as escolas disponíveis.')
      })
      .finally(() => { if (active) setGuestSchoolsLoading(false) })
    return () => { active = false }
  }, [schoolCode])

  useEffect(() => {
    if (schoolCode) setMode('guest')
  }, [schoolCode])

  useEffect(() => {
    if (mode === 'guest' && !guestSchoolsLoading) {
      window.requestAnimationFrame(() => guestInputRef.current?.focus())
    }
  }, [mode, guestSchoolsLoading])

  useEffect(() => {
    if (!guestListOpen) return
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!guestComboboxRef.current?.contains(event.target as Node)) {
        setGuestListOpen(false)
        setGuestActiveIndex(-1)
      }
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer)
  }, [guestListOpen])

  const guestSuggestions = useMemo(() => {
    const query = guestSchoolQuery.trim().toLocaleLowerCase('pt-BR')
    if (query.length < 2) return []
    return guestSchools
      .filter((school) => `${school.name} ${school.code}`.toLocaleLowerCase('pt-BR').includes(query))
      .slice(0, 8)
  }, [guestSchoolQuery, guestSchools])

  const selectGuestSchool = (school: { code: string; name: string }) => {
    setGuestSchoolCode(school.code)
    setGuestSchoolName(school.name)
    setGuestSchoolQuery(school.name)
    setGuestListOpen(false)
    setGuestActiveIndex(-1)
    announce(`Escola selecionada: ${school.name}`, 'polite')
  }

  const onGuestAccess = async () => {
    if (!guestSchoolCode || guestLoading) return
    setGuestError(null)
    setGuestLoading(true)
    try {
      await loginGuest(guestSchoolCode, guestSchoolName)
      announce('Acesso como visitante realizado. Acervo aberto.', 'polite')
      navigate('/acervo')
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'Não foi possível iniciar o acesso como visitante.')
      setGuestError(message)
      announce(message, 'assertive')
      window.requestAnimationFrame(() => guestButtonRef.current?.focus())
    } finally {
      setGuestLoading(false)
    }
  }

  const onGuestSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (guestListOpen && guestSuggestions.length > 0) {
      const suggestionIndex = guestActiveIndex >= 0 ? guestActiveIndex : 0
      selectGuestSchool(guestSuggestions[suggestionIndex])
      return
    }
    if (!guestSchoolCode) {
      const message = 'Selecione uma escola para continuar.'
      setGuestError(message)
      announce(message, 'assertive')
      guestInputRef.current?.focus()
      return
    }
    void onGuestAccess()
  }

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

      <div role="tablist" aria-label="Tipo de acesso" className="mb-4 grid grid-cols-2 rounded-lg border border-slate-300 bg-slate-100 p-1 dark:border-slate-600 dark:bg-slate-800">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'account'}
          onClick={() => switchMode('account')}
          className={`min-h-[44px] rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-focus)] ${mode === 'account' ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700 dark:bg-blue-600 dark:text-white dark:hover:bg-blue-700' : 'text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-700'}`}
        >
          Entrar com conta
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'guest'}
          onClick={() => switchMode('guest')}
          className={`min-h-[44px] rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-focus)] ${mode === 'guest' ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700 dark:bg-blue-600 dark:text-white dark:hover:bg-blue-700' : 'text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-700'}`}
        >
          Acessar como visitante
        </button>
      </div>

      {mode === 'account' ? <Card>
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
              ref={usernameRef}
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
              disabled={loading || !username.trim() || !password.trim()}
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
      </Card> : <Card>
      <section aria-labelledby="guest-heading">
        <CardHeader>
          <h2 id="guest-heading" className="text-lg font-semibold">Acessar como visitante</h2>
          <p className="text-sm text-slate-500">Consulte o acervo público sem criar uma conta.</p>
        </CardHeader>
        <CardBody>
        <form onSubmit={onGuestSubmit} noValidate className="flex flex-col gap-3" aria-describedby={guestError ? 'guest-error' : 'guest-status'}>
            {guestError && (
              <p id="guest-error" role="alert" tabIndex={-1} className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200 focus-visible:outline-2 focus-visible:outline-[var(--color-focus)]">
                {guestError}
              </p>
            )}
            <div ref={guestComboboxRef} className="relative">
              <label htmlFor="guest-school" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">Escola</label>
              <input
                ref={guestInputRef}
                id="guest-school"
                role="combobox"
                type="text"
                value={guestSchoolQuery}
                placeholder="Digite o nome da escola"
                autoComplete="off"
                aria-autocomplete="list"
                aria-haspopup="listbox"
                aria-expanded={guestListOpen}
                aria-controls="guest-school-listbox"
                aria-activedescendant={guestActiveIndex >= 0 ? `guest-school-option-${guestActiveIndex}` : undefined}
                aria-describedby="guest-status"
                disabled={guestSchoolsLoading}
                onFocus={() => setGuestListOpen(true)}
                onBlur={(event) => {
                  // Tab (and other keyboard focus changes) should close the
                  // popup, while allowing focus to remain inside the
                  // combobox when an option is being activated by pointer.
                  const next = event.relatedTarget as Node | null
                  if (!next || !guestComboboxRef.current?.contains(next)) {
                    window.setTimeout(() => {
                      if (!guestComboboxRef.current?.contains(document.activeElement)) {
                        setGuestListOpen(false)
                        setGuestActiveIndex(-1)
                      }
                    }, 0)
                  }
                }}
                onChange={(event) => {
                  setGuestSchoolQuery(event.target.value)
                  setGuestSchoolCode('')
                  setGuestSchoolName('')
                  setGuestActiveIndex(-1)
                  setGuestListOpen(true)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown') {
                    event.preventDefault()
                    setGuestListOpen(true)
                    setGuestActiveIndex((index) => Math.min(index + 1, guestSuggestions.length - 1))
                  } else if (event.key === 'ArrowUp') {
                    event.preventDefault()
                    setGuestListOpen(true)
                    setGuestActiveIndex((index) => Math.max(index - 1, 0))
                  } else if (event.key === 'Enter' && guestListOpen && guestSuggestions.length > 0) {
                    const suggestionIndex = guestActiveIndex >= 0 ? guestActiveIndex : 0
                    event.preventDefault()
                    selectGuestSchool(guestSuggestions[suggestionIndex])
                  } else if (event.key === 'Escape') {
                    event.preventDefault()
                    setGuestListOpen(false)
                    setGuestActiveIndex(-1)
                  } else if (event.key === 'Tab') {
                    setGuestListOpen(false)
                    setGuestActiveIndex(-1)
                  }
                }}
                className="min-h-[44px] w-full rounded-md border border-slate-300 bg-white px-3 text-base dark:border-slate-600 dark:bg-slate-800 focus-visible:outline-3 focus-visible:outline-[var(--color-focus)] focus-visible:outline-offset-2"
              />
              {guestListOpen && !guestSchoolsLoading && guestSchoolQuery.trim().length >= 2 && (
                <ul id="guest-school-listbox" role="listbox" aria-label="Escolas disponíveis" className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-slate-300 bg-white p-1 shadow-lg dark:border-slate-600 dark:bg-slate-800">
                  {guestSuggestions.length > 0 ? guestSuggestions.map((school, index) => (
                    <li
                      id={`guest-school-option-${index}`}
                      key={school.code}
                      role="option"
                      aria-selected={guestSchoolCode === school.code}
                      className={`cursor-pointer rounded px-3 py-2 text-sm ${guestSchoolCode === school.code ? 'bg-[var(--color-primary)] text-[var(--color-primary-contrast)] hover:bg-[var(--color-primary-hover)]' : index === guestActiveIndex ? 'bg-sky-100 dark:bg-slate-700' : 'hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                      onMouseDown={(event) => { event.preventDefault(); selectGuestSchool(school) }}
                    >
                      <span className="font-medium">{school.name}</span>
                      <span className="ml-2 text-xs text-slate-500">{school.code}</span>
                    </li>
                  )) : <li role="option" aria-disabled="true" className="px-3 py-2 text-sm text-slate-500">Nenhuma escola encontrada.</li>}
                </ul>
              )}
            </div>
            <p id="guest-status" role="status" aria-live="polite" className="text-xs text-slate-500">
              {guestSchoolsLoading ? 'Carregando escolas…' : guestListOpen && guestSchoolQuery.trim().length < 2 ? 'Digite pelo menos 2 caracteres para buscar.' : guestListOpen ? guestSuggestions.length === 0 ? 'Nenhuma escola encontrada.' : `${guestSuggestions.length} ${guestSuggestions.length === 1 ? 'escola encontrada' : 'escolas encontradas'}. Use as setas para navegar.` : guestSchoolCode ? `Escola selecionada: ${guestSchoolName}` : 'Digite pelo menos 2 caracteres para buscar uma escola.'}
            </p>
            <Button
              type="submit"
              ref={guestButtonRef}
              disabled={!guestSchoolCode || guestLoading}
              aria-busy={guestLoading}
              aria-label="Acessar o acervo como visitante"
            >
              {guestLoading ? 'Entrando como visitante…' : 'Acessar como visitante'}
            </Button>
            <p className="text-xs text-slate-500">O acesso é temporário e permite somente consultar o acervo.</p>
        </form>
        </CardBody>
      </section>
      </Card>}
    </div>
  )
}
