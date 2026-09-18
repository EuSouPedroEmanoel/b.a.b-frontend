import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useAnnouncer } from '@/components/feedback/LiveRegionContext'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Tooltip } from '@/components/ui/Tooltip'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { getErrorMessage } from '@/lib/errors'
import api from '@/lib/api'
import { segmentedControlContainerClasses, segmentedControlItemClasses } from '@/components/ui/SegmentedControl'
import { FirstAccessPanel } from './FirstAccessPanel'

export function LoginPage() {
  const { login, loginGuest } = useAuth()
  const announce = useAnnouncer()
  const navigate = useNavigate()
  const location = useLocation()
  const { schoolCode } = useParams<{ schoolCode: string }>()
  const [accessTab, setAccessTab] = useState<'login' | 'first-access'>(() => location.pathname === '/primeiro-acesso' ? 'first-access' : 'login')
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
  const loginTabRef = useRef<HTMLButtonElement>(null)
  const firstAccessTabRef = useRef<HTMLButtonElement>(null)

  const switchAccessTab = (nextTab: 'login' | 'first-access', focusTab = false) => {
    setAccessTab(nextTab)
    if (focusTab) window.requestAnimationFrame(() => (nextTab === 'login' ? loginTabRef : firstAccessTabRef).current?.focus())
  }

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
    // O estado de carregamento precisa ser reiniciado antes de cada consulta por escola.
    // oxlint-disable-next-line react/set-state-in-effect -- sincroniza a UI com a requisição assíncrona.
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
    if (schoolCode) {
      // A rota pública é a fonte de verdade quando o parâmetro muda sem remontar a página.
      // oxlint-disable-next-line react/set-state-in-effect -- sincroniza estado local com a URL.
      setMode('guest')
    }
  }, [schoolCode])

  useEffect(() => {
    if (mode !== 'account') return
    window.requestAnimationFrame(() => usernameRef.current?.focus())
  }, [mode])

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
      announce('Acesso como visitante realizado. Início aberto.', 'polite')
      navigate('/inicio')
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
      navigate('/inicio')
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

  const submitDisabled = loading || !username.trim() || !password.trim()
  const submitTooltip = loading ? 'Entrando, aguarde' : 'Preencha usuário e senha para entrar'
  const guestSubmitDisabled = !guestSchoolCode || guestLoading
  const guestSubmitTooltip = guestLoading ? 'Entrando como visitante, aguarde' : 'Selecione uma escola para continuar'
  const firstAccessParams = useMemo(() => new URLSearchParams(location.search), [location.search])

  return (
    <div className="mx-auto w-[min(100%,clamp(32rem,calc(20rem+var(--text-sm)*12),42rem))]">
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">Entrar na Biblioteca</h1>
      <p className="text-sm text-slate-500 mb-6">Entre com sua conta ou acesse o acervo como visitante.</p>

      <div
        role="tablist"
        aria-label="Acesso à conta"
        className={`${segmentedControlContainerClasses} mb-4`}
        onKeyDown={(event) => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
          event.preventDefault()
          const next = event.key === 'ArrowLeft' || event.key === 'Home' ? 'login' : 'first-access'
          switchAccessTab(next, true)
        }}
      >
        <button ref={loginTabRef} id="login-tab" type="button" role="tab" aria-selected={accessTab === 'login'} aria-controls="login-panel" tabIndex={accessTab === 'login' ? 0 : -1} onClick={() => switchAccessTab('login')} className={segmentedControlItemClasses(accessTab === 'login', 'primary')}>Entrar</button>
        <button ref={firstAccessTabRef} id="first-access-tab" type="button" role="tab" aria-selected={accessTab === 'first-access'} aria-controls="first-access-panel" tabIndex={accessTab === 'first-access' ? 0 : -1} onClick={() => switchAccessTab('first-access')} className={segmentedControlItemClasses(accessTab === 'first-access', 'primary')}>Primeiro acesso</button>
      </div>

      {accessTab === 'login' ? <div id="login-panel" role="tabpanel" aria-labelledby="login-tab">

      {mode === 'account' ? <Card>
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
                  className={`w-full rounded-md border px-3 py-2.5 pr-12 text-base bg-[var(--color-field)] dark:bg-slate-800/80 min-h-[44px] placeholder:text-slate-400 transition-colors border-[var(--color-field-border-hover)] dark:border-slate-600 hover:border-[var(--color-border)] dark:hover:border-slate-400 focus-visible:border-transparent focus-visible:outline-3 focus-visible:outline-[var(--color-focus)] ${
                    error ? 'border-red-600' : ''
                  }`}
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  aria-pressed={showPassword}
                  aria-controls="password"
                  onClick={() => {
                    const next = !showPassword
                    setShowPassword(next)
                    announce(next ? 'Senha visível' : 'Senha oculta', 'polite')
                  }}
                  className="group absolute right-1 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200 min-h-[44px] min-w-[44px] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-focus)] focus-visible:outline-offset-2"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
                  <Tooltip>{showPassword ? 'Ocultar senha' : 'Mostrar senha'}</Tooltip>
                </button>
              </div>
              <p id="pwd-hint" className="sr-only">
                Para tecnologia assistiva a senha é sempre anunciada caractere a caractere — use o botão ao lado para alternar a exibição visual.
              </p>
            </div>
            <span className="group relative block">
              <Button
                type="submit"
                aria-busy={loading}
                disabled={submitDisabled}
                className="w-full"
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
              {submitDisabled && <Tooltip>{submitTooltip}</Tooltip>}
            </span>
            <div className="flex items-center gap-3" aria-hidden="true">
              <span className="h-px flex-1 bg-slate-400 dark:bg-slate-500" />
              <span className="px-1 text-base font-semibold text-slate-700 dark:text-slate-200">ou</span>
              <span className="h-px flex-1 bg-slate-400 dark:bg-slate-500" />
            </div>
            <Button type="button" variant="secondary" className="w-full" onClick={() => switchMode('guest')}>
              Acessar como visitante
            </Button>
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
            <span className="group relative block">
              <Button
                type="submit"
                ref={guestButtonRef}
                disabled={guestSubmitDisabled}
                aria-busy={guestLoading}
                aria-label="Acessar o acervo como visitante"
                className="w-full"
              >
                {guestLoading ? 'Entrando como visitante…' : 'Acessar como visitante'}
              </Button>
              {guestSubmitDisabled && <Tooltip>{guestSubmitTooltip}</Tooltip>}
            </span>
            <p className="text-center text-xs text-slate-500">O acesso é temporário e permite somente consultar o acervo.</p>
            <Button type="button" variant="ghost" className="w-full" onClick={() => switchMode('account')}>
              Voltar para entrar
            </Button>
        </form>
        </CardBody>
      </section>
      </Card>}
      </div> : <div id="first-access-panel" role="tabpanel" aria-labelledby="first-access-tab">
        <FirstAccessPanel
          initialUsername={firstAccessParams.get('username') ?? ''}
          initialCode={firstAccessParams.get('code') ?? firstAccessParams.get('codigo') ?? ''}
          onActivated={(activatedUsername) => {
            setUsername(activatedUsername)
            setPassword('')
            setError(null)
            setMode('account')
            switchAccessTab('login')
            window.requestAnimationFrame(() => usernameRef.current?.focus())
          }}
        />
      </div>}
    </div>
  )
}
