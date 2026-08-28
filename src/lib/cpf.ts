export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '').slice(0, 11)
}

export function formatCpfInput(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

export function formatCpf(cpf: string | null): string {
  if (!cpf) return '—'
  return cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
}

export function validateCpfDigits(digits: string): boolean {
  if (digits.length !== 11) return false
  if (/^(\d)\1{10}$/.test(digits)) return false
  const calc = (len: number): number => {
    let sum = 0
    for (let i = 0; i < len; i++) sum += parseInt(digits[i], 10) * (len + 1 - i)
    const rest = (sum * 10) % 11
    return rest === 10 ? 0 : rest
  }
  if (calc(9) !== parseInt(digits[9], 10)) return false
  return calc(10) === parseInt(digits[10], 10)
}
