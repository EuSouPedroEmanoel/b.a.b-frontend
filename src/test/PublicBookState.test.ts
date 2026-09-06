import { describe, expect, it } from 'vitest'
import { publicBookStateLabel, publicBookStateTone } from '@/lib/bookStates'

describe('public Guest book states', () => {
  it('collapses operational states to the public vocabulary', () => {
    expect(publicBookStateLabel('available')).toBe('Disponível')
    expect(publicBookStateLabel('lost')).toBe('Indisponível')
    expect(publicBookStateLabel('borrowed')).toBe('Indisponível')
    expect(publicBookStateLabel('reserved')).toBe('Indisponível')
    expect(publicBookStateTone('available')).toBe('success')
    expect(publicBookStateTone('lost')).toBe('neutral')
  })
})
