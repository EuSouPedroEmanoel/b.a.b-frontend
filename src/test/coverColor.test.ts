import { describe, expect, it } from 'vitest'
import { cappuccinoCoverBackground, cappuccinoCoverSurface } from '@/lib/coverColor'

function luminance(color: string): number {
  const values = color.match(/\d+/g)?.map(Number) ?? [0, 0, 0]
  return values.reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0)
}

describe('fundo Cappuccino derivado da capa', () => {
  it.each(['#1976d2', '#3f7d3a', '#d94b55', '#e9a52f', '#fefefe', '#101010'])('mantém variação sem retornar a cor original (%s)', (cover) => {
    const result = cappuccinoCoverBackground(cover)
    expect(result).toMatch(/^rgb\(\d+, \d+, \d+\)$/)
    expect(result).not.toBe(cover)
  })

  it('usa a base Cappuccino para entradas inválidas', () => {
    expect(cappuccinoCoverBackground('invalid')).toBe('#BFA889')
    expect(cappuccinoCoverSurface('invalid')).toBe('#D8C5AC')
  })

  it.each(['#1976d2', '#3f7d3a', '#d94b55', '#e9a52f', '#8e44ad', '#fefefe', '#101010'])('mantém a superfície mais clara que o fundo (%s)', (cover) => {
    expect(luminance(cappuccinoCoverSurface(cover))).toBeGreaterThan(luminance(cappuccinoCoverBackground(cover)))
  })

  it('preserva variação cromática perceptível entre capas', () => {
    const surfaces = ['#1976d2', '#3f7d3a', '#d94b55', '#e9a52f', '#8e44ad'].map(cappuccinoCoverSurface)
    expect(new Set(surfaces).size).toBe(surfaces.length)
  })
})
