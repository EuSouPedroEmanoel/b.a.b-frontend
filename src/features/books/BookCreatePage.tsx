import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Barcode, Edit3, Check, Search, X } from 'lucide-react'
import api from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'
import { useAnnouncer } from '@/components/feedback/LiveRegionContext'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { getCoverProxyUrl } from '@/lib/imageProxy'

type Book = { id: number; title: string; description: string | null; state: string; isbn: string | null; is_active: boolean; added_by: number }
type Lookup = { isbn: string; title: string | null; description: string | null; cover_url: string | null; published_date: string | null; genres: string[]; authors: string[]; found: boolean; already_exists: boolean; existing_book_id: number | null }

type Step = 'scan' | 'confirm' | 'edit'

type GenrePublic = { id: number; name: string; slug: string }
type AuthorPublic = { id: number; name: string; slug: string }

export function BookCreatePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const announce = useAnnouncer()
  const qc = useQueryClient()
  const [step, setStep] = useState<Step>('scan')
  const [isbn, setIsbn] = useState('')
  const [preview, setPreview] = useState<Lookup | null>(null)
  const [manual, setManual] = useState({ title: '', description: '', cover_url: '', published_date: '' })
  const [selectedGenres, setSelectedGenres] = useState<string[]>([])
  const [genreInput, setGenreInput] = useState('')
  const [genreSuggestOpen, setGenreSuggestOpen] = useState(false)
  const [selectedAuthors, setSelectedAuthors] = useState<string[]>([])
  const [authorInput, setAuthorInput] = useState('')
  const [authorSuggestOpen, setAuthorSuggestOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const isbnRef = useRef<HTMLInputElement>(null)

  const allowed = ['librarian', 'school_admin']
  const canCreate = !!user && allowed.includes(user.role)

  const { data: genreSuggest } = useQuery({
    queryKey: ['genres-suggest', genreInput],
    queryFn: async () => {
      const { data } = await api.get<{ items: GenrePublic[] }>('/genres/', { params: { q: genreInput, size: 8 } })
      return data.items
    },
    enabled: genreInput.trim().length >= 2 && genreSuggestOpen,
  })
  const { data: authorSuggest } = useQuery({
    queryKey: ['authors-suggest', authorInput],
    queryFn: async () => {
      const { data } = await api.get<{ items: AuthorPublic[] }>('/authors/', { params: { q: authorInput, size: 8 } })
      return data.items
    },
    enabled: authorInput.trim().length >= 2 && authorSuggestOpen,
  })

  const addGenre = (name: string) => {
    const clean = name.trim()
    if (!clean) return
    if (selectedGenres.some((g) => g.toLowerCase() === clean.toLowerCase())) return
    setSelectedGenres((prev) => [...prev, clean])
    setGenreInput('')
    setGenreSuggestOpen(false)
  }
  const removeGenre = (name: string) => setSelectedGenres((prev) => prev.filter((g) => g !== name))
  const addAuthor = (name: string) => {
    const clean = name.trim()
    if (!clean) return
    if (selectedAuthors.some((a) => a.toLowerCase() === clean.toLowerCase())) return
    setSelectedAuthors((prev) => [...prev, clean])
    setAuthorInput('')
    setAuthorSuggestOpen(false)
  }
  const removeAuthor = (name: string) => setSelectedAuthors((prev) => prev.filter((a) => a !== name))

  const lookupMut = useMutation({
    mutationFn: async (rawIsbn: string) => {
      const clean = rawIsbn.replace(/[^0-9X]/gi, '')
      const { data } = await api.get<Lookup>(`/books/lookup?isbn=${encodeURIComponent(clean)}`)
      return data
    },
    onSuccess: (data) => {
      setPreview(data)
      if (data.cover_url) setManual((s) => ({ ...s, cover_url: data.cover_url || '' }))
      if (data.published_date) setManual((s) => ({ ...s, published_date: data.published_date ? String(data.published_date).slice(0, 10) : '' }))
      if (data.genres?.length) setSelectedGenres(data.genres)
      else setSelectedGenres([])
      if (data.authors?.length) setSelectedAuthors(data.authors)
      else setSelectedAuthors([])
      if (data.already_exists) {
        announce('Livro já cadastrado', 'polite')
        setStep('confirm')
      } else if (data.found) {
        announce(`Livro encontrado: ${data.title}`, 'polite')
        setStep('confirm')
      } else {
        announce('Livro não encontrado, preencha manualmente', 'assertive')
        setManual({ title: '', description: '', cover_url: data.cover_url || '', published_date: data.published_date ? String(data.published_date).slice(0, 10) : '' })
        if (!data.genres?.length) setSelectedGenres([])
        if (!data.authors?.length) setSelectedAuthors([])
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
    mutationFn: async (payload: Record<string, unknown>) => {
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
    mutationFn: async (payload: Record<string, unknown>) => {
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
      setPreview({ isbn: clean || initialIsbn, title: null, description: null, cover_url: null, published_date: null, genres: [], authors: [], found: false, already_exists: false, existing_book_id: null })
      setManual({ title: '', description: '', cover_url: '', published_date: '' })
      setSelectedGenres([])
      setSelectedAuthors([])
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
    const payload: Record<string, unknown> = { isbn: preview.isbn }
    if (preview.title) payload.title = preview.title
    if (preview.description) payload.description = preview.description
    const cover = manual.cover_url?.trim() || preview.cover_url || undefined
    if (cover) payload.cover_url = cover
    if (preview.published_date) payload.published_date = preview.published_date
    else if (manual.published_date?.trim()) payload.published_date = manual.published_date.trim()
    if (selectedGenres.length) payload.genre_names = selectedGenres
    if (selectedAuthors.length) payload.author_names = selectedAuthors
    if (!payload.title) {
      setManual({ title: preview.title || '', description: preview.description || '', cover_url: (preview.cover_url as string) || '', published_date: preview.published_date ? String(preview.published_date).slice(0, 10) : manual.published_date || '' })
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
    let genres = selectedGenres
    if (genreInput.trim()) {
      const pending = genreInput.trim()
      if (!genres.some((g) => g.toLowerCase() === pending.toLowerCase())) genres = [...genres, pending]
    }
    let authors = selectedAuthors
    if (authorInput.trim()) {
      const pending = authorInput.trim()
      if (!authors.some((a) => a.toLowerCase() === pending.toLowerCase())) authors = [...authors, pending]
    }
    const payload: Record<string, unknown> = {
      title: manual.title.trim(),
      description: manual.description.trim() || null,
      cover_url: manual.cover_url.trim() || null,
      published_date: manual.published_date.trim() || null,
    }
    if (genres.length) payload.genre_names = genres
    else if (selectedGenres.length === 0 && genreInput.trim() === '') payload.genre_names = []
    if (authors.length) payload.author_names = authors
    else if (selectedAuthors.length === 0 && authorInput.trim() === '') payload.author_names = []
    if (!preview) return
    if (preview.already_exists && preview.existing_book_id) {
      patchMut.mutate(payload)
    } else {
      createMut.mutate({ isbn: preview.isbn, ...payload })
    }
  }

  if (!canCreate) {
    return (
      <div role="alert" className="mx-auto max-w-2xl py-12 text-center">
        <h1 className="text-2xl font-bold">Sem permissão</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">Apenas bibliotecários e administradores escolares podem cadastrar livros.</p>
        <p className="mt-1 text-sm text-slate-500">Seu perfil: <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">{user?.role ?? 'desconhecido'}</code></p>
        <Link to="/acervo" className="inline-flex items-center justify-center gap-2 mt-6 px-4 py-2 rounded-md bg-[#0f4c75] text-white hover:bg-[#0e3f61] active:bg-[#0c3d5e] dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 dark:active:bg-slate-200 min-h-[44px] font-medium shadow-sm transition-colors focus-visible:outline-3 focus-visible:outline-[var(--color-focus)] focus-visible:outline-offset-2">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Voltar ao acervo
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
              <div className="flex flex-col sm:flex-row gap-3" role="group" aria-label="Ações de busca">
                <Button type="submit" disabled={lookupMut.isPending} aria-busy={lookupMut.isPending} className="flex-1 sm:flex-none">
                  {lookupMut.isPending ? 'Buscando...' : <><Search className="h-4 w-4 mr-2" aria-hidden="true" /> Buscar</>}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    const clean = isbn.replace(/[^0-9X]/gi, '')
                    if (clean.length >= 10) setPreview({ isbn: clean, title: null, description: null, cover_url: null, published_date: null, genres: [], authors: [], found: false, already_exists: false, existing_book_id: null })
                    else if (isbn.trim()) setPreview({ isbn: isbn.trim(), title: null, description: null, cover_url: null, published_date: null, genres: [], authors: [], found: false, already_exists: false, existing_book_id: null })
                    else setPreview({ isbn: '', title: null, description: null, cover_url: null, published_date: null, genres: [], authors: [], found: false, already_exists: false, existing_book_id: null })
                    setManual({ title: '', description: '', cover_url: '', published_date: '' })
                    setSelectedGenres([])
                    setSelectedAuthors([])
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
              <div>
                <dt className="text-sm font-medium text-slate-600 dark:text-slate-300">Capa (URL)</dt>
                <dd className="mt-1 p-3 rounded-md bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm break-all">
                  {preview.cover_url || manual.cover_url || '—'}
                </dd>
                {preview.cover_url && (
                  <dd className="mt-2">
                    <img
                      src={getCoverProxyUrl(preview.cover_url, 320) ?? preview.cover_url}
                      alt="preview"
                      className="h-32 rounded border object-cover"
                      loading="lazy"
                      decoding="async"
                      width={220}
                      height={320}
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                  </dd>
                )}
              </div>
              <div>
                <dt className="text-sm font-medium text-slate-600 dark:text-slate-300">Data de lançamento</dt>
                <dd className="mt-1 p-3 rounded-md bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm">
                  {preview.published_date ? new Date(preview.published_date).toLocaleDateString('pt-BR') : manual.published_date ? new Date(manual.published_date).toLocaleDateString('pt-BR') : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-slate-600 dark:text-slate-300">Gêneros</dt>
                <dd className="mt-1 flex flex-wrap gap-2">
                  {selectedGenres.length ? selectedGenres.map((g) => <Badge key={g} tone="neutral">{g}</Badge>) : <span className="text-sm text-slate-500">—</span>}
                </dd>
                <p className="text-xs text-slate-500 mt-1">Gêneros vindos da API serão criados automaticamente ao confirmar.</p>
              </div>
              <div>
                <dt className="text-sm font-medium text-slate-600 dark:text-slate-300">Autores</dt>
                <dd className="mt-1 flex flex-wrap gap-2">
                  {selectedAuthors.length ? selectedAuthors.map((a) => <Badge key={a} tone="neutral">{a}</Badge>) : <span className="text-sm text-slate-500">—</span>}
                </dd>
                <p className="text-xs text-slate-500 mt-1">Autores vindos da API serão criados automaticamente ao confirmar.</p>
              </div>
              <div className="grid gap-2">
                <label htmlFor="confirm-cover" className="text-sm font-medium text-slate-700 dark:text-slate-200">Editar link da capa (opcional)</label>
                <input id="confirm-cover" value={manual.cover_url} onChange={(e) => setManual((s) => ({ ...s, cover_url: e.target.value }))} placeholder="https://..." className="w-full rounded-md border border-slate-300 dark:border-slate-600 px-3 py-2.5 text-sm bg-white dark:bg-slate-800" />
              </div>
              <div className="grid gap-2">
                <label htmlFor="confirm-published" className="text-sm font-medium text-slate-700 dark:text-slate-200">Data de lançamento (opcional)</label>
                <input id="confirm-published" type="date" value={manual.published_date} onChange={(e) => setManual((s) => ({ ...s, published_date: e.target.value }))} className="w-full rounded-md border border-slate-300 dark:border-slate-600 px-3 py-2.5 text-sm bg-white dark:bg-slate-800" />
              </div>
            </dl>
            <div className="mt-6 flex flex-col sm:flex-row gap-3" role="group" aria-label="Ações de confirmação">
              {preview.already_exists ? (
                <>
                  <Link
                    to={`/acervo/${preview.existing_book_id}`}
                    className="inline-flex items-center justify-center px-5 py-2.5 rounded-md bg-sky-600 text-white hover:bg-sky-700 active:bg-sky-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 dark:active:bg-slate-200 min-h-[44px] font-medium shadow-sm transition-colors focus-visible:outline-3 focus-visible:outline-[var(--color-focus)] focus-visible:outline-offset-2"
                  >
                    Ir para o livro
                  </Link>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setManual({ title: preview.title || '', description: preview.description || '', cover_url: preview.cover_url || '', published_date: preview.published_date ? String(preview.published_date).slice(0, 10) : manual.published_date || '' })
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
                    setManual({ title: preview.title || '', description: preview.description || '', cover_url: preview.cover_url || '', published_date: preview.published_date ? String(preview.published_date).slice(0, 10) : manual.published_date || '' })
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
            <p className="text-sm text-slate-500">Revise título, descrição, capa, gêneros e autores antes de cadastrar. ISBN permanece bloqueado.</p>
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
                <label htmlFor="book-desc-edit" className="text-sm font-medium text-slate-700 dark:text-slate-200">Descrição</label>
                <textarea
                  id="book-desc-edit"
                  value={manual.description}
                  onChange={(e) => setManual((s) => ({ ...s, description: e.target.value }))}
                  rows={3}
                  className="mt-1.5 w-full rounded-md border border-slate-300 dark:border-slate-600 px-3 py-2.5 text-base bg-white dark:bg-slate-800 focus-visible:outline-3 focus-visible:outline-[var(--color-focus)]"
                  placeholder="Descrição opcional"
                />
              </div>
              <Input
                label="Link da capa (URL)"
                id="book-cover-edit"
                value={manual.cover_url}
                onChange={(e) => setManual((s) => ({ ...s, cover_url: e.target.value }))}
                placeholder="https://... (opcional)"
                type="url"
              />
              <Input
                label="Data de lançamento"
                id="book-published-edit"
                value={manual.published_date}
                onChange={(e) => setManual((s) => ({ ...s, published_date: e.target.value }))}
                type="date"
                hint="Opcional — informe a data de publicação do livro"
              />
              <div>
                <label htmlFor="book-genres-edit" className="text-sm font-medium text-slate-700 dark:text-slate-200">Gêneros (pressione Enter para adicionar)</label>
                <div className="mt-1.5 flex flex-wrap gap-2 mb-2">
                  {selectedGenres.map((g) => (
                    <Badge key={g} tone="neutral" className="flex items-center gap-1 pr-1">
                      {g} <button type="button" onClick={() => removeGenre(g)} aria-label={`Remover ${g}`} className="ml-1 rounded p-0.5 hover:bg-slate-200 dark:hover:bg-slate-600"><X className="h-3 w-3" /></button>
                    </Badge>
                  ))}
                </div>
                <div className="relative">
                  <input
                    id="book-genres-edit"
                    value={genreInput}
                    onChange={(e) => { setGenreInput(e.target.value); setGenreSuggestOpen(true) }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); addGenre(genreInput) }
                      if (e.key === 'Backspace' && !genreInput && selectedGenres.length) removeGenre(selectedGenres[selectedGenres.length - 1])
                    }}
                    onBlur={() => setTimeout(() => setGenreSuggestOpen(false), 150)}
                    onFocus={() => genreInput.trim().length >= 2 && setGenreSuggestOpen(true)}
                    placeholder="Digite um gênero e pressione Enter"
                    className="w-full rounded-md border border-slate-300 dark:border-slate-600 px-3 py-2.5 text-base bg-white dark:bg-slate-800 focus-visible:outline-3 focus-visible:outline-[var(--color-focus)]"
                  />
                  {genreSuggestOpen && genreSuggest && genreSuggest.length > 0 && (
                    <ul className="absolute z-20 top-full left-0 right-0 mt-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-lg max-h-40 overflow-auto">
                      {genreSuggest.filter((g) => !selectedGenres.some((s) => s.toLowerCase() === g.name.toLowerCase())).map((g) => (
                        <li key={g.id} onMouseDown={(e) => { e.preventDefault(); addGenre(g.name) }} className="px-3 py-2 text-sm cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700">
                          {g.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">Gêneros inexistentes serão criados automaticamente ao salvar.</p>
              </div>
              <div>
                <label htmlFor="book-authors-edit" className="text-sm font-medium text-slate-700 dark:text-slate-200">Autores (pressione Enter para adicionar)</label>
                <div className="mt-1.5 flex flex-wrap gap-2 mb-2">
                  {selectedAuthors.map((a) => (
                    <Badge key={a} tone="neutral" className="flex items-center gap-1 pr-1">
                      {a} <button type="button" onClick={() => removeAuthor(a)} aria-label={`Remover ${a}`} className="ml-1 rounded p-0.5 hover:bg-slate-200 dark:hover:bg-slate-600"><X className="h-3 w-3" /></button>
                    </Badge>
                  ))}
                </div>
                <div className="relative">
                  <input
                    id="book-authors-edit"
                    value={authorInput}
                    onChange={(e) => { setAuthorInput(e.target.value); setAuthorSuggestOpen(true) }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); addAuthor(authorInput) }
                      if (e.key === 'Backspace' && !authorInput && selectedAuthors.length) removeAuthor(selectedAuthors[selectedAuthors.length - 1])
                    }}
                    onBlur={() => setTimeout(() => setAuthorSuggestOpen(false), 150)}
                    onFocus={() => authorInput.trim().length >= 2 && setAuthorSuggestOpen(true)}
                    placeholder="Digite um autor e pressione Enter"
                    className="w-full rounded-md border border-slate-300 dark:border-slate-600 px-3 py-2.5 text-base bg-white dark:bg-slate-800 focus-visible:outline-3 focus-visible:outline-[var(--color-focus)]"
                  />
                  {authorSuggestOpen && authorSuggest && authorSuggest.length > 0 && (
                    <ul className="absolute z-20 top-full left-0 right-0 mt-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-lg max-h-40 overflow-auto">
                      {authorSuggest.filter((a) => !selectedAuthors.some((s) => s.toLowerCase() === a.name.toLowerCase())).map((a) => (
                        <li key={a.id} onMouseDown={(e) => { e.preventDefault(); addAuthor(a.name) }} className="px-3 py-2 text-sm cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700">
                          {a.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">Autores inexistentes serão criados automaticamente ao salvar.</p>
              </div>
              <div className="flex gap-3" role="group" aria-label="Ações de edição">
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
