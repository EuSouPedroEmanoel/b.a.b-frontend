import { useRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Tooltip } from '@/components/ui/Tooltip'
import { useAnnouncer } from '@/components/feedback/LiveRegionContext'
import api from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'
import { formatActivationCode, hasInvalidActivationCharacter } from './activationCode'

type Props = {
  onActivated: (username: string) => void
  initialUsername?: string
  initialCode?: string
}

export function FirstAccessPanel({ onActivated, initialUsername = '', initialCode = '' }: Props) {
  const announce = useAnnouncer()
  const [step, setStep] = useState<'validate' | 'password'>('validate')
  const [username, setUsername] = useState(() => initialUsername.trim())
  const [code, setCode] = useState(() => formatActivationCode(initialCode))
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const passwordHeadingRef = useRef<HTMLHeadingElement>(null)
  const confirmationRef = useRef<HTMLInputElement>(null)

  const codeComplete = code.replace(/-/g, '').length === 9
  const passwordValid = password.length >= 8 && /[A-Za-zÀ-ÿ]/.test(password) && /\d/.test(password)
  const validationDisabled = pending || !username.trim() || !codeComplete || !!error
  const validationTooltip = pending
    ? 'Validando convite, aguarde'
    : error
      ? error
      : !username.trim()
        ? 'Informe o usuário para continuar'
        : 'Digite o código de ativação completo para continuar'

  const validateInvitation = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!username.trim() || !codeComplete || error) return
    setPending(true)
    setError('')
    try {
      await api.post('/account-activation/validate', { username: username.trim(), code })
      setStep('password')
      announce('Código validado. Crie sua nova senha.', 'polite')
      window.requestAnimationFrame(() => passwordHeadingRef.current?.focus())
    } catch (requestError: unknown) {
      const message = getErrorMessage(requestError, 'Não foi possível validar os dados informados.')
      setError(message)
      announce(message, 'assertive')
    } finally {
      setPending(false)
    }
  }

  const activateAccount = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!passwordValid) {
      setError('A senha deve ter ao menos 8 caracteres, uma letra e um número.')
      return
    }
    if (password !== confirmation) {
      setError('As senhas não coincidem.')
      return
    }
    setPending(true)
    setError('')
    try {
      await api.post('/account-activation/complete', {
        username: username.trim(),
        code,
        password,
        password_confirmation: confirmation,
      })
      announce('Conta ativada com sucesso. Entre com sua nova senha.', 'polite')
      setPassword('')
      setConfirmation('')
      onActivated(username.trim())
    } catch (requestError: unknown) {
      const message = getErrorMessage(requestError, 'Não foi possível ativar a conta.')
      setError(message)
      announce(message, 'assertive')
    } finally {
      setPending(false)
    }
  }

  return <Card>
    {step === 'validate' ? <section aria-labelledby="first-access-validation-heading">
      <CardHeader>
        <h2 id="first-access-validation-heading" className="text-lg font-semibold">Validar convite</h2>
        <p className="text-sm text-slate-500 dark:text-slate-300">Use o código entregue presencialmente pela biblioteca.</p>
      </CardHeader>
      <CardBody>
        <form onSubmit={validateInvitation} noValidate className="flex flex-col gap-4">
          {error && <p role="alert" className="profile-error-message">{error}</p>}
          <Input label="Usuário" id="activation-username" value={username} onChange={(event) => setUsername(event.target.value)} required autoComplete="username" />
          <Input
            label="Código de ativação"
            id="activation-code"
            value={code}
            onChange={(event) => {
              const invalid = hasInvalidActivationCharacter(event.target.value)
              setCode(formatActivationCode(event.target.value))
              setError(invalid ? 'Use somente os caracteres indicados no código impresso.' : '')
            }}
            placeholder="ABC-123-XYZ"
            hint="Digite os nove caracteres, com ou sem hífens. O formato esperado é XXX-XXX-XXX."
            className="uppercase tracking-wider"
            autoCapitalize="characters"
            autoComplete="one-time-code"
            spellCheck={false}
            required
          />
          <span className="group relative block">
            <Button type="submit" className="w-full" disabled={validationDisabled} aria-busy={pending}>{pending ? 'Validando…' : 'Continuar'}</Button>
            {validationDisabled && <Tooltip>{validationTooltip}</Tooltip>}
          </span>
          <p className="text-sm text-slate-600 dark:text-slate-300">O código expirou ou foi perdido? Procure a biblioteca para solicitar um novo convite.</p>
        </form>
      </CardBody>
    </section> : <section aria-labelledby="first-access-password-heading">
      <CardHeader>
        <h2 ref={passwordHeadingRef} tabIndex={-1} id="first-access-password-heading" className="text-lg font-semibold focus:outline-none">Criar senha</h2>
        <p className="text-sm text-slate-500 dark:text-slate-300">Sua senha deve ter ao menos 8 caracteres, uma letra e um número.</p>
      </CardHeader>
      <CardBody>
        <form onSubmit={activateAccount} noValidate className="flex flex-col gap-4">
          {error && <p role="alert" className="profile-error-message">{error}</p>}
          <Input
            label="Nova senha"
            id="activation-password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                confirmationRef.current?.focus()
              }
            }}
            error={password && !passwordValid ? 'Use ao menos 8 caracteres, uma letra e um número.' : undefined}
            hint={`${password.length} ${password.length === 1 ? 'caractere' : 'caracteres'}`}
            required
            autoComplete="new-password"
            rightElement={<Button type="button" variant="ghost" size="sm" aria-label={showPassword ? 'Ocultar nova senha' : 'Mostrar nova senha'} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? <EyeOff aria-hidden="true" className="h-5 w-5" /> : <Eye aria-hidden="true" className="h-5 w-5" />}</Button>}
          />
          <Input
            ref={confirmationRef}
            label="Confirmar nova senha"
            id="activation-password-confirmation"
            type={showConfirmation ? 'text' : 'password'}
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            error={confirmation && password !== confirmation ? 'As senhas não coincidem.' : undefined}
            hint={`${confirmation.length} ${confirmation.length === 1 ? 'caractere' : 'caracteres'}`}
            required
            autoComplete="new-password"
            rightElement={<Button type="button" variant="ghost" size="sm" aria-label={showConfirmation ? 'Ocultar confirmação da senha' : 'Mostrar confirmação da senha'} aria-pressed={showConfirmation} onClick={() => setShowConfirmation((visible) => !visible)}>{showConfirmation ? <EyeOff aria-hidden="true" className="h-5 w-5" /> : <Eye aria-hidden="true" className="h-5 w-5" />}</Button>}
          />
          <Button type="submit" disabled={pending || !passwordValid || password !== confirmation} aria-busy={pending}>{pending ? 'Ativando…' : 'Ativar conta'}</Button>
        </form>
      </CardBody>
    </section>}
  </Card>
}
