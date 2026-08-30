/**
 * Gera cor HSL determinística a partir de uma string (título do livro).
 * Hue 0-360 via hash, Saturation 65% e Lightness 30% fixas para legibilidade com texto claro.
 */

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = titleCharCode(str, i) + ((hash << 5) - hash)
    hash |= 0
  }
  return Math.abs(hash)
}

function titleCharCode(str: string, i: number): number {
  return str.charCodeAt(i)
}

export const getBookCoverColor = (title: string): string => {
  let hash = 0
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 65%, 30%)`
}

export function stringToHsl(input: string, saturation = 65, lightness = 30): string {
  const normalized = (input ?? '').trim()
  if (!normalized) return `hsl(210, ${saturation}%, ${lightness}%)`
  const hue = hashString(normalized) % 360
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`
}

// aliases exigidos pelo enunciado
export function stringToColor(input: string): string {
  return getBookCoverColor(input)
}

export function generateColorFromString(input: string): string {
  return getBookCoverColor(input)
}

export function generateCoverColor(input: string): { bg: string; darkBg: string } {
  const bg = getBookCoverColor(input)
  const hue = (() => {
    let hash = 0
    for (let i = 0; i < input.length; i++) {
      hash = input.charCodeAt(i) + ((hash << 5) - hash)
    }
    return Math.abs(hash) % 360
  })()
  const darkBg = `hsl(${hue}, 65%, 20%)`
  return { bg, darkBg }
}

export const getBookCoverGradient = (title: string): string => {
  let hash = 0
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  const hue2 = (hue + 30) % 360
  return `linear-gradient(135deg, hsl(${hue}, 65%, 25%), hsl(${hue2}, 65%, 15%))`
}

export const getHoverGradientNoCover = (title: string): string => {
  let hash = 0
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `linear-gradient(145deg, hsl(${hue}, 50%, 20%), hsl(${hue}, 60%, 8%))`
}
