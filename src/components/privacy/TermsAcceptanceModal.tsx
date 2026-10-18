import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useAnnouncer } from '@/components/feedback/LiveRegionContext'
import { Button } from '@/components/ui/Button'

export function TermsAcceptanceModal() {
  const { user, acceptTerms, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const announce = useAnnouncer()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  const needsAcceptance = Boolean(
    user && user.role !== 'guest' && user.terms_current_version &&
    user.terms_accepted_version !== user.terms_current_version &&
    location.pathname !== '/privacidade',
  )

  if (!needsAcceptance) return null

  const handleAccept = async () => {
    setPending(true)
    setError('')
    try {
      await acceptTerms()
    } catch {
      const message = 'Não foi possível registrar o aceite. Tente novamente.'
      setError(message)
      announce(message, 'assertive')
    } finally {
      setPending(false)
    }
  }

  const handleRead = () => navigate('/privacidade')
  const handleReject = async () => {
    await logout()
    navigate('/entrar')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="terms-modal-title" aria-describedby="terms-modal-description" className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl dark:bg-slate-800">
        <h2 id="terms-modal-title" className="text-xl font-bold text-slate-950 dark:text-white">Leia o Aviso de Privacidade</h2>
        <p id="terms-modal-description" className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-200">Para continuar usando o sistema, leia o aviso e registre que você está ciente da versão vigente.</p>
        {error && <p role="alert" className="mt-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-700 dark:bg-red-950/40 dark:text-red-200">{error}</p>}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={handleReject} disabled={pending}>Rejeitar e sair</Button>
          <Button type="button" variant="secondary" onClick={handleRead} disabled={pending}>Ler o aviso</Button>
          <Button type="button" onClick={() => void handleAccept()} disabled={pending}>{pending ? 'Registrando…' : 'Estou ciente'}</Button>
        </div>
      </section>
    </div>
  )
}
