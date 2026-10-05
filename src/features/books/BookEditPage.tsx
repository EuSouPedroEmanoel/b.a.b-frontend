import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, RotateCcw, Save } from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { useAnnouncer } from '@/components/feedback/LiveRegionContext'
import { getErrorMessage } from '@/lib/errors'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { buildSchoolCustomizationPayload, customizationFieldStatus, type BookEditFormState, type CustomizationField } from './bookCustomization'

type Genre = { id: number; name: string; slug: string }
type Author = { id: number; name: string; slug: string }
type Book = {
  id: number
  title: string
  description: string | null
  cover_url: string | null
  published_date: string | null
  isbn: string | null
  genres: Genre[]
  authors: Author[]
}
type CustomizationState = {
  has_override: boolean
  overridden_fields: string[]
}

function formFromBook(book: Book): BookEditFormState {
  return {
    title: book.title,
    description: book.description ?? '',
    cover_url: book.cover_url ?? '',
    published_date: book.published_date ? book.published_date.slice(0, 10) : '',
    authors: book.authors.map((author) => author.name).join(', '),
    genres: book.genres.map((genre) => genre.name).join(', '),
  }
}

export function BookEditPage() {
  const { bookId } = useParams<{ bookId: string }>()
  const id = Number(bookId)
  const { user } = useAuth()
  const isSuperAdmin = user?.role === 'super_admin'
  const canEdit = isSuperAdmin || user?.role === 'librarian' || user?.role === 'school_admin'

  const bookQuery = useQuery({
    queryKey: ['book', id],
    queryFn: async () => (await api.get<Book>(`/books/${id}`)).data,
    enabled: Number.isSafeInteger(id) && id > 0,
  })
  const customizationQuery = useQuery({
    queryKey: ['book-customization', id],
    queryFn: async () => (await api.get<CustomizationState>(`/books/${id}/customization`)).data,
    enabled: Number.isSafeInteger(id) && id > 0 && !isSuperAdmin && !!canEdit,
  })

  if (!canEdit) {
    return (
      <div className="mx-auto max-w-2xl py-12 text-center" role="alert">
        <h1 className="text-2xl font-bold">Sem permissão</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">Apenas a equipe da biblioteca pode editar dados de livros.</p>
        <Link to={`/acervo/${id}`} className="mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-md bg-[var(--color-primary)] px-4 py-2 font-medium text-white">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Voltar ao livro
        </Link>
      </div>
    )
  }

  if (bookQuery.isLoading) {
    return <div className="mx-auto max-w-2xl py-12" role="status" aria-live="polite">Carregando livro…</div>
  }

  if (bookQuery.isError || !bookQuery.data) {
    return <div className="mx-auto max-w-2xl py-12 text-red-700 dark:text-red-300" role="alert">Não foi possível carregar o livro.</div>
  }

  return <BookEditForm key={bookQuery.data.id} book={bookQuery.data} id={id} isSuperAdmin={isSuperAdmin} customization={customizationQuery.data} />
}

type BookEditFormProps = {
  book: Book
  id: number
  isSuperAdmin: boolean
  customization?: CustomizationState
}

function BookEditForm({ book, id, isSuperAdmin, customization }: BookEditFormProps) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const announce = useAnnouncer()
  const endpoint = isSuperAdmin ? `/books/${id}/global` : `/books/${id}/customization`
  const [initialForm] = useState(() => formFromBook(book))
  const [form, setForm] = useState<BookEditFormState>(initialForm)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const fieldStatus = (field: CustomizationField) => {
    if (isSuperAdmin || !customization) return undefined
    return customizationFieldStatus(customization.overridden_fields, field) === 'customized'
      ? 'Personalizado nesta escola.'
      : 'Herdado do catálogo global.'
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const schoolPayload = buildSchoolCustomizationPayload(initialForm, form)
      const payload = isSuperAdmin
        ? {
            title: form.title.trim(),
            description: form.description.trim() || null,
            cover_url: form.cover_url.trim() || null,
            published_date: form.published_date || null,
            author_names: form.authors.split(',').map((item) => item.trim()).filter(Boolean),
            genre_names: form.genres.split(',').map((item) => item.trim()).filter(Boolean),
          }
        : schoolPayload
      const { data } = await api.patch<Book>(endpoint, {
        ...payload,
      })
      return data
    },
    onSuccess: async (book) => {
      qc.setQueryData(['book', id], book)
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['books'] }),
        qc.invalidateQueries({ queryKey: ['book', id] }),
        qc.invalidateQueries({ queryKey: ['book-customization', id] }),
        qc.invalidateQueries({ queryKey: ['books', 'recommendations'] }),
        qc.invalidateQueries({ queryKey: ['copies', id] }),
        qc.invalidateQueries({ queryKey: ['loans'] }),
        qc.invalidateQueries({ queryKey: ['reservations'] }),
      ])
      const message = isSuperAdmin
        ? 'Catálogo global atualizado com sucesso.'
        : 'Personalização desta escola salva com sucesso.'
      setErrorMessage(null)
      await announce(message, 'polite')
      navigate(`/acervo/${id}`)
    },
    onError: async (error: unknown) => {
      const message = getErrorMessage(error, 'Não foi possível salvar as alterações.')
      setErrorMessage(message)
      await announce(message, 'assertive')
    },
  })

  const restoreMutation = useMutation({
    mutationFn: async () => api.delete(`/books/${id}/customization`),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['book', id] }),
        qc.invalidateQueries({ queryKey: ['book-customization', id] }),
        qc.invalidateQueries({ queryKey: ['books'] }),
        qc.invalidateQueries({ queryKey: ['books', 'recommendations'] }),
      ])
      const message = 'Livro restaurado para os dados globais.'
      setErrorMessage(null)
      await announce(message, 'polite')
      navigate(`/acervo/${id}`)
    },
    onError: async (error: unknown) => {
      const message = getErrorMessage(error, 'Não foi possível restaurar os dados globais.')
      setErrorMessage(message)
      await announce(message, 'assertive')
    },
  })

  const title = isSuperAdmin ? 'Editar catálogo global' : 'Personalizar livro para esta escola'

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link to={`/acervo/${id}`} className="inline-flex min-h-[44px] w-fit items-center gap-2 text-sm font-medium text-slate-600 hover:text-[var(--color-primary)] dark:text-slate-300">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Voltar ao livro
      </Link>
      <Card>
        <CardHeader>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {isSuperAdmin
              ? 'Estas alterações afetam o registro bibliográfico compartilhado.'
              : 'Estas alterações serão exibidas somente para a escola da sua conta.'}
          </p>
          {customization?.has_override && !isSuperAdmin && (
            <p className="mt-2 text-sm text-sky-700 dark:text-sky-300">
              Este livro já possui uma personalização nesta escola. Restaurar os dados globais removerá todos os overrides locais.
            </p>
          )}
        </CardHeader>
        <CardBody>
          {errorMessage && <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200" role="alert">{errorMessage}</div>}
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              setErrorMessage(null)
              saveMutation.mutate()
            }}
          >
            <Input label="Título" id="book-edit-title" hint={fieldStatus('title')} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required autoFocus />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="book-edit-description" className="text-sm font-medium text-slate-700 dark:text-slate-200">Descrição</label>
              <textarea id="book-edit-description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={5} className="w-full rounded-md border border-[var(--color-field-border-hover)] bg-[var(--color-field)] px-3 py-2.5 text-base focus-visible:outline-3 focus-visible:outline-[var(--color-focus)]" />
              {fieldStatus('description') && <p className="text-xs text-slate-500 dark:text-slate-400">{fieldStatus('description')}</p>}
            </div>
            <Input label="Link da capa" id="book-edit-cover" type="url" hint={fieldStatus('cover_url')} value={form.cover_url} onChange={(event) => setForm({ ...form, cover_url: event.target.value })} />
            <Input label="Data de lançamento" id="book-edit-date" type="date" hint={fieldStatus('published_date')} value={form.published_date} onChange={(event) => setForm({ ...form, published_date: event.target.value })} />
            <Input label="Autores" id="book-edit-authors" hint={[fieldStatus('authors'), 'Separe vários autores por vírgula.'].filter(Boolean).join(' ')} value={form.authors} onChange={(event) => setForm({ ...form, authors: event.target.value })} />
            <Input label="Gêneros" id="book-edit-genres" hint={[fieldStatus('genres'), 'Separe vários gêneros por vírgula.'].filter(Boolean).join(' ')} value={form.genres} onChange={(event) => setForm({ ...form, genres: event.target.value })} />
            <p className="text-sm text-slate-500 dark:text-slate-400">ISBN: <span className="font-mono">{book.isbn ?? '—'}</span></p>
            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:flex-wrap">
              <Button type="submit" disabled={saveMutation.isPending || restoreMutation.isPending} aria-busy={saveMutation.isPending}>
                <Save className="mr-2 h-4 w-4" aria-hidden="true" />
                {saveMutation.isPending ? 'Salvando…' : 'Salvar alterações'}
              </Button>
              {!isSuperAdmin && customization?.has_override && (
                <Button type="button" variant="secondary" disabled={saveMutation.isPending || restoreMutation.isPending} aria-busy={restoreMutation.isPending} onClick={() => restoreMutation.mutate()}>
                  <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
                  {restoreMutation.isPending ? 'Restaurando…' : 'Restaurar dados globais'}
                </Button>
              )}
              <Link to={`/acervo/${id}`} className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 dark:border-slate-600 dark:text-slate-200">Cancelar</Link>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
