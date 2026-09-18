export type ReadingStatus = 'want_to_read' | 'reading' | 'rereading' | 'read'

export const readingStatusOptions: Array<{ value: ReadingStatus; label: string }> = [
  { value: 'want_to_read', label: 'Quero ler' },
  { value: 'reading', label: 'Lendo' },
  { value: 'rereading', label: 'Relendo' },
  { value: 'read', label: 'Lido' },
]

export function readingStatusLabel(status: ReadingStatus | null | undefined) {
  return readingStatusOptions.find((option) => option.value === status)?.label ?? 'Sem acompanhamento'
}
