const DETAIL_PT: Record<string, string> = {
  'Username or Password is wrong': 'Usuário ou senha incorretos',
  'Username, Email or CPF already exists!!': 'Nome de usuário ou CPF já cadastrado.',
  'Username, Email or CPF already exists': 'Nome de usuário ou CPF já cadastrado.',
  'CPF already exists': 'Este CPF já está cadastrado.',
  'CPF inválido': 'Informe um CPF válido.',
  'School is inactive': 'A escola selecionada está inativa.',
  'School not found': 'A escola selecionada não foi encontrada.',
  'school_id is required for SUPER_ADMIN': 'Selecione uma escola para o novo usuário.',
  'Nome de usuário é obrigatório': 'Informe o nome de usuário.',
  'Aluno deve informar a turma': 'Informe o número e a letra da turma.',
  'birthdate deve ser uma data no passado': 'A data de nascimento deve estar no passado.',
  'Network Error': 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
}

function translateDetail(value: string): string {
  if (DETAIL_PT[value]) return DETAIL_PT[value]
  if (value.includes('String should have at most 120 characters')) return 'Use no máximo 120 caracteres.'
  if (value.includes('String should have at least 1 character')) return 'Preencha este campo.'
  if (value.includes('Input should be a valid date')) return 'Informe uma data válida.'
  if (value.includes('Field required')) return 'Preencha este campo.'
  return value
}

export function getErrorMessage(err: unknown, fallback = 'Erro inesperado'): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
  if (Array.isArray(detail)) {
    // Pydantic 422: [{type, loc, msg, input}, ...]
    return detail
      .map((d) => {
        if (typeof d === 'string') return translateDetail(d)
        if (d && typeof d === 'object' && 'msg' in d) return translateDetail(String((d as { msg: string }).msg))
        return JSON.stringify(d)
      })
      .join(' — ')
  }
  if (typeof detail === 'string') return translateDetail(detail)
  if (detail && typeof detail === 'object' && 'msg' in (detail as Record<string, unknown>)) {
    return translateDetail(String((detail as { msg: string }).msg))
  }
  if (err instanceof Error && err.message) return translateDetail(err.message)
  return fallback
}

export function getErrorFieldMessages(err: unknown): Record<string, string> {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
  if (!Array.isArray(detail)) return {}
  const fields: Record<string, string> = {}
  for (const item of detail) {
    if (!item || typeof item !== 'object' || !('loc' in item) || !('msg' in item)) continue
    const loc = (item as { loc?: unknown }).loc
    const message = (item as { msg?: unknown }).msg
    if (!Array.isArray(loc) || typeof message !== 'string') continue
    const field = String(loc.at(-1) ?? '')
    const frontendField = field === 'turma_numero' ? 'turmaNumero'
      : field === 'turma_letra' ? 'turmaLetra' : field
    if (frontendField) fields[frontendField] = translateDetail(message)
  }
  return fields
}
