import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Barcode, Edit3, Check, Search } from 'lucide-react'
import api from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'
import { useAnnouncer } from '@/components/feedback/LiveRegion'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

type Book = { id: number; title: string; description: string | null; state: string; isbn: string | null; is_active: boolean; added_by: number }
type Lookup = { isbn: string; title: string | null; description: string | null; found: boolean; already_exists: boolean; existing_book_id: number | null }

type Step = 'scan' | 'confirm' | 'edit'

export function BookCreatePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const announce = useAnnouncer()
  const qc = useQueryClient()
  const [step, setStep] = useState<Step>('scan')
  const [isbn, setIsbn] = useState('')
  const [preview, setPreview] = useState<Lookup | null>(null)
  const [manual, setManual] = useState({ title: '', description: '' })
  const [formError, setFormError] = useState<string | null>(null)
  const isbnRef = useRef<HTMLInputElement>(null)

  const allowed = ['librarian', 'school_admin']
  const canCreate = !!user && allowed.includes(user.role)

  const lookupMut = useMutation({
    mutationFn: async (rawIsbn: string) => {
      const clean = rawIsbn.replace(/[^0-9X]/gi, '')
      const { data } = await api.get<Lookup>(`/books/lookup?isbn=${encodeURIComponent(clean)}`)
      return data
    },
    onSuccess: (data) => {
      setPreview(data)
      if (data.already_exists) {
        announce('Livro já cadastrado', 'polite')
        setStep('confirm')
      } else if (data.found) {
        announce(`Livro encontrado: ${data.title}`, 'polite')
        setStep('confirm')
      } else {
        announce('Livro não encontrado, preencha manualmente', 'assertive')
        setManual({ title: '', description: '' })
        setStep('edit')
      }
    },
    onError: (e: unknown) => {
      const msg = getErrorMessage(e, 'Erro ao consultar ISBN')
      setFormError(msg)
      announce(msg, 'assertive')
    },
  })

  const createMut = useMutation({
    mutationFn: async (payload: Record<string, string>) => {
      const { data } = await api.post<Book>('/books/', payload)
      return data
    },
    onSuccess: (book) => {
      announce('Livro cadastrado com sucesso', 'polite')
      qc.invalidateQueries({ queryKey: ['books'] })
      navigate(`/acervo/${book.id}`)
    },
    onError: (e: unknown) => {
      const msg = getErrorMessage(e, 'Erro ao cadastrar livro')
      setFormError(msg)
      announce(msg, 'assertive')
    },
  })

  const patchMut = useMutation({
    mutationFn: async (payload: Record<string, string>) => {
      if (!preview?.existing_book_id) throw new Error('ID do livro não encontrado')
      const { data } = await api.patch<Book>(`/books/${preview.existing_book_id}`, payload)
      return data
    },
    onSuccess: (book) => {
      announce('Livro atualizado com sucesso', 'polite')
      qc.invalidateQueries({ queryKey: ['books'] })
      navigate(`/acervo/${book.id}`)
    },
    onError: (e: unknown) => {
      const msg = getErrorMessage(e, 'Erro ao atualizar livro')
      setFormError(msg)
      announce(msg, 'assertive')
    },
  })

  const isSaving = createMut.isPending || patchMut.isPending

  const initialIsbn = searchParams.get('isbn') || ''
  useEffect(() => {
    if (!initialIsbn) return
    const clean = initialIsbn.replace(/[^0-9X]/gi, '')
    setIsbn(clean)
    if (clean.length >= 10) {
      lookupMut.mutate(clean)
    } else {
      setPreview({ isbn: clean || initialIsbn, title: null, description: null, found: false, already_exists: false, existing_book_id: null })
      setManual({ title: '', description: '' })
      setStep('edit')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialIsbn])

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    const clean = isbn.replace(/[^0-9X]/gi, '')
    if (clean.length < 10) {
      const msg = 'ISBN inválido — mínimo 10 dígitos'
      setFormError(msg)
      announce(msg, 'assertive')
      isbnRef.current?.focus()
      return
    }
    lookupMut.mutate(clean)
  }

  const handleConfirm = () => {
    if (!preview) return
    setFormError(null)
    const payload: Record<string, string> = { isbn: preview.isbn }
    if (preview.title) payload.title = preview.title
    if (preview.description) payload.description = preview.description
    // Se título veio vazio (found false não acontece aqui), fallback para manual
    if (!payload.title) {
      setManual({ title: preview.title || '', description: preview.description || '' })
      setStep('edit')
      return
    }
    createMut.mutate(payload)
  }

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!manual.title.trim()) {
      const msg = 'Informe o título'
      setFormError(msg)
      announce(msg, 'assertive')
      return
    }
    if (!preview) return
    if (preview.already_exists && preview.existing_book_id) {
      // Atualiza livro já cadastrado — permite librarian corrigir dados do acervo
      patchMut.mutate({ title: manual.title.trim(), description: manual.description.trim() })
    } else {
      createMut.mutate({ isbn: preview.isbn, title: manual.title.trim(), description: manual.description.trim() })
    }
  }

  if (!canCreate) {
    return (
      <div role="alert" className="mx-auto max-w-2xl py-12 text-center">
        <h1 className="text-2xl font-bold">Sem permissão</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">Apenas bibliotecários e administradores escolares podem cadastrar livros.</p>
        <p className="mt-1 text-sm text-slate-500">Seu perfil: <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">{user?.role ?? 'desconhecido'}</code></p>
        <Link to="/acervo" className="inline-flex mt-6 px-4 py-2 rounded-md bg-[var(--color-primary)] text-white min-h-[44px] items-center">
          <ArrowLeft className="h-4 w-4 mr-2" aria-hidden="true" /> Voltar ao acervo
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl flex flex-col gap-6">
      <header>
        <Link to="/acervo" className="inline-flex items-center text-sm text-slate-600 dark:text-slate-300 hover:text-[var(--color-primary)] mb-2">
          <ArrowLeft className="h-4 w-4 mr-1" aria-hidden="true" /> Voltar ao acervo
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold">Cadastrar livro</h1>
        <p className="text-sm text-slate-500 mt-1">Passe o leitor no código de barras — cadastro só será efetivado ao confirmar.</p>
      </header>

      {step === 'scan' && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold flex items-center gap-2"><Barcode className="h-5 w-5" aria-hidden="true" /> Leitor de ISBN</h2>
            <p className="text-sm text-slate-500">Bipe o código de barras ou digite o ISBN. Ao lado, acesso ao cadastro manual.</p>
          </CardHeader>
          <CardBody>
            {formError && (
              <div role="alert" className="mb-4 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-800 dark:text-red-200">
                {formError}
              </div>
            )}
            <form onSubmit={handleScan} className="flex flex-col gap-4" aria-label="Buscar ISBN">
              <Input
                label="ISBN"
                id="book-isbn-scan"
                ref={isbnRef as never}
                value={isbn}
                onChange={(e) => setIsbn(e.target.value)}
                placeholder="978..."
                inputMode="numeric"
                autoComplete="off"
                autoFocus
                required
              />
              <p id="isbn-help" className="text-xs text-slate-500 -mt-2">O leitor envia Enter automaticamente após bipar.</p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button type="submit" disabled={lookupMut.isPending} aria-busy={lookupMut.isPending} className="flex-1 sm:flex-none">
                  {lookupMut.isPending ? (
                    'Buscando...'
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" aria-hidden="true" /> Buscar
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    const clean = isbn.replace(/[^0-9X]/gi, '')
                    if (clean.length >= 10) setPreview({ isbn: clean, title: null, description: null, found: false, already_exists: false, existing_book_id: null })
                    else if (isbn.trim()) setPreview({ isbn: isbn.trim(), title: null, description: null, found: false, already_exists: false, existing_book_id: null })
                    else setPreview({ isbn: '', title: null, description: null, found: false, already_exists: false, existing_book_id: null })
                    setManual({ title: '', description: '' })
                    setStep('edit')
                    setFormError(null)
                  }}
                  className="flex-1 sm:flex-none"
                >
                  <Edit3 className="h-4 w-4 mr-2" aria-hidden="true" /> Cadastro manual
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      {step === 'confirm' && preview && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold">Confirme os dados</h2>
            {preview.already_exists ? (
              <div role="status" className="mt-3 rounded-md bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-700 p-3 text-sm text-sky-900 dark:text-sky-200">
                Este livro já está cadastrado no acervo. Deseja adicionar novos exemplares?
              </div>
            ) : (
              <p className="text-sm text-slate-500">Revise as informações encontradas. O ISBN está bloqueado para edição.</p>
            )}
          </CardHeader>
          <CardBody>
            {formError && (
              <div role="alert" className="mb-4 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 p-3 text-sm text-red-800 dark:text-red-200">
                {formError}
              </div>
            )}
            <dl className="grid gap-4">
              <div>
                <dt className="text-sm font-medium text-slate-600 dark:text-slate-300">ISBN</dt>
                <dd className="mt-1">
                  <span className="inline-flex font-mono text-sm bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-3 py-2 rounded-md">{preview.isbn}</span>
                  <span className="ml-2 text-xs text-slate-500">(não editável)</span>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-slate-600 dark:text-slate-300">Título</dt>
                <dd className="mt-1 p-3 rounded-md bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">{preview.title || '—'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-slate-600 dark:text-slate-300">Descrição</dt>
                <dd className="mt-1 p-3 rounded-md bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm max-h-32 overflow-auto">
                  {preview.description || '—'}
                </dd>
              </div>
            </dl>
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              {preview.already_exists ? (
                <>
                  <Link
                    to={`/acervo/${preview.existing_book_id}`}
                    className="inline-flex items-center justify-center px-5 py-2.5 rounded-md bg-sky-600 text-white hover:bg-sky-700 min-h-[44px] font-medium"
                  >
                    Ir para o livro
                  </Link>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setManual({ title: preview.title || '', description: preview.description || '' })
                      setStep('edit')
                    }}
                  >
                    <Edit3 className="h-4 w-4 mr-2" aria-hidden="true" /> Editar dados do livro
                  </Button>
                </>
              ) : (
                <Button onClick={handleConfirm} disabled={createMut.isPending} aria-busy={createMut.isPending}>
                  {createMut.isPending ? 'Cadastrando...' : <><Check className="h-4 w-4 mr-2" aria-hidden="true" /> Confirmar cadastro</>}
                </Button>
              )}
              {!preview.already_exists && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setManual({ title: preview.title || '', description: preview.description || '' })
                    setStep('edit')
                  }}
                >
                  <Edit3 className="h-4 w-4 mr-2" aria-hidden="true" /> Editar dados
                </Button>
              )}
              <Button type="button" variant="secondary" onClick={() => { setStep('scan'); setFormError(null) }}>
                Voltar
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {step === 'edit' && preview && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold">Editar dados do livro</h2>
            <p className="text-sm text-slate-500">Revise título e descrição antes de cadastrar. ISBN permanece bloqueado.</p>
          </CardHeader>
          <CardBody>
            {formError && (
              <div role="alert" className="mb-4 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 p-3 text-sm text-red-800 dark:text-red-200">
                {formError}
              </div>
            )}
            <form onSubmit={handleEditSubmit} className="grid gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">ISBN (bloqueado)</label>
                <div className="mt-1 flex items-center gap-2">
                  <span className="flex-1 font-mono text-sm bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-3 py-2.5 rounded-md">{preview.isbn || '—'}</span>
                  <Button type="button" variant="secondary" onClick={() => setStep('scan')}>
                    Voltar ao leitor
                  </Button>
                </div>
              </div>
              <Input
                label="Título"
                id="book-title-edit"
                value={manual.title}
                onChange={(e) => setManual((s) => ({ ...s, title: e.target.value }))}
                placeholder="Título do livro"
                required
                autoFocus
              />
              <div>
                <label htmlFor="book-desc-edit" className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Descrição
                </label>
                <textarea
                  id="book-desc-edit"
                  value={manual.description}
                  onChange={(e) => setManual((s) => ({ ...s, description: e.target.value }))}
                  rows={3}
                  className="mt-1.5 w-full rounded-md border border-slate-300 dark:border-slate-600 px-3 py-2.5 text-base bg-white dark:bg-slate-800 focus-visible:outline-3 focus-visible:outline-[var(--color-focus)]"
                  placeholder="Descrição opcional"
                />
              </div>
              <div className="flex gap-3">
                <Button type="submit" disabled={isSaving} aria-busy={isSaving}>
                  {isSaving ? 'Salvando...' : preview.already_exists ? 'Salvar alterações' : 'Cadastrar livro'}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setStep('confirm')}>
                  Voltar à confirmação
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}
    </div>
  )
}
