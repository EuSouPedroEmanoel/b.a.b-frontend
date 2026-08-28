import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Barcode, Plus } from 'lucide-react'
import api from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'
import { useAnnouncer } from '@/components/feedback/LiveRegion'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

type Book = { id: number; title: string; isbn: string | null }
type Copy = { id: number; code: string; state: string; condition: string; book_id: number; school_id: number }
type Paginated<T> = { items: T[]; total: number; page: number; size: number; pages: number }

export function BookCopyCreatePage() {
  const { bookId } = useParams<{ bookId: string }>()
  const id = Number(bookId)
  const announce = useAnnouncer()
  const qc = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [code, setCode] = useState('')
  const [copyError, setCopyError] = useState<string | null>(null)

  const { data: book } = useQuery({
    queryKey: ['book', id],
    queryFn: async () => {
      const { data } = await api.get<Paginated<Book>>('/books/?size=100')
      const found = data.items.find((b) => b.id === id)
      if (!found) throw new Error('Livro não encontrado')
      return found
    },
    enabled: Number.isFinite(id),
  })

  const { data: copiesPage } = useQuery({
    queryKey: ['copies', id],
    queryFn: async () => {
      const { data } = await api.get<Paginated<Copy>>(`/copies/?size=100&book_id=${id}`)
      const filtered = (data.items as Copy[]).filter((c) => c.book_id === id)
      if (filtered.length !== data.items.length && data.items.some((c) => c.book_id !== id)) {
        return { ...data, items: filtered, total: filtered.length, pages: 1 }
      }
      return data
    },
    enabled: Number.isFinite(id),
  })

  const count = copiesPage?.total ?? copiesPage?.items.length ?? 0

  const createCopy = useMutation({
    mutationFn: async (c: string) => {
      const { data } = await api.post<Copy>(`/books/${id}/copies/`, { code: c })
      return data
    },
    onSuccess: (newCopy) => {
      announce(`Exemplar ${newCopy.code} cadastrado — total ${count + 1}`, 'polite')
      setCopyError(null)
      setCode('')
      qc.invalidateQueries({ queryKey: ['copies', id] })
      requestAnimationFrame(() => inputRef.current?.focus())
    },
    onError: (e: unknown, attemptedCode) => {
      const status = (e as { response?: { status?: number } })?.response?.status
      const rawMsg = getErrorMessage(e, 'Erro ao cadastrar exemplar')
      const msg = status === 409 ? `Código [${attemptedCode}] já cadastrado para outro exemplar` : rawMsg
      setCopyError(msg)
      announce(msg, 'assertive')
      setCode('')
      requestAnimationFrame(() => inputRef.current?.focus())
    },
  })

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setCopyError(null)
    const clean = code.trim()
    if (!clean) {
      const msg = 'Informe o código do exemplar'
      setCopyError(msg)
      announce(msg, 'assertive')
      return
    }
    createCopy.mutate(clean)
  }

  if (!Number.isFinite(id)) {
    return (
      <div role="alert" className="p-8 text-center">
        ID de livro inválido
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl flex flex-col gap-6">
      <header>
        <Link to={`/acervo/${id}`} className="inline-flex items-center text-sm text-slate-600 dark:text-slate-300 hover:text-[var(--color-primary)] mb-2">
          <ArrowLeft className="h-4 w-4 mr-1" aria-hidden="true" /> Voltar ao livro
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold">Cadastrar exemplares</h1>
        {book && (
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
            Livro: <span className="font-semibold">{book.title}</span>{' '}
            {book.isbn && <span className="font-mono text-xs bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">{book.isbn}</span>}{' '}
            <span className="text-xs text-slate-500">— {count} unidade{count !== 1 ? 's' : ''} já cadastrada{count !== 1 ? 's' : ''}</span>
          </p>
        )}
      </header>

      <Card>
        <CardHeader>
          <h2 className="font-semibold flex items-center gap-2">
            <Barcode className="h-5 w-5" aria-hidden="true" /> Adicionar exemplar
          </h2>
          <p className="text-sm text-slate-500">Bipe o código de barras — campo permanece focado para loop contínuo.</p>
        </CardHeader>
        <CardBody>
          {copyError && (
            <div role="alert" className="mb-4 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-800 dark:text-red-200">
              {copyError}
            </div>
          )}
          <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1 w-full">
              <Input
                label="Código do exemplar"
                id="copy-code"
                ref={inputRef as never}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Bipe o código de barras"
                autoComplete="off"
                autoFocus
                required
              />
              <p className="text-xs text-slate-500 mt-1">O leitor envia Enter automaticamente. Após cada cadastro o campo limpa e mantém o foco.</p>
            </div>
            <Button type="submit" disabled={createCopy.isPending} aria-busy={createCopy.isPending} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" aria-hidden="true" /> Adicionar
            </Button>
          </form>
          <div className="mt-4 flex gap-2">
            <Link
              to={`/acervo/${id}`}
              className="inline-flex items-center px-4 py-2 rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 min-h-[44px] text-sm"
            >
              Concluir / Voltar ao livro
            </Link>
            <Link to="/acervo" className="inline-flex items-center px-4 py-2 rounded-md bg-slate-100 dark:bg-slate-700 min-h-[44px] text-sm">
              Voltar ao Acervo
            </Link>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
