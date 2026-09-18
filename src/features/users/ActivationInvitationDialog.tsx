import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import * as QRCode from 'qrcode'
import { Clipboard, Printer, RefreshCw, XCircle } from 'lucide-react'
import { UndoSnackbar } from '@/components/feedback/UndoSnackbar'
import { Button } from '@/components/ui/Button'
import { ModalDialog } from '@/components/ui/ModalDialog'
import { useAnnouncer } from '@/components/feedback/LiveRegionContext'
import api from '@/lib/api'

export type ActivationInvitation = {
  code: string
  expires_at: string
  first_access_url: string
  print_url: string
}

export type CreatedUserInvitation = {
  id: number
  name: string
  username: string
  activation_invitation: ActivationInvitation
}

export function ActivationInvitationDialog({ created, onClose }: { created: CreatedUserInvitation; onClose: () => void }) {
  const announce = useAnnouncer()
  const [printing, setPrinting] = useState(false)
  const [copied, setCopied] = useState(false)
  const copyResetTimer = useRef<number | null>(null)
  const reduceMotion = useReducedMotion()
  const invitation = created.activation_invitation
  const accessUrl = useMemo(() => {
    const url = new URL(invitation.first_access_url, window.location.origin)
    if (!url.searchParams.has('username')) url.searchParams.set('username', created.username)
    if (!url.searchParams.has('code')) url.searchParams.set('code', invitation.code)
    return url.toString()
  }, [created.username, invitation.code, invitation.first_access_url])
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null)

  useEffect(() => () => {
    if (copyResetTimer.current !== null) window.clearTimeout(copyResetTimer.current)
  }, [])

  useEffect(() => {
    let active = true
    void QRCode.toString(accessUrl, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 220,
    }).then((svg) => {
      if (active) setQrCodeDataUrl(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`)
    }).catch(() => {
      if (active) setQrCodeDataUrl(null)
    })
    return () => { active = false }
  }, [accessUrl])

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(invitation.code)
      setCopied(true)
      if (copyResetTimer.current !== null) window.clearTimeout(copyResetTimer.current)
      copyResetTimer.current = window.setTimeout(() => setCopied(false), 2200)
      announce('Código de ativação copiado.', 'polite')
    } catch {
      announce('Não foi possível copiar o código de ativação.', 'assertive')
    }
  }

  const printInvitation = async () => {
    setPrinting(true)
    try {
      const { data } = await api.post(invitation.print_url, { username: created.username, code: invitation.code }, { responseType: 'blob' })
      const url = URL.createObjectURL(data)
      const printWindow = window.open(url, '_blank', 'noopener,noreferrer')
      if (!printWindow) announce('Permita a abertura da janela para imprimir o convite.', 'assertive')
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } finally {
      setPrinting(false)
    }
  }

  return <ModalDialog variant="form" title="Convite de primeiro acesso" onClose={onClose}>
    <div className="grid gap-4 text-left">
      <p role="status" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">Este código será mostrado somente agora. Imprima ou entregue-o ao usuário antes de fechar.</p>
      <figure className="flex flex-col items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-600 dark:bg-slate-900/40">
        {qrCodeDataUrl ? <img src={qrCodeDataUrl} alt="QR Code para abrir o primeiro acesso com os dados preenchidos" className="h-44 w-44 rounded bg-white p-2" /> : <div role="status" className="flex h-44 w-44 items-center justify-center text-center text-sm text-slate-500 dark:text-slate-300">Gerando QR Code…</div>}
        <figcaption className="text-center text-sm text-slate-600 dark:text-slate-300">Escaneie para abrir a página de primeiro acesso já preenchida.</figcaption>
      </figure>
      <dl className="grid gap-3">
        <div><dt className="text-sm text-slate-500 dark:text-slate-300">Nome</dt><dd className="font-medium">{created.name}</dd></div>
        <div><dt className="text-sm text-slate-500 dark:text-slate-300">Usuário</dt><dd className="font-medium">{created.username}</dd></div>
        <div><dt className="text-sm text-slate-500 dark:text-slate-300">Código de ativação</dt><dd className="text-xl font-bold tracking-wider" aria-label={`Código de ativação ${invitation.code.split('').join(' ')}`}>{invitation.code}</dd></div>
        <div><dt className="text-sm text-slate-500 dark:text-slate-300">Válido até</dt><dd>{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(invitation.expires_at))}</dd></div>
        <div><dt className="text-sm text-slate-500 dark:text-slate-300">Página de primeiro acesso</dt><dd className="break-all">{accessUrl}</dd></div>
      </dl>
      <div className="flex flex-wrap gap-3">
        <motion.div className="w-full sm:w-auto" whileHover={reduceMotion ? undefined : { y: -1 }} whileTap={reduceMotion ? undefined : { scale: 0.97 }} transition={{ type: 'spring', stiffness: 450, damping: 24 }}>
          <Button
            type="button"
            variant="secondary"
            className={`w-full justify-center gap-2 whitespace-nowrap sm:w-40 ${copied ? '!px-2' : ''}`}
            onClick={() => void copyCode()}
            aria-label={copied ? 'Código copiado' : 'Copiar código'}
          >
            <span className="relative inline-flex h-4 w-4 items-center justify-center" aria-hidden="true">
              <AnimatePresence initial={false} mode="wait">
                {copied ? (
                  <motion.svg
                    key="copied"
                    viewBox="0 0 24 24"
                    className="absolute h-4 w-4 text-emerald-600 dark:text-emerald-400"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ opacity: 0, scale: 0.55, rotate: -12 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    exit={{ opacity: 0, scale: 0.55, rotate: 12 }}
                    transition={{ duration: reduceMotion ? 0 : 0.18, ease: 'easeOut' }}
                  >
                    <motion.path d="m5 12 4 4L19 6" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: reduceMotion ? 0 : 0.28, delay: reduceMotion ? 0 : 0.04, ease: 'easeOut' }} />
                  </motion.svg>
                ) : (
                  <motion.span
                    key="copy"
                    className="absolute inline-flex"
                    initial={{ opacity: 0, scale: 0.7, filter: 'blur(3px)' }}
                    animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, scale: 0.7, filter: 'blur(3px)' }}
                    transition={{ duration: reduceMotion ? 0 : 0.16, ease: 'easeOut' }}
                  >
                    <Clipboard className="h-4 w-4" />
                  </motion.span>
                )}
              </AnimatePresence>
            </span>
            <AnimatePresence initial={false} mode="wait">
              <motion.span
                key={copied ? 'copied-label' : 'copy-label'}
                initial={{ opacity: 0, y: reduceMotion ? 0 : 4, filter: reduceMotion ? 'blur(0px)' : 'blur(3px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: reduceMotion ? 0 : -4, filter: reduceMotion ? 'blur(0px)' : 'blur(3px)' }}
                transition={{ duration: reduceMotion ? 0 : 0.16, ease: 'easeOut' }}
              >
                {copied ? 'Código copiado' : 'Copiar código'}
              </motion.span>
            </AnimatePresence>
          </Button>
        </motion.div>
        <Button type="button" className="gap-2" onClick={() => void printInvitation()} disabled={printing} aria-busy={printing}><Printer aria-hidden="true" className="h-4 w-4" /> {printing ? 'Preparando…' : 'Imprimir convite'}</Button>
        <Button type="button" variant="ghost" onClick={onClose}>Fechar</Button>
      </div>
    </div>
  </ModalDialog>
}

export function ActivationActions({ user, onUpdated }: { user: { id: number; name: string; username: string; account_status: string }; onUpdated: () => void }) {
  const announce = useAnnouncer()
  const [pending, setPending] = useState(false)
  const [created, setCreated] = useState<CreatedUserInvitation | null>(null)
  if (user.account_status !== 'pending_activation') return null

  const regenerate = async () => {
    setPending(true)
    try {
      const { data } = await api.post<ActivationInvitation>(`/users/${user.id}/activation/regenerate`)
      setCreated({ ...user, activation_invitation: data })
      announce('Novo convite criado. O código anterior foi revogado.', 'polite')
      onUpdated()
    } finally {
      setPending(false)
    }
  }

  const revoke = async () => {
    if (!window.confirm('Revogar o convite ativo deste usuário?')) return
    setPending(true)
    try {
      await api.post(`/users/${user.id}/activation/revoke`)
      announce('Convite revogado.', 'polite')
      onUpdated()
    } finally {
      setPending(false)
    }
  }

  return <>
    <div className="mt-2 flex flex-wrap justify-end gap-2">
      <Button type="button" size="sm" variant="secondary" className="gap-1" disabled={pending} onClick={() => void regenerate()}><RefreshCw aria-hidden="true" className="h-4 w-4" /> Novo convite</Button>
      <Button type="button" size="sm" variant="danger-secondary" className="gap-1" disabled={pending} onClick={() => void revoke()}><XCircle aria-hidden="true" className="h-4 w-4" /> Revogar</Button>
    </div>
    {created && <ActivationInvitationDialog created={created} onClose={() => setCreated(null)} />}
  </>
}

export function ResetPasswordAction({ user, onUpdated }: { user: { id: number; name: string; username: string }; onUpdated?: () => void }) {
  const announce = useAnnouncer()
  const [pending, setPending] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [created, setCreated] = useState<CreatedUserInvitation | null>(null)
  const [undoId, setUndoId] = useState<number | null>(null)
  const [undoAvailable, setUndoAvailable] = useState(false)

  const resetPassword = async () => {
    setConfirmOpen(false)
    setPending(true)
    try {
      const { data } = await api.post<ActivationInvitation & { undo_id: number }>(`/users/${user.id}/password/reset`)
      setCreated({ ...user, activation_invitation: data })
      setUndoId(data.undo_id)
      setUndoAvailable(true)
      announce('Senha resetada. Entregue o novo convite de primeiro acesso ao usuário.', 'polite')
    } catch {
      announce('Não foi possível resetar a senha.', 'assertive')
    } finally {
      setPending(false)
    }
  }

  const undoReset = async () => {
    if (undoId === null) return
    setPending(true)
    try {
      await api.post(`/users/${user.id}/password/reset/undo`, { undo_id: undoId })
      setCreated(null)
      setUndoAvailable(false)
      setUndoId(null)
      onUpdated?.()
      announce('Reset de senha desfeito.', 'polite')
    } catch {
      announce('Não foi possível desfazer o reset de senha.', 'assertive')
    } finally {
      setPending(false)
    }
  }

  return <>
    <Button type="button" variant="danger-secondary" disabled={pending} onClick={() => setConfirmOpen(true)}>
      {pending ? 'Gerando…' : 'Resetar senha'}
    </Button>
    {created && <ActivationInvitationDialog created={created} onClose={() => setCreated(null)} />}
    {confirmOpen && <ModalDialog variant="compact" title="Resetar senha?" onClose={() => { if (!pending) setConfirmOpen(false) }} describedBy="reset-password-description">
      <p id="reset-password-description" className="text-sm text-slate-600 dark:text-slate-300">A senha atual será invalidada e um novo primeiro acesso será gerado para este usuário. Você poderá desfazer a ação pela snackbar após confirmar.</p>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="danger-secondary" onClick={() => void resetPassword()} disabled={pending} aria-busy={pending}>{pending ? 'Resetando…' : 'Confirmar reset'}</Button>
        <Button type="button" variant="blue-secondary" onClick={() => setConfirmOpen(false)} disabled={pending}>Cancelar</Button>
      </div>
    </ModalDialog>}
    {undoAvailable && <UndoSnackbar message="Senha resetada e novo primeiro acesso gerado." onUndo={() => void undoReset()} onClose={() => setUndoAvailable(false)} />}
  </>
}
