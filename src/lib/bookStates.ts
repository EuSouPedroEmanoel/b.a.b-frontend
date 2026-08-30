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

export function bookStateTone(state: string): 'success' | 'warning' | 'info' | 'danger' | 'neutral' {
  switch (state) {
    case 'available':
      return 'success'
    case 'borrowed':
      return 'warning'
    case 'reserved':
      return 'info'
    case 'lost':
      return 'danger'
    case 'archived':
    default:
      return 'neutral'
  }
}

export const BOOK_CONDITION_LABELS: Record<string, string> = {
  new: 'Novo',
  good: 'Bom',
  fair: 'Regular',
  poor: 'Ruim',
  bad: 'Péssimo',
}

export function bookConditionLabel(condition: string): string {
  return BOOK_CONDITION_LABELS[condition] ?? condition
}
