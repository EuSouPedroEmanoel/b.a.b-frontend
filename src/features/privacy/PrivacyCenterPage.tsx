import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Eye, EyeOff } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ModalDialog } from '@/components/ui/ModalDialog'
import { PageDescription } from '@/components/ui/PageDescription'
import { Tooltip } from '@/components/ui/Tooltip'
import { useAnnouncer } from '@/components/feedback/LiveRegionContext'
import api from '@/lib/api'

type Profile = {
  account: { name: string; username: string; cpf_masked: string | null; birthdate: string | null; class: string | null; school: string | null; role: string; status: string }
  library: { loans_total: number; active_loans: number; reservations_total: number; active_reservations: number }
  preferences: { favorites: number; reading_statuses: number }
  security: { password: string; tokens: string }
  sharing: string[]
  correction_guidance: string[]
  preservation: string[]
  privacy_contact_email?: string | null
}
type PrivacyRequest = { id: number; request_type: string; status: string; description: string | null; resolution: string | null; created_at: string; updated_at: string; due_at: string }
type Paginated<T> = { items: T[]; total: number; page: number; size: number; pages: number }

const roleLabels: Record<string, string> = { student: 'Aluno', teacher: 'Professor', librarian: 'Bibliotecário', school_admin: 'Administrador escolar', super_admin: 'Superadministrador' }
const accountStatusLabels: Record<string, string> = { active: 'Ativa', disabled: 'Desativada', pending_activation: 'Aguardando ativação' }
const requestTypes = [
  { value: 'access', label: 'Acessar meus dados', description: 'Consultar as informações pessoais associadas à sua conta.' },
  { value: 'information', label: 'Saber como meus dados são utilizados', description: 'Solicitar informações sobre uso e compartilhamento.' },
  { value: 'correction', label: 'Corrigir meus dados', description: 'Pedir correção de informações incompletas ou desatualizadas.' },
  { value: 'portability', label: 'Baixar ou portar meus dados', description: 'Solicitar seus dados em formato estruturado.' },
  { value: 'anonymization', label: 'Solicitar anonimização', description: 'Remover identificadores quando a preservação permitir.' },
  { value: 'blocking', label: 'Solicitar bloqueio', description: 'Pedir a restrição de determinado tratamento.' },
  { value: 'erasure', label: 'Solicitar eliminação', description: 'Pedir eliminação quando não houver necessidade de preservação.' },
] as const
const statusLabels: Record<string, string> = { pending: 'Pendente', in_review: 'Em análise', fulfilled: 'Concluída', partially_fulfilled: 'Parcialmente atendida', denied: 'Não atendida', cancelled: 'Cancelada' }

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Não informado'
  const date = value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value)
  return Number.isNaN(date.getTime()) ? 'Data não informada' : date.toLocaleDateString('pt-BR')
}
function roleLabel(value: string): string { return roleLabels[value] ?? 'Perfil não informado' }
function accountStatusLabel(value: string): string { return accountStatusLabels[value] ?? 'Situação não informada' }
function requestTypeLabel(value: string): string { return requestTypes.find((item) => item.value === value)?.label ?? 'Solicitação de dados' }
function requestStatusLabel(value: string): string { return statusLabels[value] ?? 'Status não informado' }
function requestIsOverdue(item: PrivacyRequest): boolean { return !['fulfilled', 'partially_fulfilled', 'denied', 'cancelled'].includes(item.status) && new Date(item.due_at).getTime() < Date.now() }

export function PrivacyCenterPage() {
  const queryClient = useQueryClient()
  const [dialog, setDialog] = useState<'export' | 'request' | null>(null)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [requestType, setRequestType] = useState('correction')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const profile = useQuery({ queryKey: ['privacy-profile'], queryFn: async () => (await api.get<Profile>('/privacy/me')).data })
  const requests = useQuery({ queryKey: ['privacy-requests'], queryFn: async () => (await api.get<Paginated<PrivacyRequest>>('/privacy/me/requests')).data })
  const closeDialog = () => { setDialog(null); setPassword(''); setShowPassword(false); setDescription(''); setError('') }
  const exportMutation = useMutation({
    mutationFn: async () => (await api.post('/privacy/me/export', { password })).data,
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a'); link.href = url; link.download = 'meus-dados.json'; link.click(); URL.revokeObjectURL(url)
      closeDialog(); setSuccess('O arquivo com seus dados foi baixado com sucesso.')
      window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
    },
    onError: () => setError('Não foi possível confirmar sua senha ou gerar a exportação.'),
  })
  const requestMutation = useMutation({
    mutationFn: async () => (await api.post<PrivacyRequest>('/privacy/me/requests', { request_type: requestType, description: description || null, ...(password ? { password } : {}) })).data,
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['privacy-requests'] }); closeDialog(); setSuccess('Sua solicitação foi registrada.') },
    onError: () => setError('Não foi possível registrar a solicitação.'),
  })
  const sensitiveRequest = ['anonymization', 'blocking', 'erasure'].includes(requestType)
  const selectedRequest = requestTypes.find((item) => item.value === requestType)
  const submitDialog = () => { setError(''); if (dialog === 'export') exportMutation.mutate(); if (dialog === 'request') requestMutation.mutate() }
  if (profile.isLoading) return <main><p role="status">Carregando seus dados…</p></main>
  if (profile.isError || !profile.data) return <main><p role="alert">Não foi possível carregar sua central de privacidade.</p></main>
  const data = profile.data
  return <main className="flex min-w-0 flex-col gap-6" aria-labelledby="privacy-center-title">
    <header><h1 id="privacy-center-title" className="text-2xl font-bold sm:text-3xl">Meus dados e privacidade</h1><PageDescription>Consulte os dados associados à sua conta e exerça seus direitos como titular.</PageDescription></header>
    {success && <DownloadSuccessCard message={success} />}
    <div className="grid gap-6 lg:grid-cols-2">
      <InfoCard title="Conta e identificação"><dl className="grid gap-3 sm:grid-cols-2"><Field label="Nome" value={data.account.name} /><Field label="Nome de usuário" value={data.account.username} /><Field label="CPF" value={data.account.cpf_masked ?? 'Não informado'} /><Field label="Data de nascimento" value={formatDate(data.account.birthdate)} /><Field label="Turma" value={data.account.class ?? 'Não informado'} /><Field label="Escola" value={data.account.school ?? 'Não informado'} /><Field label="Perfil" value={roleLabel(data.account.role)} /><Field label="Situação" value={accountStatusLabel(data.account.status)} /></dl><Link className="profile-text-link mt-4 inline-block" to="/perfil">Corrigir ou consultar edição de perfil</Link></InfoCard>
      <InfoCard title="Uso da biblioteca"><div className="grid grid-cols-1 gap-3 min-[34rem]:grid-cols-2"><Summary label="Empréstimos" value={data.library.loans_total} /><Summary label="Ativos" value={data.library.active_loans} /><Summary label="Reservas" value={data.library.reservations_total} /><Summary label="Reservas ativas" value={data.library.active_reservations} /></div></InfoCard>
      <InfoCard title="Preferências"><div className="grid grid-cols-1 gap-3 min-[34rem]:grid-cols-2"><Summary label="Favoritos" value={data.preferences.favorites} /><Summary label="Status de leitura" value={data.preferences.reading_statuses} /></div></InfoCard>
      <InfoCard title="Segurança" className="privacy-security-card"><p>Informações sensíveis de autenticação, como sua senha e tokens de acesso, nunca são exibidas nesta página.</p><Button className="mt-4" variant="secondary" onClick={() => { setSuccess(''); setDialog('export') }}>Exportar meus dados</Button></InfoCard>
      <InfoCard title="Uso e compartilhamento"><ul className="list-disc space-y-2 pl-5"><li>A escola utiliza seus dados para operar os serviços da biblioteca.</li><li>Alguns recursos podem depender de serviços externos necessários ao funcionamento do produto.</li><li>Para mais detalhes, consulte o <Link className="profile-text-link" to="/privacidade">Aviso de Privacidade</Link>.</li>{data.privacy_contact_email && <li>Canal de privacidade: <a className="profile-text-link" href={`mailto:${data.privacy_contact_email}`}>{data.privacy_contact_email}</a></li>}</ul></InfoCard>
      <InfoCard title="Correção e preservação"><ul className="list-disc space-y-2 pl-5">{data.correction_guidance.map((item) => <li key={item}>{item}</li>)}{data.preservation.map((item) => <li key={item}>{item}</li>)}<li>Para titulares menores, a escola pode validar a solicitação conforme suas regras institucionais e o melhor interesse do aluno.</li></ul></InfoCard>
    </div>
    <Card><CardBody><div className="flex min-w-0 flex-col items-stretch gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4"><div className="min-w-0"><h2 className="text-xl font-semibold">Solicitações de direitos</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Faça uma solicitação relacionada aos seus dados e acompanhe o andamento.</p></div><Button className="w-full whitespace-nowrap sm:w-auto" onClick={() => { setSuccess(''); setDialog('request') }}>Nova solicitação</Button></div>{requests.isLoading && <p role="status" className="mt-6">Carregando solicitações…</p>}{requests.data?.items.length === 0 && <p className="mt-6 rounded-md border p-4 text-sm">Você ainda não possui solicitações.</p>}{requests.data && requests.data.items.length > 0 && <ul className="mt-6 divide-y dark:divide-slate-700">{requests.data.items.map((item) => <li className="py-4 first:pt-0" key={item.id}><div className="flex flex-wrap items-start justify-between gap-2"><div><strong>{requestTypeLabel(item.request_type)}</strong><p className="mt-1 text-sm text-slate-600 dark:text-slate-300"><time dateTime={item.created_at}>Solicitada em {formatDate(item.created_at)}</time></p><p className={`text-sm ${requestIsOverdue(item) ? 'font-medium text-red-700 dark:text-red-300' : 'text-slate-600 dark:text-slate-300'}`}>{requestIsOverdue(item) ? 'Prazo ultrapassado' : `Prazo: ${formatDate(item.due_at)}`}</p></div><span aria-label={`Status: ${requestStatusLabel(item.status)}`} className="font-medium">{requestStatusLabel(item.status)}</span></div>{item.description && <p className="mt-2 text-sm">{item.description}</p>}{item.resolution && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Resposta: {item.resolution}</p>}</li>)}</ul>}</CardBody></Card>
    {dialog && <ModalDialog title={dialog === 'export' ? 'Confirmar exportação' : 'Nova solicitação'} onClose={closeDialog} variant="compact"><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); submitDialog() }}><p className="text-sm text-slate-600 dark:text-slate-300">{dialog === 'export' ? 'Informe sua senha atual para confirmar a exportação.' : 'O pedido poderá ser processado automaticamente ou encaminhado para análise, conforme a política da sua escola.'}</p>{dialog === 'request' && <><label className="block text-sm font-medium" htmlFor="privacy-request-type">O que você deseja solicitar?</label><select id="privacy-request-type" className="w-full rounded-md border p-3 dark:bg-slate-900" value={requestType} onChange={(event) => { setRequestType(event.target.value); setPassword('') }}>{requestTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>{selectedRequest && <p className="text-sm text-slate-600 dark:text-slate-300">{selectedRequest.description}</p>}<label className="block text-sm font-medium" htmlFor="privacy-request-description">Detalhes opcionais</label><textarea id="privacy-request-description" className="min-h-24 w-full rounded-md border p-3 dark:bg-slate-900" maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} />{sensitiveRequest && <p className="text-sm text-slate-600 dark:text-slate-300">Esta solicitação pode ser irreversível. Registros necessários podem ser preservados e relações ativas podem adiar parte do processamento.</p>}</>}{(dialog === 'export' || sensitiveRequest) && <PasswordField value={password} showPassword={showPassword} onChange={setPassword} onToggle={() => setShowPassword((visible) => !visible)} />}{error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={closeDialog}>Cancelar</Button><Button type="submit" disabled={exportMutation.isPending || requestMutation.isPending}>{dialog === 'export' ? 'Exportar JSON' : 'Registrar solicitação'}</Button></div></form></ModalDialog>}
  </main>
}

function InfoCard({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) { return <Card className={`min-w-0 ${className}`}><CardBody><h2 className="text-lg font-semibold">{title}</h2><div className="mt-4 text-sm">{children}</div></CardBody></Card> }
function Field({ label, value }: { label: string; value: string }) { return <div><dt className="text-slate-500 dark:text-slate-400">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div> }
function Summary({ label, value }: { label: string; value: number }) { return <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/40"><dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt><dd className="privacy-summary-value mt-1 text-xl font-semibold tabular-nums">{value}</dd></div> }

function DownloadSuccessCard({ message }: { message: string }) {
  const [completed, setCompleted] = useState(false)
  useEffect(() => {
    const timeout = window.setTimeout(() => setCompleted(true), 3200)
    return () => window.clearTimeout(timeout)
  }, [])

  return <div role="status" aria-live="polite" className="privacy-download-card relative flex items-center justify-between gap-4 overflow-hidden rounded-lg border border-blue-300 bg-blue-950/70 px-4 py-3 text-blue-50 shadow-sm dark:border-blue-400/70">
    <div className="privacy-download-content flex min-w-0 items-center gap-3"><span className="privacy-download-icon"><Download className="h-5 w-5 shrink-0 text-blue-300" aria-hidden="true" /></span><span className="privacy-download-message text-sm font-medium">{message}</span><span className="privacy-download-mobile-message text-sm font-medium">{completed ? 'Concluído' : 'Baixando'}</span></div>
    <span className="privacy-download-status shrink-0 text-xs text-blue-200" aria-hidden="true">{completed ? 'Concluído' : 'Baixando'}</span>
    <span className="privacy-download-edge" aria-hidden="true"><span className="privacy-download-progress" /></span>
  </div>
}

function PasswordField({ value, showPassword, onChange, onToggle }: { value: string; showPassword: boolean; onChange: (value: string) => void; onToggle: () => void }) {
  const announce = useAnnouncer()
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [])
  const toggle = () => { onToggle(); void announce(showPassword ? 'Senha oculta' : 'Senha visível', 'polite') }
  return <div className="flex flex-col gap-1.5"><label htmlFor="privacy-password" className="text-sm font-medium text-slate-700 dark:text-slate-200">Senha atual <span aria-hidden="true" className="text-red-600">*</span></label><div className="relative"><input ref={inputRef} id="privacy-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-md border px-3 py-2.5 pr-12 text-base bg-[var(--color-field)] dark:bg-slate-800/80 min-h-[44px] placeholder:text-slate-400 transition-colors border-[var(--color-field-border-hover)] dark:border-slate-600 hover:border-[var(--color-border)] dark:hover:border-slate-400 focus-visible:border-transparent focus-visible:outline-3 focus-visible:outline-[var(--color-focus)]" /><button type="button" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={showPassword} aria-controls="privacy-password" onClick={toggle} className="group absolute right-1 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200 min-h-[44px] min-w-[44px] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-focus)] focus-visible:outline-offset-2">{showPassword ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}<Tooltip>{showPassword ? 'Ocultar senha' : 'Mostrar senha'}</Tooltip></button></div><p className="sr-only">Para tecnologia assistiva, use o botão ao lado para alternar a exibição visual da senha.</p></div>
}
