import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Users, Pencil, Plus, AlertTriangle } from 'lucide-react'
import api from '@/lib/api'
import { formatCpfInput, onlyDigits, validateCpfDigits } from '@/lib/cpf'
import { getErrorMessage } from '@/lib/errors'
import { useAnnouncer } from '@/components/feedback/LiveRegionContext'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { PageDescription } from '@/components/ui/PageDescription'
import { ModalDialog } from '@/components/ui/ModalDialog'

type Student = {
  id: number
  username: string
  email: string | null
  cpf_masked: string | null
  birthdate: string | null
  turma_numero: number | null
  turma_letra: string | null
  role: string
  school_id: number | null
  is_active: boolean
  created_at: string | null
  updated_at: string | null
}
type Paginated<T> = { items: T[]; total: number; page: number; size: number; pages: number }

function turmaLabel(n: number | null, l: string | null): string {
  if (n === null || !l) return '—'
  return `${n}${l.toUpperCase()}`
}

// Regra de calendário (sem ano persistido): ano letivo vai de fevereiro a janeiro.
function currentSchoolYear(now = new Date()): number {
  return now.getMonth() + 1 >= 2 ? now.getFullYear() : now.getFullYear() - 1
}

function schoolYearStart(year: number): Date {
  // Feb 1st (mês 1) do ano letivo
  return new Date(year, 1, 1, 0, 0, 0, 0)
}

// Turma "desatualizada" = aluno não foi atualizado desde o início do ano letivo atual.
function isDeprecatedTurma(updatedAt: string | null, now = new Date()): boolean {
  if (!updatedAt) return false
  const studentUpdated = new Date(updatedAt)
  if (Number.isNaN(studentUpdated.getTime())) return false
  return studentUpdated < schoolYearStart(currentSchoolYear(now))
}

function parseDate(value: string): Date | null {
  const [y, m, d] = value.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function validateBirthdate(value: string): { ok: boolean; message?: string } {
  if (!value) return { ok: false, message: 'Informe a data de nascimento' }
  const dt = parseDate(value)
  if (!dt) return { ok: false, message: 'Data de nascimento inválida' }
  const now = new Date()
  if (dt > now) return { ok: false, message: 'Nascimento deve ser uma data no passado' }
  let age = now.getFullYear() - dt.getFullYear()
  const m = now.getMonth() - dt.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < dt.getDate())) age--
  if (age < 4 || age > 20) return { ok: false, message: 'Idade fora do intervalo permitido (4–20 anos)' }
  return { ok: true }
}

const emptyCreate = { name: '', cpf: '', birthdate: '', turmaNumero: '', turmaLetra: '' }

export function StudentsPage() {
  const announce = useAnnouncer()
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState(emptyCreate)
  const [createError, setCreateError] = useState('')
  const [editing, setEditing] = useState<Student | null>(null)
  const [editForm, setEditForm] = useState({ turmaNumero: '', turmaLetra: '', birthdate: '', password: '' })

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['students'],
    queryFn: async () => {
      const { data } = await api.get<Paginated<Student>>('/users/?role=student&size=100')
      return data
    },
  })

  const create = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<Student>('/users/students', {
        name: createForm.name.trim(),
        cpf: createForm.cpf,
        birthdate: createForm.birthdate,
        turma_numero: Number(createForm.turmaNumero),
        turma_letra: createForm.turmaLetra,
      })
      return data
    },
    onSuccess: () => {
      announce('Aluno cadastrado com sucesso', 'polite')
      setShowCreate(false)
      setCreateForm(emptyCreate)
      setCreateError('')
      qc.invalidateQueries({ queryKey: ['students'] })
    },
    onError: (err: unknown) => {
      const msg = getErrorMessage(err, 'Erro ao cadastrar aluno')
      setCreateError(msg)
      announce(msg, 'assertive')
    },
  })

  const update = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        turma_numero: Number(editForm.turmaNumero),
        turma_letra: editForm.turmaLetra,
        birthdate: editForm.birthdate,
      }
      if (editForm.password.trim()) payload.password = editForm.password
      const { data } = await api.put<Student>(`/users/${editing?.id}`, payload)
      return data
    },
    onSuccess: () => {
      announce('Aluno atualizado com sucesso', 'polite')
      closeEdit()
      qc.invalidateQueries({ queryKey: ['students'] })
    },
    onError: (err: unknown) => {
      const msg = getErrorMessage(err, 'Erro ao atualizar aluno')
      announce(msg, 'assertive')
    },
  })

  const submitCreate = (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError('')
    if (!createForm.name.trim() || !createForm.turmaNumero || !createForm.turmaLetra.trim()) {
      setCreateError('Preencha nome e turma (número e letra)')
      announce('Preencha nome e turma (número e letra)', 'assertive')
      return
    }
    if (!validateCpfDigits(createForm.cpf)) {
      setCreateError('Informe um CPF válido')
      announce('Informe um CPF válido', 'assertive')
      return
    }
    const bd = validateBirthdate(createForm.birthdate)
    if (!bd.ok) {
      setCreateError(bd.message ?? 'Data de nascimento inválida')
      announce(bd.message ?? 'Data de nascimento inválida', 'assertive')
      return
    }
    create.mutate()
  }

  const openEdit = (student: Student) => {
    setEditing(student)
    setEditForm({
      turmaNumero: student.turma_numero === null ? '' : String(student.turma_numero),
      turmaLetra: student.turma_letra ?? '',
      birthdate: student.birthdate ?? '',
      password: '',
    })
  }

  const closeEdit = () => {
    setEditing(null)
    setEditForm({ turmaNumero: '', turmaLetra: '', birthdate: '', password: '' })
  }

  const deprecatedCount = useMemo(
    () => (data?.items ?? []).filter((s) => isDeprecatedTurma(s.updated_at)).length,
    [data],
  )

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Alunos</h1>
          <PageDescription>
            Cadastro de estudantes — identificados por CPF e turma (número e letra).
          </PageDescription>
        </div>
        <Button onClick={() => { setCreateError(''); setShowCreate(true) }}>
          <Plus className="h-4 w-4 mr-2" aria-hidden="true" /> Cadastrar aluno
        </Button>
      </header>

      {deprecatedCount > 0 && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 text-sm text-amber-800 dark:text-amber-200"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" aria-hidden="true" />
          <p>
            <strong>{deprecatedCount} aluno(s)</strong> sem atualização na turma desde o início do
            ano letivo de {currentSchoolYear()}. Confirme e atualize as turmas.
          </p>
        </div>
      )}

      {isLoading && (
        <Card>
          <CardBody>
            <p aria-live="polite">Carregando alunos…</p>
          </CardBody>
        </Card>
      )}

      {isError && (
        <div role="alert" className="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 p-4 text-sm text-red-800 dark:text-red-200">
          Erro ao carregar alunos: {(error as { message?: string })?.message ?? 'tente novamente'}
        </div>
      )}

      {data && (
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2">
              <Users className="h-5 w-5" aria-hidden="true" /> Lista de alunos
            </h2>
            <Badge tone="info">{`${data.total} registrado(s)`}</Badge>
          </CardHeader>
          <CardBody className="p-0">
            {data.items.length === 0 ? (
              <p className="text-sm text-slate-500 p-6">Nenhum aluno cadastrado nesta escola.</p>
            ) : (
              <div className="@container max-w-full overflow-x-auto overscroll-x-contain">
                <table className="w-full min-w-0 text-sm @max-lg:table-fixed">
                  <caption className="sr-only">Alunos cadastrados</caption>
                  <thead className="bg-slate-50 dark:bg-slate-700/50">
                    <tr>
                      <th scope="col" className="px-4 py-3 text-left font-semibold @max-lg:w-auto">Nome</th>
                      <th scope="col" className="px-4 py-3 text-left font-semibold @max-lg:w-24">CPF</th>
                      <th scope="col" className="px-4 py-3 text-left font-semibold @max-lg:hidden">Nascimento</th>
                      <th scope="col" className="px-4 py-3 text-left font-semibold @max-lg:w-20">Turma</th>
                      <th scope="col" className="w-[1%] px-4 py-3 text-right font-semibold">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {data.items.map((s) => {
                      const deprecated = isDeprecatedTurma(s.updated_at)
                      return (
                        <tr key={s.id}>
                          <td className="break-words px-4 py-3 align-top font-medium capitalize">
                            <span>{s.username.replace(/\./g, ' ')}</span>
                            <span className="mt-1 hidden text-xs font-normal text-slate-600 dark:text-slate-300 @max-lg:block">
                              Nascimento: {s.birthdate ? new Date(`${s.birthdate}T00:00:00`).toLocaleDateString('pt-BR') : '—'}
                            </span>
                          </td>
                          <td className="break-words px-4 py-3 align-top font-mono text-xs">{s.cpf_masked ?? '—'}</td>
                          <td className="px-4 py-3 align-top @max-lg:hidden">
                            {s.birthdate ? (
                              new Date(`${s.birthdate}T00:00:00`).toLocaleDateString('pt-BR')
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-4 py-3 align-top">
                            <span className="flex items-center gap-2">
                              <span className="font-mono font-medium">{turmaLabel(s.turma_numero, s.turma_letra)}</span>
                              {deprecated && <Badge tone="warning">Atualizar</Badge>}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right align-top">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => openEdit(s)}
                              aria-label={`Editar aluno ${s.username.replace(/\./g, ' ')}`}
                              title={`Editar aluno ${s.username.replace(/\./g, ' ')}`}
                            >
                              <Pencil className="h-4 w-4 @max-lg:mr-0 mr-1" aria-hidden="true" />
                              <span className="@max-lg:sr-only">Editar</span>
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {showCreate && (
        <ModalDialog variant="form" title="Cadastrar aluno" onClose={() => { setCreateError(''); setShowCreate(false) }}>
          <form onSubmit={submitCreate} className="grid gap-4">
            {createError && (
              <p role="alert" className="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-800 dark:text-red-200">
                {createError}
              </p>
            )}
            <Input
              label="Nome completo"
              value={createForm.name}
              onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
              required
              autoComplete="off"
            />
            <Input
              label="CPF"
              value={formatCpfInput(createForm.cpf)}
              onChange={(e) => setCreateForm((f) => ({ ...f, cpf: onlyDigits(e.target.value) }))}
              placeholder="000.000.000-00"
              required
              inputMode="numeric"
              autoComplete="off"
            />
            <Input
              label="Nascimento"
              type="date"
              value={createForm.birthdate}
              onChange={(e) => setCreateForm((f) => ({ ...f, birthdate: e.target.value }))}
              autoComplete="off"
              hint="A primeira senha do aluno será a data de nascimento como números (ddmmaaaa)."
            />
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))] gap-4">
              <div className="min-w-0"><Input
                  label="Turma — número"
                  value={createForm.turmaNumero}
                  onChange={(e) => setCreateForm((f) => ({ ...f, turmaNumero: e.target.value.replace(/[^0-9]/g, '').slice(0, 2) }))}
                  placeholder="ex: 7"
                  required
                  inputMode="numeric"
                  autoComplete="off"
                /></div>
              <div className="min-w-0"><Input
                  label="Turma — letra"
                  value={createForm.turmaLetra}
                  onChange={(e) => setCreateForm((f) => ({ ...f, turmaLetra: e.target.value.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 1) }))}
                  placeholder="ex: A"
                  required
                  maxLength={1}
                  autoComplete="off"
                /></div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={() => { setCreateError(''); setShowCreate(false) }}>
                Cancelar
              </Button>
              <Button type="submit" disabled={create.isPending} aria-busy={create.isPending}>
                {create.isPending ? 'Cadastrando…' : 'Cadastrar'}
              </Button>
            </div>
          </form>
        </ModalDialog>
      )}

      {editing && (
        <ModalDialog variant="form" title={`Editar aluno — ${editing.username.replace(/\./g, ' ')}`} onClose={closeEdit}>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!editForm.turmaNumero || !editForm.turmaLetra.trim()) {
                announce('Informe a turma (número e letra)', 'assertive')
                return
              }
              update.mutate()
            }}
            className="grid gap-4"
          >
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))] gap-4">
              <div className="min-w-0"><Input
                  label="Turma — número"
                  value={editForm.turmaNumero}
                  onChange={(e) => setEditForm((f) => ({ ...f, turmaNumero: e.target.value.replace(/[^0-9]/g, '').slice(0, 2) }))}
                  required
                  inputMode="numeric"
                  autoComplete="off"
                /></div>
              <div className="min-w-0"><Input
                  label="Turma — letra"
                  value={editForm.turmaLetra}
                  onChange={(e) => setEditForm((f) => ({ ...f, turmaLetra: e.target.value.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 1) }))}
                  required
                  maxLength={1}
                  autoComplete="off"
                /></div>
            </div>
            <Input
              label="Nascimento"
              type="date"
              value={editForm.birthdate}
              onChange={(e) => setEditForm((f) => ({ ...f, birthdate: e.target.value }))}
              autoComplete="off"
            />
            <Input
              label="Nova senha (opcional)"
              type="password"
              value={editForm.password}
              onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))}
              autoComplete="new-password"
            />
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={closeEdit}>
                Cancelar
              </Button>
              <Button type="submit" disabled={update.isPending} aria-busy={update.isPending}>
                {update.isPending ? 'Salvando…' : 'Salvar'}
              </Button>
            </div>
          </form>
        </ModalDialog>
      )}
    </div>
  )
}
