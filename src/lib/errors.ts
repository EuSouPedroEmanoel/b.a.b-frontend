const DETAIL_PT: Record<string, string> = {
  'Username or Password is wrong': 'Usuário ou senha incorretos',
}

function translateDetail(value: string): string {
  return DETAIL_PT[value] ?? value
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
