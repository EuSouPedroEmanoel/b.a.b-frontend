import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { Link, Navigate, useLocation, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { PageDescription } from '@/components/ui/PageDescription'
import { useAuth } from '@/hooks/useAuth'
import api from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'

type ProfileForm = { name: string; username: string }

export function AccountManagementPage() {
  const { id } = useParams()
  const { hash } = useLocation()
  const { user, refreshUser } = useAuth()
  const [profile, setProfile] = useState<ProfileForm>(() => ({ name: user?.name ?? '', username: user?.username ?? '' }))
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [profileError, setProfileError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [profileSuccess, setProfileSuccess] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const profileErrorRef = useRef<HTMLDivElement>(null)
  const passwordErrorRef = useRef<HTMLDivElement>(null)
  const profileSuccessRef = useRef<HTMLDivElement>(null)
  const passwordSuccessRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (hash === '#senha') document.getElementById('senha')?.focus()
    else if (hash === '#perfil') document.getElementById('perfil')?.focus()
  }, [hash])

  const profileMutation = useMutation({
    mutationFn: async (payload: ProfileForm) => api.put(`/users/${user?.id}`, payload),
    onSuccess: async () => { await refreshUser(); setProfileSuccess('Perfil atualizado com sucesso.'); setProfileError(''); requestAnimationFrame(() => profileSuccessRef.current?.focus()) },
    onError: (error: unknown) => { setProfileError(getErrorMessage(error, 'Não foi possível atualizar o perfil.')); setProfileSuccess(''); requestAnimationFrame(() => profileErrorRef.current?.focus()) },
  })
  const passwordMutation = useMutation({
    mutationFn: async (newPassword: string) => api.put(`/users/${user?.id}`, { password: newPassword }),
    onSuccess: () => { setPassword(''); setConfirmation(''); setPasswordSuccess('Senha alterada com sucesso.'); setPasswordError(''); requestAnimationFrame(() => passwordSuccessRef.current?.focus()) },
    onError: (error: unknown) => { setPasswordError(getErrorMessage(error, 'Não foi possível alterar a senha.')); setPasswordSuccess(''); requestAnimationFrame(() => passwordErrorRef.current?.focus()) },
  })

  if (!user) return null
  if (id !== String(user.id)) return <Navigate to="/perfil" replace />

  const submitProfile = (event: FormEvent) => {
    event.preventDefault()
    const name = profile.name.trim(); const username = profile.username.trim()
    if (!name || !username) { setProfileError('Preencha o nome e o nome de usuário.'); requestAnimationFrame(() => profileErrorRef.current?.focus()); return }
    profileMutation.mutate({ name, username })
  }
  const submitPassword = (event: FormEvent) => {
    event.preventDefault()
    if (!password) { setPasswordError('Informe a nova senha.'); requestAnimationFrame(() => passwordErrorRef.current?.focus()); return }
    if (password !== confirmation) { setPasswordError('A confirmação deve ser igual à nova senha.'); requestAnimationFrame(() => passwordErrorRef.current?.focus()); return }
    passwordMutation.mutate(password)
  }

  return <main className="flex min-w-0 flex-col gap-6">
    <header><Link to="/perfil" className="profile-text-link mb-3 gap-2"><ArrowLeft aria-hidden="true" className="h-4 w-4" /> Voltar ao perfil</Link><h1 className="text-2xl font-bold sm:text-3xl">Gerenciar perfil</h1><PageDescription>Atualize seus dados pessoais ou altere sua senha.</PageDescription></header>
    <section id="perfil" tabIndex={-1} aria-labelledby="edit-profile-heading" className="focus:outline-none"><Card><CardBody><h2 id="edit-profile-heading" className="text-lg font-semibold">Editar perfil</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Somente os campos permitidos para sua própria conta podem ser alterados.</p>
      <form className="mt-6 flex flex-col gap-4" onSubmit={submitProfile} noValidate>
        {profileError && <div ref={profileErrorRef} tabIndex={-1} role="alert" className="profile-error-message">{profileError}</div>}{profileSuccess && <div ref={profileSuccessRef} tabIndex={-1} role="status" className="profile-success-message">{profileSuccess}</div>}
        <Input id="profile-name" label="Nome" value={profile.name} onChange={(event) => setProfile((current) => ({ ...current, name: event.target.value }))} required autoComplete="name" />
        <Input id="profile-username" label="Nome de usuário" value={profile.username} onChange={(event) => setProfile((current) => ({ ...current, username: event.target.value }))} required autoComplete="username" />
        <div><Button type="submit" disabled={profileMutation.isPending} aria-busy={profileMutation.isPending}>{profileMutation.isPending ? 'Salvando…' : 'Salvar alterações'}</Button></div>
      </form>
    </CardBody></Card></section>
    <section id="senha" tabIndex={-1} aria-labelledby="change-password-heading" className="focus:outline-none"><Card><CardBody><h2 id="change-password-heading" className="text-lg font-semibold">Alterar senha</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Digite e confirme uma nova senha. A senha não será exibida nem preservada após o envio.</p>
      <form className="mt-6 flex flex-col gap-4" onSubmit={submitPassword} noValidate>
        {passwordError && <div ref={passwordErrorRef} tabIndex={-1} role="alert" className="profile-error-message">{passwordError}</div>}{passwordSuccess && <div ref={passwordSuccessRef} tabIndex={-1} role="status" className="profile-success-message">{passwordSuccess}</div>}
        <Input id="new-password" label="Nova senha" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="new-password" />
        <Input id="confirm-password" label="Confirmar nova senha" type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} error={confirmation && password !== confirmation ? 'As senhas não coincidem.' : undefined} required autoComplete="new-password" />
        <div><Button type="submit" disabled={passwordMutation.isPending} aria-busy={passwordMutation.isPending}>{passwordMutation.isPending ? 'Alterando…' : 'Alterar senha'}</Button></div>
      </form>
    </CardBody></Card></section>
  </main>
}
