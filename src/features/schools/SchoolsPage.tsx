import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { useAnnouncer } from '@/components/feedback/LiveRegionContext'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Pagination } from '@/components/ui/Pagination'
import { PageDescription } from '@/components/ui/PageDescription'
import { getErrorMessage } from '@/lib/errors'

type School = { id: number; name: string; code: string; is_active: boolean }
type Paginated<T> = { items: T[]; total: number; page: number; size: number; pages: number }

export function SchoolsPage() {
  const [page, setPage] = useState(1)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const announce = useAnnouncer()
  const qc = useQueryClient()

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['schools', page],
    queryFn: async () => {
      const { data } = await api.get<Paginated<School>>(`/schools/?page=${page}&size=10`)
      return data
    },
  })

  const mut = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<School>('/schools/', { name, code })
      return data
    },
    onSuccess: () => {
      announce('Escola criada', 'polite')
      setName('')
      setCode('')
      qc.invalidateQueries({ queryKey: ['schools'] })
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Erro ao criar escola (apenas SUPER_ADMIN)'
      announce(msg, 'assertive')
    },
  })

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl sm:text-3xl font-bold">Escolas</h1>
        <PageDescription>Gestão multi-tenant — apenas SUPER_ADMIN. Código único por escola.</PageDescription>
      </header>

      <Card>
        <CardHeader>
          <h2 className="font-semibold">Nova escola</h2>
        </CardHeader>
        <CardBody>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (name.length < 2 || code.length < 2) {
                announce('Nome e código com mínimo 2 caracteres', 'assertive')
                return
              }
              mut.mutate()
            }}
            className="grid items-start gap-4 sm:grid-cols-3"
          >
            <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
            <Input label="Código" value={code} onChange={(e) => setCode(e.target.value)} required minLength={2} placeholder="ex: ginasio-sp" />
            <Button type="submit" disabled={mut.isPending} className="sm:mt-[calc(var(--text-sm)*var(--text-sm--line-height)+0.375rem)]">
              {mut.isPending ? 'Criando…' : 'Criar escola'}
            </Button>
          </form>
        </CardBody>
      </Card>

      {isLoading && <p role="status" className="rounded-xl border border-slate-200 p-4 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">Carregando escolas…</p>}
      {isError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200"><span>{getErrorMessage(error, 'Não foi possível carregar as escolas.')}</span><Button type="button" size="sm" variant="secondary" onClick={() => void refetch()}>Tentar novamente</Button></div>}
      {data && (
        <>
          {data.items.length === 0 && <p role="status" className="rounded-xl border border-slate-200 p-4 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">Nenhuma escola cadastrada.</p>}
          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 md:block">
            <table className="w-full text-sm">
              <caption className="sr-only">Escolas cadastradas</caption>
              <thead className="bg-slate-50 dark:bg-slate-700/50">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">
                    ID
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">
                    Nome
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">
                    Código
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">
                    Ativa
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {data.items.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-3">#{s.id}</td>
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{s.code}</td>
                    <td className="px-4 py-3">{s.is_active ? 'Sim' : 'Não'}</td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/gerenciar-escola?tab=rules&school=${s.id}`}
                        className="inline-flex min-h-[40px] items-center rounded-md px-3 py-2 text-sm font-medium text-[#0f4c75] underline-offset-2 hover:underline focus-visible:outline-3 focus-visible:outline-[var(--color-focus)] focus-visible:outline-offset-2 dark:text-sky-300"
                      >
                        Regras de circulação
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="grid gap-3 md:hidden" aria-label="Escolas cadastradas">
            {data.items.map((s) => (
              <li key={s.id} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="break-words font-semibold">{s.name}</h2>
                    <p className="mt-1 break-all font-mono text-xs text-slate-600 dark:text-slate-300">{s.code}</p>
                  </div>
                  <span className="shrink-0 rounded-full border border-slate-300 px-2 py-1 text-xs font-medium dark:border-slate-600">
                    {s.is_active ? 'Ativa' : 'Inativa'}
                  </span>
                </div>
                <dl className="mt-3 grid gap-1 text-sm text-slate-600 dark:text-slate-300">
                  <div className="flex gap-2"><dt className="font-medium">ID:</dt><dd>#{s.id}</dd></div>
                </dl>
                <Link
                  to={`/gerenciar-escola?tab=rules&school=${s.id}`}
                  className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-md border border-slate-300 px-3 py-2 text-center text-sm font-medium text-[#0f4c75] underline-offset-2 hover:bg-slate-50 hover:underline focus-visible:outline-3 focus-visible:outline-[var(--color-focus)] focus-visible:outline-offset-2 dark:border-slate-600 dark:text-sky-300 dark:hover:bg-slate-700"
                >
                  Regras de circulação
                </Link>
              </li>
            ))}
          </ul>
          <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />
        </>
      )}
    </div>
  )
}
