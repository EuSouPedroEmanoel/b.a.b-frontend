export const BOOK_STATE_LABELS: Record<string, string> = {
  available: 'Disponível',
  borrowed: 'Emprestado',
  reserved: 'Reservado',
  lost: 'Perdido',
  archived: 'Arquivado',
}

export function bookStateLabel(state: string): string {
  return BOOK_STATE_LABELS[state] ?? state
}
