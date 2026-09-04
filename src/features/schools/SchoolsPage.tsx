import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { useAnnouncer } from '@/components/feedback/LiveRegionContext'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Pagination } from '@/components/ui/Pagination'

type School = { id: number; name: string; code: string; is_active: boolean }
type Paginated<T> = { items: T[]; total: number; page: number; size: number; pages: number }

export function SchoolsPage() {
  const [page, setPage] = useState(1)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const announce = useAnnouncer()
  const qc = useQueryClient()

  const { data } = useQuery({
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
        <p className="text-sm text-slate-500 mt-1">Gestão multi-tenant — apenas SUPER_ADMIN. Código único por escola.</p>
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
            className="grid gap-4 sm:grid-cols-3 items-end"
          >
            <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
            <Input label="Código" value={code} onChange={(e) => setCode(e.target.value)} required minLength={2} placeholder="ex: ginasio-sp" />
            <Button type="submit" disabled={mut.isPending}>
              {mut.isPending ? 'Criando…' : 'Criar escola'}
            </Button>
          </form>
        </CardBody>
      </Card>

      {data && (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
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
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {data.items.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-3">#{s.id}</td>
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{s.code}</td>
                    <td className="px-4 py-3">{s.is_active ? 'Sim' : 'Não'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />
        </>
      )}
    </div>
  )
}
