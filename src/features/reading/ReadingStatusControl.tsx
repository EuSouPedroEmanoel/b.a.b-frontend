import { useMutation, useQueryClient } from '@tanstack/react-query'
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
        <option value="">Sem acompanhamento</option>
        {readingStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      {mutation.isPending && <span role="status" className="shrink-0">Salvando…</span>}
    </label>
  )
}
