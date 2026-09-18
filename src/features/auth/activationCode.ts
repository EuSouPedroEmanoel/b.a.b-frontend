export const ACTIVATION_ALPHABET = '123456789ABCDEFGHJKMNPQRSTUVWXYZ'

export function formatActivationCode(value: string) {
  const compact = value.toUpperCase().replace(/[ -]/g, '')
  const valid = [...compact].filter((character) => ACTIVATION_ALPHABET.includes(character)).join('').slice(0, 9)
  return valid.replace(/(.{3})(?=.)/g, '$1-')
}

export function hasInvalidActivationCharacter(value: string) {
  return [...value.toUpperCase().replace(/[ -]/g, '')].some((character) => !ACTIVATION_ALPHABET.includes(character))
}
