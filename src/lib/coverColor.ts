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

const CAPPUCCINO_BASE = [191, 168, 137] as const

function mixCappuccino(hex: string, minLightness: number, maxLightness: number, baseWeight: number): string | null {
  const match = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex.trim())
  if (!match) return null
  const rgb = match.slice(1).map((part) => Number.parseInt(part, 16) / 255)
  const max = Math.max(...rgb)
  const min = Math.min(...rgb)
  const lightness = (max + min) / 2
  const delta = max - min
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1))
  let hue = 0
  if (delta !== 0) {
    if (max === rgb[0]) hue = 60 * (((rgb[1] - rgb[2]) / delta) % 6)
    else if (max === rgb[1]) hue = 60 * ((rgb[2] - rgb[0]) / delta + 2)
    else hue = 60 * ((rgb[0] - rgb[1]) / delta + 4)
    if (hue < 0) hue += 360
  }
  const adaptedLightness = Math.min(maxLightness, Math.max(minLightness, lightness * 0.82))
  const adaptedSaturation = Math.min(0.3, saturation * 0.45)
  const chroma = (1 - Math.abs(2 * adaptedLightness - 1)) * adaptedSaturation
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1))
  const [r1, g1, b1] = hue < 60 ? [chroma, x, 0] : hue < 120 ? [x, chroma, 0] : hue < 180 ? [0, chroma, x] : hue < 240 ? [0, x, chroma] : hue < 300 ? [x, 0, chroma] : [chroma, 0, x]
  const m = adaptedLightness - chroma / 2
  const coverRgb = [r1 + m, g1 + m, b1 + m].map((channel) => Math.round(channel * 255))
  const coverWeight = 1 - baseWeight
  const mixed = CAPPUCCINO_BASE.map((base, index) => Math.round(base * baseWeight + coverRgb[index] * coverWeight))
  return `rgb(${mixed[0]}, ${mixed[1]}, ${mixed[2]})`
}

/** Adapta a cor média da capa ao fundo Cappuccino sem apagar sua identidade. */
export function cappuccinoCoverBackground(hex: string): string {
  return mixCappuccino(hex, 0.4, 0.68, 0.6) ?? '#BFA889'
}

/** Superfície da mesma família cromática, sempre mais clara que o fundo. */
export function cappuccinoCoverSurface(hex: string): string {
  // Superfícies usam 50% da cor adaptada (antes 40%), mantendo a base
  // Cappuccino dominante e reforçando sutilmente a identidade da capa.
  return mixCappuccino(hex, 0.64, 0.82, 0.5) ?? '#D8C5AC'
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
