export function getErrorMessage(err: unknown, fallback = 'Erro inesperado'): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
  if (Array.isArray(detail)) {
    // Pydantic 422: [{type, loc, msg, input}, ...]
    return detail
      .map((d) => {
        if (typeof d === 'string') return d
        if (d && typeof d === 'object' && 'msg' in d) return String((d as { msg: string }).msg)
        return JSON.stringify(d)
      })
      .join(' — ')
  }
  if (typeof detail === 'string') return detail
  if (detail && typeof detail === 'object' && 'msg' in (detail as Record<string, unknown>)) {
    return String((detail as { msg: string }).msg)
  }
  if (err instanceof Error && err.message) return err.message
  return fallback
}
