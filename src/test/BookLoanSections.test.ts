import { describe, expect, it } from 'vitest'
import { canViewBookCirculation, selectMyBookLoans, shouldShowMyBookLoans } from '@/lib/bookLoanSections'

const copies = new Set([10])
const ownLoan = { copy_id: 10, user_id: 7 }
const otherLoan = { copy_id: 10, user_id: 8 }

describe('seções de empréstimos do livro', () => {
  it.each(['librarian', 'school_admin', 'super_admin'])('gestão vê Circulação (%s)', (role) => {
    expect(canViewBookCirculation(role)).toBe(true)
  })

  it.each(['student', 'teacher'])('leitor não vê Circulação (%s)', (role) => {
    expect(canViewBookCirculation(role)).toBe(false)
  })

  it('usuário com histórico próprio vê Meus empréstimos e devoluções', () => {
    expect(shouldShowMyBookLoans('student', selectMyBookLoans([ownLoan], 7, copies))).toBe(true)
  })

  it('usuário sem histórico próprio não vê a seção pessoal', () => {
    expect(shouldShowMyBookLoans('teacher', selectMyBookLoans([otherLoan], 7, copies))).toBe(false)
  })

  it('gestão com histórico próprio pode ter as duas seções', () => {
    expect(canViewBookCirculation('librarian')).toBe(true)
    expect(shouldShowMyBookLoans('librarian', selectMyBookLoans([ownLoan], 7, copies))).toBe(true)
  })

  it('nunca inclui dados de outro usuário no histórico pessoal', () => {
    expect(selectMyBookLoans([ownLoan, otherLoan], 7, copies)).toEqual([ownLoan])
  })
})
