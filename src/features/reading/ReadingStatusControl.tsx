import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Bookmark, Heart } from 'lucide-react'
import api from '@/lib/api'
import { useAnnouncer } from '@/components/feedback/LiveRegionContext'
import { getErrorMessage } from '@/lib/errors'
import { readingStatusLabel, readingStatusOptions, type ReadingStatus } from './readingStatus'

export function ReadingStatusControl({
  bookId,
  status,
  compact = false,
}: {
  bookId: number
  status?: ReadingStatus | null
  compact?: boolean
}) {
  const queryClient = useQueryClient()
  const announce = useAnnouncer()
  const mutation = useMutation({
    mutationFn: async (next: ReadingStatus | null) => {
      if (next === null) {
        await api.delete(`/books/${bookId}/reading-status`)
        return null
      }
      const { data } = await api.put<{ status: ReadingStatus }>(
        `/books/${bookId}/reading-status`,
        { status: next },
      )
      return data.status
    },
    onSuccess: async (next) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['books'] }),
        queryClient.invalidateQueries({ queryKey: ['book', bookId] }),
        queryClient.invalidateQueries({ queryKey: ['student-home'] }),
        queryClient.invalidateQueries({ queryKey: ['reading-statuses'] }),
      ])
      await announce(next ? `Acompanhamento alterado para ${readingStatusLabel(next)}.` : 'Acompanhamento de leitura removido.', 'polite')
    },
    onError: (error: unknown) => {
      void announce(`Não foi possível atualizar o acompanhamento. ${getErrorMessage(error, 'Tente novamente.')}`, 'assertive')
    },
  })

  return (
    <label
      className={`flex min-w-0 items-center gap-2 ${compact ? 'text-xs' : 'text-sm'}`}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <span className="sr-only">Acompanhamento de leitura</span>
      <select
        aria-label={`Acompanhamento de leitura: ${readingStatusLabel(status)}`}
        value={status ?? ''}
        disabled={mutation.isPending}
        onChange={(event) => {
          event.stopPropagation()
          const value = event.target.value as ReadingStatus | ''
          mutation.mutate(value === '' ? null : value)
        }}
        className="min-h-10 min-w-0 max-w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 font-medium text-[var(--color-text)] shadow-sm focus-visible:outline-3 focus-visible:outline-[var(--color-focus)] disabled:cursor-wait disabled:opacity-60"
      >
        <option value="">Remover acompanhamento</option>
        {readingStatusOptions.filter((option) => option.value !== 'want_to_read').map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      {mutation.isPending && <span role="status" className="shrink-0">Salvando…</span>}
    </label>
  )
}

export function ReadingWantToReadControl({
  bookId,
  active = false,
}: {
  bookId: number
  active?: boolean
}) {
  const queryClient = useQueryClient()
  const announce = useAnnouncer()
  const mutation = useMutation({
    mutationFn: async () => {
      if (active) {
        await api.delete(`/books/${bookId}/reading-status`)
        return false
      }
      await api.put(`/books/${bookId}/reading-status`, { status: 'want_to_read' })
      return true
    },
    onSuccess: async (next) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['books'] }),
        queryClient.invalidateQueries({ queryKey: ['book', bookId] }),
        queryClient.invalidateQueries({ queryKey: ['student-home'] }),
        queryClient.invalidateQueries({ queryKey: ['reading-statuses'] }),
      ])
      await announce(next ? 'Livro marcado como Quero ler.' : 'Livro removido de Quero ler.', 'polite')
    },
    onError: (error: unknown) => {
      void announce(`Não foi possível atualizar Quero ler. ${getErrorMessage(error, 'Tente novamente.')}`, 'assertive')
    },
  })

  return <button
    type="button"
    aria-label={active ? 'Remover livro de Quero ler' : 'Marcar livro como Quero ler'}
    aria-pressed={active}
    aria-busy={mutation.isPending}
    disabled={mutation.isPending}
    onClick={() => mutation.mutate()}
    className={`reading-want-to-read-button group inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-medium shadow-sm transition-colors focus-visible:outline-3 focus-visible:outline-[var(--color-focus)] disabled:cursor-wait disabled:opacity-60 ${active
      ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-contrast)] hover:bg-[var(--color-primary-hover)]'
      : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]'}`}
  >
    <Bookmark aria-hidden="true" className="h-4 w-4" fill={active ? 'currentColor' : 'none'} />
    <span className="whitespace-nowrap">{active ? 'Não quero ler' : 'Quero ler'}</span>
  </button>
}

export function BookFavoriteControl({
  bookId,
  active = false,
}: {
  bookId: number
  active?: boolean
}) {
  const queryClient = useQueryClient()
  const announce = useAnnouncer()
  const mutation = useMutation({
    mutationFn: async () => {
      if (active) {
        await api.delete(`/books/${bookId}/favorite`)
        return false
      }
      await api.put(`/books/${bookId}/favorite`)
      return true
    },
    onSuccess: async (next) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['book', bookId] }),
        queryClient.invalidateQueries({ queryKey: ['books'] }),
      ])
      await announce(next ? 'Livro adicionado aos favoritos.' : 'Livro removido dos favoritos.', 'polite')
    },
    onError: (error: unknown) => {
      void announce(`Não foi possível atualizar o favorito. ${getErrorMessage(error, 'Tente novamente.')}`, 'assertive')
    },
  })

  const buttonTone = active
    ? 'text-[var(--color-primary)]'
    : 'text-[var(--color-primary-hover)]'

  return <button
    type="button"
    aria-label={active ? 'Desfavoritar livro' : 'Favoritar livro'}
    aria-pressed={active}
    aria-busy={mutation.isPending}
    disabled={mutation.isPending}
    onClick={() => mutation.mutate()}
    className={`group inline-flex min-h-10 shrink-0 flex-col items-center justify-center gap-0.5 border-0 bg-transparent px-1 py-1 shadow-none transition-colors focus-visible:outline-3 focus-visible:outline-[var(--color-focus)] disabled:cursor-wait disabled:opacity-60 ${buttonTone}`}
  >
    <span className="rounded-full p-2 transition-colors group-hover:bg-[var(--color-primary)] group-hover:text-[var(--color-primary-contrast)]">
      <Heart aria-hidden="true" className="h-5 w-5" fill={active ? 'currentColor' : 'none'} />
    </span>
    <span className="text-xs font-medium leading-tight whitespace-nowrap">{active ? 'Desfavoritar' : 'Favoritar'}</span>
  </button>
}
