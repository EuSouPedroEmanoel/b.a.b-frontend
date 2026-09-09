export type BookLoanSectionRecord = {
  copy_id: number
  user_id: number
}

const CIRCULATION_ROLES = new Set(['librarian', 'school_admin', 'super_admin'])

export function canViewBookCirculation(role?: string | null): boolean {
  return !!role && CIRCULATION_ROLES.has(role)
}

export function selectBookLoansForCopies<T extends BookLoanSectionRecord>(loans: T[], copyIds: Set<number>): T[] {
  return loans.filter((loan) => copyIds.has(loan.copy_id))
}

export function selectMyBookLoans<T extends BookLoanSectionRecord>(loans: T[], userId: number | null | undefined, copyIds: Set<number>): T[] {
  if (userId == null) return []
  return selectBookLoansForCopies(loans, copyIds).filter((loan) => loan.user_id === userId)
}

export function shouldShowMyBookLoans(role: string | null | undefined, loans: BookLoanSectionRecord[]): boolean {
  return !!role && role !== 'guest' && loans.length > 0
}
