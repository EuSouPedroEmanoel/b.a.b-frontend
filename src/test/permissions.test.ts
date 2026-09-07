import { describe, expect, it } from 'vitest'
import { hasPersonalReaderCapability } from '@/lib/permissions'

describe('capacidades de leitor', () => {
  it('mantém student e teacher como perfis de circulação pessoal', () => {
    expect(hasPersonalReaderCapability('student')).toBe(true)
    expect(hasPersonalReaderCapability('teacher')).toBe(true)
  })

  it('não concede capacidade pessoal ao Guest ou a perfis administrativos', () => {
    expect(hasPersonalReaderCapability('guest')).toBe(false)
    expect(hasPersonalReaderCapability('librarian')).toBe(false)
    expect(hasPersonalReaderCapability(undefined)).toBe(false)
  })
})
